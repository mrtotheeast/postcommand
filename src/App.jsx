import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { GuidedTour } from './components/ui/GuidedTour'
import { supabase } from './lib/supabase'
import { isNative } from './lib/platform'
import AppLayout from './components/layout/AppLayout'
import PrivacyBanner from './components/ui/PrivacyBanner'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/dashboard/Dashboard'
import Personnel from './pages/personnel/Personnel'
import Scheduling from './pages/scheduling/Scheduling'
import Timesheets from './pages/timesheets/Timesheets'
import ClockIn from './pages/clockin/clockin'
import Incidents from './pages/incidents/Incidents'
import Messaging from './pages/messaging/Messaging'
import Settings from './pages/settings/Settings'
import LiveMap from './pages/map/LiveMap'
import SOS from './pages/sos/SOS'
import HR from './pages/hr/HR'
import SiteManagement from './pages/sites/SiteManagement'
import ClientPortal from './pages/client/ClientPortal'
import PatrolLogs from './pages/patrol/PatrolLogs'
import InvoicesPage from './pages/invoices/Invoices'
import UniformsPage from './pages/uniforms/Uniforms'
import Reports from './pages/reports/Reports'
import Training from './pages/training/Training'
import CCWMap from './pages/ccw/CCWMap'
import Billing from './pages/billing/Billing'
import DAR from './pages/dar/DAR'
import CompanySettings from './pages/settings/CompanySettings'
import Inbox from './pages/inbox/Inbox'
import Archived from './pages/archived/Archived'
import SuperAdmin from './pages/admin/SuperAdmin'
import More from './pages/more/More'
import Help from './pages/help/Help'
import AuditLog from './pages/audit/AuditLog'
import Payroll from './pages/payroll/Payroll'
import PerformanceReviews from './pages/reviews/PerformanceReviews'
import ClientManagement from './pages/clients/ClientManagement'
import Features from './pages/features/Features'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import Support from './pages/legal/Support'

function ComingSoon({ name }) {
  return <div style={{padding:'40px 24px',fontFamily:'var(--font-display)',fontSize:'24px',letterSpacing:'2px',color:'var(--accent)'}}>{name.toUpperCase()} — COMING SOON</div>
}
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role === 'client') return <Navigate to="/portal" replace />
  return <AppLayout>{children}</AppLayout>
}
function ClientRoute({ children }) {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
// Handles the OAuth deep link redirect on native iOS
// When the user completes Apple/Google OAuth in the system browser,
// iOS redirects to postcommand://auth which triggers this listener.
function OAuthCallbackHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative()) return
    let appListener
    async function setup() {
      try {
        const { App } = await import('@capacitor/app')
        const { Browser } = await import('@capacitor/browser')
        appListener = await App.addListener('appUrlOpen', async ({ url }) => {
          if (!url.startsWith('postcommand://auth')) return
          // Close the system browser
          await Browser.close().catch(() => {})
          // Exchange the OAuth token — Supabase reads the hash/params from the URL
          const { data, error } = await supabase.auth.getSessionFromUrl({ url })
          if (data?.session) {
            navigate('/dashboard', { replace: true })
          }
        })
      } catch {}
    }
    setup()
    return () => { appListener?.remove?.() }
  }, [navigate])
  return null
}

// Simple callback page for web OAuth redirect
function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    // Supabase auth state listener in AuthContext picks up the session automatically.
    // Just redirect to dashboard after a brief moment.
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 500)
    return () => clearTimeout(t)
  }, [navigate])
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Barlow Condensed, sans-serif', fontSize:'20px', letterSpacing:'2px', color:'#c8a84b', background:'#0d0f14' }}>
      SIGNING IN...
    </div>
  )
}

export default function App() {
  const { isAuthenticated, loading, role, profile } = useAuth()
  const [showTour, setShowTour] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    const seen  = localStorage.getItem(`pc-tour-seen-${profile.id}`)
    const never = localStorage.getItem(`pc-tour-never-${profile.id}`)
    if (!seen && !never) setShowTour(true)
  }, [profile?.id])

  useEffect(() => {
    const handler = () => setShowTour(true)
    window.addEventListener('start-tour', handler)
    return () => window.removeEventListener('start-tour', handler)
  }, [])

  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  return (
    <>
    {showTour && profile && <GuidedTour profile={profile} onDone={() => setShowTour(false)} />}
    <OAuthCallbackHandler />
    <PrivacyBanner />
    <Routes>
      <Route path="/reciprocity" element={<CCWMap />} />
      <Route path="/features"    element={<Features />} />
      <Route path="/privacy"     element={<PrivacyPolicy />} />
      <Route path="/terms"       element={<TermsOfService />} />
      <Route path="/support"     element={<Support />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/login"    element={isAuthenticated ? <Navigate to={role === 'client' ? '/portal' : '/dashboard'} replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/portal" element={<ClientRoute><ClientPortal /></ClientRoute>} />
      <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/personnel"  element={<ProtectedRoute><Personnel /></ProtectedRoute>} />
      <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
      <Route path="/timesheets" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/map"        element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />
      <Route path="/patrol"     element={<ProtectedRoute><PatrolLogs /></ProtectedRoute>} />
      <Route path="/training"   element={<ProtectedRoute><Training /></ProtectedRoute>} />
      <Route path="/clockin" element={<ProtectedRoute><ClockIn /></ProtectedRoute>} />
      <Route path="/sos"     element={<ProtectedRoute><SOS /></ProtectedRoute>} />
      <Route path="/sites"      element={<ProtectedRoute><SiteManagement /></ProtectedRoute>} />
      <Route path="/hr"         element={<ProtectedRoute><HR /></ProtectedRoute>} />
      <Route path="/invoices"   element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
      <Route path="/uniforms"   element={<ProtectedRoute><UniformsPage /></ProtectedRoute>} />
      <Route path="/reports"    element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/messaging" element={<ProtectedRoute><Messaging /></ProtectedRoute>} />
      <Route path="/settings"   element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/billing"    element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/settings/company" element={<ProtectedRoute><CompanySettings /></ProtectedRoute>} />
      <Route path="/dar"        element={<ProtectedRoute><DAR /></ProtectedRoute>} />
      <Route path="/inbox"      element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
      <Route path="/archived"   element={<ProtectedRoute><Archived /></ProtectedRoute>} />
      <Route path="/admin"      element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
      <Route path="/more"       element={<ProtectedRoute><More /></ProtectedRoute>} />
      <Route path="/reviews"    element={<ProtectedRoute><PerformanceReviews /></ProtectedRoute>} />
      <Route path="/clients"    element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
      <Route path="/help"       element={<ProtectedRoute><Help /></ProtectedRoute>} />
      <Route path="/audit"      element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/payroll"    element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  )
}
