import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLE_LEVELS } from '../config/roles'
import { subscribeToPush, requestNotificationPermission } from '../lib/pushNotifications'
import { requestPushPermission } from '../lib/pushPermission'
import { registerPushNotifications } from '../lib/notifications'

const AuthContext = createContext(null)
export const NPS_COMPANY_ID = '9af02c98-04f3-4dbd-9f7e-07e7f9bbdc6c'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewRole, setViewRoleState] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const userRef             = useRef(null)
  const loadingTimeoutRef   = useRef(null)
  const loadingProfileRef   = useRef(false)                      // concurrency guard
  const lastSignedInRef     = useRef({ userId: null, at: 0 })   // deduplication
  const passwordCheckedRef  = useRef(false)                      // skip redundant password_set query on tab-resume SIGNED_IN
  const profileUserIdRef    = useRef(null)                       // tracks userId of currently loaded profile; blocks redundant loadProfile() calls
  const [profileConfirmed, setProfileConfirmed] = useState(false) // true once loadProfile() finishes a real DB fetch (not a cache hit)

  function readProfileCache(userId) {
    try { return JSON.parse(localStorage.getItem(`pc-profile-${userId}`)) } catch { return null }
  }
  function writeProfileCache(p) {
    if (!p?.id) return
    try {
      localStorage.setItem(`pc-profile-${p.id}`, JSON.stringify({
        id: p.id, first_name: p.first_name||'', last_name: p.last_name||'',
        company_id: p.company_id||null, role: p.role||'officer',
      }))
    } catch {}
  }

  function loadViewAs(profileId) {
    const saved = localStorage.getItem(`pc-viewas-${profileId}`)
    setViewRoleState(saved || null)
  }

  function switchViewAs(newRole) {
    if (!profile?.id) return
    localStorage.setItem(`pc-viewas-${profile.id}`, newRole)
    setViewRoleState(newRole)
  }

  function exitViewAs() {
    if (!profile?.id) return
    localStorage.removeItem(`pc-viewas-${profile.id}`)
    setViewRoleState(null)
  }

  const effectiveRole = viewRole || profile?.role
  const isNPS = profile?.company_id === NPS_COMPANY_ID

  async function loadProfile(userId, sessionUser) {
    console.log('[Auth] loadProfile called — userId:', userId, 'email:', sessionUser?.email)

    // Concurrency guard: if already running, skip to prevent double-insert race condition.
    if (loadingProfileRef.current) {
      console.log('[Auth] loadProfile SKIPPED — already running')
      return
    }
    loadingProfileRef.current = true

    try {
      const user = sessionUser

      // Query user_profile with a 4-second timeout. On RLS circular-dependency or
      // network hang the Promise.race rejects; .catch resolves to { data: null }
      // so execution falls through to the fallback branch and the guard corrects
      // the role rather than returning early with no profile set.
      console.log('[Auth] querying user_profile — id:', userId)
      const { data: profileData, error: profileError } = await Promise.race([
        supabase
          .from('user_profile')
          .select('*, company(role_style, custom_titles, custom_ranks, name)')
          .eq('id', userId)
          .maybeSingle(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('user_profile query timed out')), 4000)
        ),
      ]).catch(err => {
        console.log('[Auth] user_profile query failed or timed out:', err?.message)
        return { data: null, error: { message: err?.message || 'timeout' } }
      })
      console.log('[Auth] user_profile result — data:', JSON.stringify(profileData), 'error:', profileError?.message ?? null)

      let profile = profileData
      let usedMetadataFallback = false

      // Helper: wraps any Supabase promise in a 4-second race identical to the primary
      // user_profile query above. On timeout, resolves to { data: null } so callers can
      // treat it the same as a missing row rather than throwing.
      function withTimeout(promise, label) {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} query timed out`)), 4000)
          ),
        ]).catch(err => {
          console.log(`[Auth] ${label} query failed or timed out:`, err?.message)
          return { data: null, error: { message: err?.message || 'timeout' } }
        })
      }

      if (profile) {
        // Backfill name from employee record if missing
        if (!profile.first_name && user?.email) {
          const { data: emp } = await withTimeout(
            supabase.from('employee')
              .select('first_name, last_name, company_id, role')
              .eq('email', user.email)
              .maybeSingle(),
            'employee name-backfill SELECT'
          )
          if (emp?.first_name) {
            withTimeout(
              supabase.from('user_profile').update({
                first_name: emp.first_name,
                last_name:  emp.last_name  || profile.last_name,
                company_id: emp.company_id || profile.company_id,
                role:       emp.role       || profile.role,
              }).eq('id', userId),
              'user_profile name-backfill UPDATE'
            ).catch(() => {})
            profile.first_name = emp.first_name
            profile.last_name  = emp.last_name  || profile.last_name
            if (emp.company_id && !profile.company_id) profile.company_id = emp.company_id
          }
        }

        // Guard: if company_id is still null, fetch from employee regardless of first_name
        if (!profile.company_id && user?.email) {
          console.log('[Auth] profile.company_id is null — querying employee for company_id')
          const { data: emp } = await withTimeout(
            supabase.from('employee')
              .select('company_id')
              .eq('email', user.email)
              .maybeSingle(),
            'employee company_id-backfill SELECT'
          )
          if (emp?.company_id) {
            console.log('[Auth] backfilling company_id from employee:', emp.company_id)
            withTimeout(
              supabase.from('user_profile').update({ company_id: emp.company_id }).eq('id', userId),
              'user_profile company_id-backfill UPDATE'
            ).catch(() => {})
            profile.company_id = emp.company_id
          }
        }

        // For returning users: check whether they still need to complete password setup.
        // Only password_set === false (strict) triggers the redirect — null means legacy
        // user (column didn't exist when they accepted), true means already completed.
        // Skipped on subsequent SIGNED_IN events (tab resume) once confirmed this session,
        // because it holds the Navigator lock for up to 4s on every visibility change.
        if (!passwordCheckedRef.current) {
          if (profile.role !== 'client') {
            const { data: pwRow } = await withTimeout(
              supabase.from('employee')
                .select('password_set')
                .eq('user_id', userId)
                .maybeSingle(),
              'employee password_set SELECT'
            )
            if (pwRow?.password_set === false) setNeedsPassword(true)
          } else {
            const { data: pwRow } = await withTimeout(
              supabase.from('client_contact')
                .select('password_set')
                .eq('portal_user_id', userId)
                .maybeSingle(),
              'client_contact password_set SELECT'
            )
            if (pwRow?.password_set === false) setNeedsPassword(true)
          }
          passwordCheckedRef.current = true
        }
      } else {
        // No profile row yet — look up employee by email for reliable data.
        // Each query uses withTimeout so a single hung call can't lock loadingProfileRef
        // forever. On any timeout we short-circuit to the metadata fallback immediately
        // rather than cascading into multiple sequential timeouts.

        const { data: emp } = await withTimeout(
          supabase.from('employee')
            .select('id, company_id, role, first_name, last_name, invitation_status')
            .eq('email', user?.email || '')
            .maybeSingle(),
          'employee SELECT'
        )

        if (emp) {
          const { data: created } = await withTimeout(
            supabase.from('user_profile')
              .insert({
                id:         userId,
                company_id: emp.company_id,
                role:       emp.role || 'officer',
                first_name: emp.first_name || '',
                last_name:  emp.last_name  || '',
              })
              .select('*, company(role_style, custom_titles, custom_ranks, name)')
              .single(),
            'user_profile INSERT (employee)'
          )

          if (created) {
            profile = created
            // Fresh acceptance: invitation_status was 'sent' before this first login.
            // Set password_set: false so the app forces /set-password before the dashboard.
            // Existing employees (invitation_status already 'accepted') are NOT affected.
            const isFreshAcceptance = emp.invitation_status === 'sent'
            // Fire-and-forget: don't let a slow UPDATE hold up profile resolution
            withTimeout(
              supabase.from('employee')
                .update({
                  has_app_access: true,
                  invitation_status: 'accepted',
                  user_id: userId,
                  ...(isFreshAcceptance ? { password_set: false } : {}),
                })
                .eq('id', emp.id),
              'employee UPDATE'
            ).catch(() => {})
            if (isFreshAcceptance) setNeedsPassword(true)
            passwordCheckedRef.current = true
          } else {
            // INSERT timed out or returned nothing — drop to metadata fallback
            usedMetadataFallback = true
          }
        } else {
          // No employee record — check if this is a client contact
          const { data: contact } = await withTimeout(
            supabase.from('client_contact')
              .select('id, client_id, company_id, full_name, invite_status')
              .eq('email', user?.email || '')
              .maybeSingle(),
            'client_contact SELECT'
          )

          if (contact) {
            const nameParts = (contact.full_name || '').trim().split(' ')
            const firstName = nameParts[0] || ''
            const lastName  = nameParts.slice(1).join(' ')
            const { data: created } = await withTimeout(
              supabase.from('user_profile')
                .insert({
                  id:         userId,
                  company_id: contact.company_id,
                  role:       'client',
                  first_name: firstName,
                  last_name:  lastName,
                })
                .select('*, company(role_style, custom_titles, custom_ranks, name)')
                .single(),
              'user_profile INSERT (client)'
            )

            if (created) {
              profile = created
              // Fresh acceptance: invite_status was null (never 'sent' in client flow)
              // before this first login. Set password_set: false to force /set-password.
              const isFreshClientAcceptance = contact.invite_status !== 'accepted'
              // Fire-and-forget: don't block on the contact update
              withTimeout(
                supabase.from('client_contact')
                  .update({
                    portal_user_id: userId,
                    invite_status: 'accepted',
                    ...(isFreshClientAcceptance ? { password_set: false } : {}),
                  })
                  .eq('id', contact.id),
                'client_contact UPDATE'
              ).catch(() => {})
              if (isFreshClientAcceptance) setNeedsPassword(true)
              passwordCheckedRef.current = true
            } else {
              // INSERT timed out or returned nothing — drop to metadata fallback
              usedMetadataFallback = true
            }
          } else {
            // No employee AND no client contact (or client_contact SELECT timed out)
            usedMetadataFallback = true
          }
        }

        if (usedMetadataFallback) {
          // Metadata fallback: build a minimal profile from auth user_metadata so the app
          // can render rather than hanging. The profile row insert is best-effort only.
          const meta = user?.user_metadata
          const fresh = {
            id:         userId,
            first_name: meta?.first_name || '',
            last_name:  meta?.last_name  || '',
            company_id: meta?.company_id || null,
            role:       meta?.role       || 'officer',
          }
          try {
            await withTimeout(
              supabase.from('user_profile').insert(fresh),
              'user_profile metadata-fallback INSERT'
            )
          } catch (e) {
            console.warn('[Auth] fallback profile insert failed (RLS may have blocked it):', e?.message)
          }
          profile = fresh
        }
      }

      // Last-resort guard: platform owner must always load as super_admin.
      // Fires when the RLS circular-dependency causes user_profile to return no rows,
      // pushing loadProfile into the fallback which assigns role 'officer'.
      if (profile && user?.email === 'justin.ashe@nationwidepolice.com' && profile.role !== 'super_admin') {
        console.log('[Auth] GUARD: correcting role to super_admin for platform owner')
        profile = { ...profile, role: 'super_admin', company_id: profile.company_id || NPS_COMPANY_ID }
        ;(async () => {
          try {
            await supabase.from('user_profile')
              .upsert({ id: userId, role: 'super_admin', company_id: NPS_COMPANY_ID }, { onConflict: 'id' })
          } catch (e) {
            console.warn('[Auth] profile upsert failed:', e?.message)
          }
        })()
      }

      // Merge custom ranks into ROLE_LEVELS so atLeast() and all level-based
      // checks work transparently for custom role slugs throughout the app.
      // Level 8 and other out-of-range values are handled correctly — the merge
      // is purely numeric and imposes no upper or lower bound on custom levels.
      const customRanks = profile?.company?.custom_ranks
      if (Array.isArray(customRanks)) {
        for (const rank of customRanks) {
          if (rank.slug && typeof rank.level === 'number') {
            ROLE_LEVELS[rank.slug] = rank.level
          }
        }
      }

      console.log('[Auth] setProfile — id:', profile?.id, 'company_id:', profile?.company_id, 'role:', profile?.role)
      setProfile(profile)
      if (profile?.id) profileUserIdRef.current = profile.id
      if (profile?.id && !usedMetadataFallback) {
        writeProfileCache(profile)
        setProfileConfirmed(true)
      }
      console.log('[Auth] profile set:', profile?.company_id)
      if (profile?.id) loadViewAs(profile.id)
    } catch (err) {
      console.error('[Auth] loadProfile error:', err)
    } finally {
      loadingProfileRef.current = false
      clearTimeout(loadingTimeoutRef.current)
      setLoading(false)
    }
  }

  // Keep ref in sync so visibilitychange handler sees current user without stale closure
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    // Hard timeout — if anything in the initial auth check hangs for 8 seconds,
    // force loading=false so the app falls through to the login screen instead of
    // spinning forever. Cleared in loadProfile's finally block on success.
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[Auth] ⚠ HARD TIMEOUT 8s fired — loadProfile did not complete in time, forcing signed-out state')
      setLoading(false)
      setUser(null)
      setProfile(null)
    }, 8000)

    // getSession() resolves from the stored token — no network call required.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[Auth] getSession — userId:', session?.user?.id || 'none', 'email:', session?.user?.email || 'none')
        if (session?.user) {
          setUser(session.user)
          const cached = readProfileCache(session.user.id)
          if (cached) {
            setProfile(cached)
            clearTimeout(loadingTimeoutRef.current)
            setLoading(false)
          }
          loadProfile(session.user.id, session.user)
        } else {
          console.log('[Auth] getSession: no active session found — clearing loading state, user lands on login screen')
          clearTimeout(loadingTimeoutRef.current)
          setLoading(false)
        }
      })
      .catch(() => {
        clearTimeout(loadingTimeoutRef.current)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        console.log('[Auth] SIGNED_OUT event fired — token refresh likely failed or signOut() called')
        setUser(null)
        setProfile(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        // If a valid profile is already loaded for this exact user, skip re-fetching entirely.
        // Supabase fires SIGNED_IN more than once per page load (stored-session restore +
        // token refresh); the second call would otherwise run the full query chain and time out.
        if (profileUserIdRef.current === session.user.id) {
          console.log('[Auth] SIGNED_IN suppressed — profile already loaded for userId:', session.user.id)
          setUser(session.user)
          return
        }

        // Deduplicate: Supabase fires SIGNED_IN both from onAuthStateChange and from
        // signInWithPassword's internal session write. Suppress if same userId fires
        // within 2 seconds of the first — the concurrency guard handles the rest.
        const now = Date.now()
        if (
          session.user.id === lastSignedInRef.current.userId &&
          now - lastSignedInRef.current.at < 2000
        ) {
          console.log('[Auth] SIGNED_IN duplicate suppressed — userId:', session.user.id)
          return
        }
        lastSignedInRef.current = { userId: session.user.id, at: now }

        console.log('[Auth] SIGNED_IN event — userId:', session.user.id, 'email:', session.user.email)
        setUser(session.user)
        await loadProfile(session.user.id, session.user)
        console.log('[Auth] SIGNED_IN — loadProfile resolved')

        // Belt-and-suspenders for magic link: only fires when invitation_status is still
        // 'sent' (fresh acceptance). The filter prevents this from overwriting password_set
        // on repeat logins where invitation_status is already 'accepted'.
        const meta = session.user.user_metadata
        if (meta?.company_id && session.user.email) {
          supabase.from('employee')
            .update({ has_app_access: true, invitation_status: 'accepted', password_set: false })
            .eq('email', session.user.email)
            .eq('company_id', meta.company_id)
            .eq('invitation_status', 'sent')
            .then(() => {}).catch(() => {})
        }
      } else if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
        // Silently update the user object with the refreshed token — no loading state change
        setUser(session.user)
      }
    })

    // Recover session silently when the tab becomes visible again.
    // Browsers throttle timers in background tabs so Supabase's auto-refresh
    // may not have fired; getSession() forces an immediate check.
    async function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
      } else if (userRef.current) {
        setUser(null)
        setProfile(null)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(loadingTimeoutRef.current)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    await loadProfile(data.user.id, data.user)
    // Register Capacitor push notifications (native only)
    registerPushNotifications(data.user.id, supabase).catch(() => {})
    // Request push permission — web VAPID path + native APNs path
    setTimeout(async () => {
      try {
        await requestPushPermission()
        const perm = await requestNotificationPermission()
        if (perm === 'granted') {
          const sub = await subscribeToPush()
          if (sub) {
            const empRes = await supabase.from('employee').select('id,company_id').eq('user_id', data.user.id).single()
            if (empRes.data) {
              await supabase.from('push_subscription').upsert({
                employee_id: empRes.data.id,
                company_id:  empRes.data.company_id,
                subscription_json: sub,
                active: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'employee_id' })
            }
          }
        }
      } catch {}
    }, 2000)
    return data
  }

  async function signOut() {
    if (profile?.id) localStorage.removeItem(`pc-profile-${profile.id}`)
    if (profile?.id) localStorage.removeItem(`pc-viewas-${profile.id}`)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setViewRoleState(null)
    setNeedsPassword(false)
    passwordCheckedRef.current = false
    profileUserIdRef.current = null
    setProfileConfirmed(false)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, profileConfirmed,
      signIn, signOut,
      role: profile?.role,
      effectiveRole,
      viewRole,
      switchViewAs,
      exitViewAs,
      companyId: profile?.company_id,
      isNPS,
      isAuthenticated: !!user,
      needsPassword,
      onPasswordSet: () => setNeedsPassword(false),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
