import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
const NotificationContext = createContext(null)
const DEFAULT_BADGES = { open_incidents:0, pending_timesheets:0, unread_messages:0, pending_schedules:0, pending_invoices:0, pending_uniforms:0 }
export function NotificationProvider({ children }) {
  const { user, profile } = useAuth()
  const [badges, setBadges] = useState(DEFAULT_BADGES)
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pc-sound') !== 'false')
  const totalUnread = Object.values(badges).reduce((a, b) => a + b, 0)
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random()
    setNotifications(prev => [{ id, ...notification, timestamp: new Date() }, ...prev].slice(0, 50))
  }, [])
  function markRead(id) { setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)) }
  function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }
  function incrementBadge(key) { setBadges(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 })) }
  function clearBadge(key) { setBadges(prev => ({ ...prev, [key]: 0 })) }
  function toggleSound() { setSoundEnabled(prev => { localStorage.setItem('pc-sound', String(!prev)); return !prev }) }
  return (
    <NotificationContext.Provider value={{ badges, notifications, totalUnread, soundEnabled, addNotification, markRead, markAllRead, incrementBadge, clearBadge, toggleSound }}>
      {children}
    </NotificationContext.Provider>
  )
}
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
