import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
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
  const userRef          = useRef(null)
  const loadingTimeoutRef = useRef(null)
  const loadingProfileRef = useRef(false)                        // concurrency guard
  const lastSignedInRef   = useRef({ userId: null, at: 0 })     // deduplication

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

      if (profile) {
        // Backfill name from employee record if missing
        if (!profile.first_name && user?.email) {
          const { data: emp } = await supabase
            .from('employee')
            .select('first_name, last_name, company_id, role')
            .eq('email', user.email)
            .maybeSingle()
          if (emp?.first_name) {
            await supabase.from('user_profile').update({
              first_name: emp.first_name,
              last_name:  emp.last_name  || profile.last_name,
              company_id: emp.company_id || profile.company_id,
              role:       emp.role       || profile.role,
            }).eq('id', userId)
            profile.first_name = emp.first_name
            profile.last_name  = emp.last_name  || profile.last_name
            if (emp.company_id && !profile.company_id) profile.company_id = emp.company_id
          }
        }

        // Guard: if company_id is still null, fetch from employee regardless of first_name
        if (!profile.company_id && user?.email) {
          console.log('[Auth] profile.company_id is null — querying employee for company_id')
          const { data: emp } = await supabase
            .from('employee')
            .select('company_id')
            .eq('email', user.email)
            .maybeSingle()
          if (emp?.company_id) {
            console.log('[Auth] backfilling company_id from employee:', emp.company_id)
            await supabase.from('user_profile').update({ company_id: emp.company_id }).eq('id', userId)
            profile.company_id = emp.company_id
          }
        }
      } else {
        // No profile row yet — look up employee by email for reliable data
        const { data: emp } = await supabase
          .from('employee')
          .select('id, company_id, role, first_name, last_name')
          .eq('email', user?.email || '')
          .maybeSingle()

        if (emp) {
          const { data: created } = await supabase
            .from('user_profile')
            .insert({
              id:         userId,
              company_id: emp.company_id,
              role:       emp.role || 'officer',
              first_name: emp.first_name || '',
              last_name:  emp.last_name  || '',
            })
            .select('*, company(role_style, custom_titles, custom_ranks, name)')
            .single()
          profile = created

          // Link auth user to employee record and mark app access
          await supabase.from('employee')
            .update({ has_app_access: true, invitation_status: 'accepted', user_id: userId })
            .eq('id', emp.id)
        } else {
          // No employee record — check if this is a client contact
          const { data: contact } = await supabase
            .from('client_contact')
            .select('id, client_id, company_id, full_name')
            .eq('email', user?.email || '')
            .maybeSingle()

          if (contact) {
            const nameParts = (contact.full_name || '').trim().split(' ')
            const firstName = nameParts[0] || ''
            const lastName  = nameParts.slice(1).join(' ')
            const { data: created } = await supabase
              .from('user_profile')
              .insert({
                id:         userId,
                company_id: contact.company_id,
                role:       'client',
                first_name: firstName,
                last_name:  lastName,
              })
              .select('*, company(role_style, custom_titles, custom_ranks, name)')
              .single()
            profile = created
            await supabase.from('client_contact')
              .update({ portal_user_id: userId, invite_status: 'accepted' })
              .eq('id', contact.id)
          } else {
            // No employee AND no client contact — fall back to auth metadata
            const meta = user?.user_metadata
            const fresh = {
              id:         userId,
              first_name: meta?.first_name || '',
              last_name:  meta?.last_name  || '',
              company_id: meta?.company_id || null,
              role:       meta?.role       || 'officer',
            }
            try {
              await supabase.from('user_profile').insert(fresh)
            } catch (e) {
              console.warn('[Auth] fallback profile insert failed (RLS may have blocked it):', e?.message)
            }
            profile = fresh
          }
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

      console.log('[Auth] setProfile — id:', profile?.id, 'company_id:', profile?.company_id, 'role:', profile?.role)
      setProfile(profile)
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
          loadProfile(session.user.id, session.user)
        } else {
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
        setUser(null)
        setProfile(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
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

        // On magic link login: mark employee record as having app access
        const meta = session.user.user_metadata
        if (meta?.company_id && session.user.email) {
          supabase.from('employee')
            .update({ has_app_access: true, invitation_status: 'accepted' })
            .eq('email', session.user.email)
            .eq('company_id', meta.company_id)
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
    if (profile?.id) localStorage.removeItem(`pc-viewas-${profile.id}`)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setViewRoleState(null)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut,
      role: profile?.role,
      effectiveRole,
      viewRole,
      switchViewAs,
      exitViewAs,
      companyId: profile?.company_id,
      isNPS,
      isAuthenticated: !!user
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
