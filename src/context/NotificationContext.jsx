import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { INCIDENT_STATUSES, TIMESHEET_STATUSES, INVOICE_STATUSES } from '../lib/constants'

const NotificationContext = createContext(null)

const DEFAULT_BADGES = { open_incidents:0, pending_timesheets:0, unread_messages:0, pending_schedules:0, pending_invoices:0, pending_uniforms:0, active_sos:0, pending_training:0 }

export function NotificationProvider({ children }) {
  const { user, profile } = useAuth()
  const [badges, setBadges]             = useState(DEFAULT_BADGES)
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pc-sound') !== 'false')

  const totalUnread = notifications.filter(n => !n.read).length

  // Load notifications from DB on mount / profile change
  useEffect(() => {
    if (!profile?.company_id) return
    loadFromDB()
  }, [profile?.company_id])

  async function loadFromDB() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setNotifications(data)
    } catch(e) {}

    try {
      const { count } = await supabase
        .from('incident_report')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .in('status', [INCIDENT_STATUSES.SUBMITTED, INCIDENT_STATUSES.REVIEWED])
      setBadges(prev => ({ ...prev, open_incidents: count || 0 }))
    } catch(e) {}

    try {
      const { count } = await supabase
        .from('timesheet')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', TIMESHEET_STATUSES.PENDING)
      setBadges(prev => ({ ...prev, pending_timesheets: count || 0 }))
    } catch(e) {}

    try {
      const { count } = await supabase
        .from('invoice')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .not('status', 'in', `(${INVOICE_STATUSES.PAID},${INVOICE_STATUSES.VOID},${INVOICE_STATUSES.CANCELLED})`)
      setBadges(prev => ({ ...prev, pending_invoices: count || 0 }))
    } catch(e) {}
  }

  async function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    if (profile?.company_id) {
      await supabase.from('notifications').update({ read: true }).eq('company_id', profile.company_id).eq('read', false)
    }
  }

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random()
    setNotifications(prev => [{ id, ...notification, read: false, created_at: new Date().toISOString() }, ...prev].slice(0, 50))
  }, [])

  function incrementBadge(key) { setBadges(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 })) }
  function clearBadge(key)     { setBadges(prev => ({ ...prev, [key]: 0 })) }
  function toggleSound()       { setSoundEnabled(prev => { localStorage.setItem('pc-sound', String(!prev)); return !prev }) }

  return (
    <NotificationContext.Provider value={{
      badges, notifications, totalUnread, soundEnabled,
      addNotification, markRead, markAllRead, incrementBadge, clearBadge, toggleSound,
      refreshNotifications: loadFromDB,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
