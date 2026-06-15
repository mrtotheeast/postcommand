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
  const userRef = useRef(null)
  const loadingTimeoutRef = useRef(null)

  // Load persisted viewAs when profile is set
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
    try {
      // Use the already-resolved session user — avoids a getUser() network call
      // that can hang on hard refresh and leave loading=true forever.
      const user = sessionUser

      let { data: profile } = await supabase
        .from('user_profile')
        .select('*, company(role_style, custom_titles, custom_ranks, name)')
        .eq('id', userId)
        .single()

      console.log('[Auth] user_profile row:', JSON.stringify(profile))

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

        // Guard: if company_id is still null, fetch it from employee regardless of first_name
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
          // No employee record — fall back to auth metadata
          const meta = user?.user_metadata
          const fresh = {
            id:         userId,
            first_name: meta?.first_name || '',
            last_name:  meta?.last_name  || '',
            company_id: meta?.company_id || null,
            role:       meta?.role       || 'officer',
          }
          await supabase.from('user_profile').insert(fresh)
          profile = fresh
        }
      }

      console.log('[Auth] setProfile — id:', profile?.id, 'company_id:', profile?.company_id, 'role:', profile?.role, 'full:', JSON.stringify(profile))
      setProfile(profile)
      if (profile?.id) loadViewAs(profile.id)
    } catch (err) {
      console.error('[Auth] loadProfile error:', err)
    } finally {
      clearTimeout(loadingTimeoutRef.current)
      setLoading(false)
    }
  }

  // Keep ref in sync so visibilitychange handler sees current user without stale closure
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    // Hard timeout — if anything in the initial auth check hangs for 8 seconds,
    // force loading=false so the app falls through to the login screen instead of
    // spinning forever. Cleared immediately in loadProfile's finally block on success.
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setUser(null)
      setProfile(null)
    }, 8000)

    // getSession() resolves from the stored token — no network call required.
    // getUser() would make a network round-trip that can hang on hard refresh.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[Auth] getSession result — userId:', session?.user?.id || 'none', 'email:', session?.user?.email || 'none')
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
    // Browsers throttle timers in background tabs so the Supabase auto-refresh
    // may not have fired; calling getSession() forces an immediate check.
    async function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
      } else if (userRef.current) {
        // Session expired while the tab was hidden — clear auth state
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
        // Native iOS: use Capacitor PushNotifications
        await requestPushPermission()
        // Web: use existing VAPID flow
        const perm = await requestNotificationPermission()
        if (perm === 'granted') {
          const sub = await subscribeToPush()
          if (sub) {
            const empRes = await supabase.from('employee').select('id,company_id').eq('user_id', data.user.id).single()
            if (empRes.data) {
              await supabase.from('push_subscription').upsert({
                employee_id: empRes.data.id,
                company_id: empRes.data.company_id,
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
