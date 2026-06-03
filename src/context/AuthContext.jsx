import { createContext, useContext, useEffect, useState } from 'react'
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

  function loadProfile(userId) {
    return supabase
      .from('user_profile')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setProfile(data)
        if (data?.id) loadViewAs(data.id)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    await loadProfile(data.user.id)
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
