import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import PrivacyBanner from './components/ui/PrivacyBanner'
import Login from './pages/auth/Login'
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
import Archived from './pages/archived/Archived'
import SuperAdmin from './pages/admin/SuperAdmin'
import More from './pages/more/More'
import Help from './pages/help/Help'
import PerformanceReviews from './pages/reviews/PerformanceReviews'
import ClientManagement from './pages/clients/ClientManagement'

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
export default function App() {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  return (
    <>
    <PrivacyBanner />
    <Routes>
      <Route path="/reciprocity" element={<CCWMap />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={role === 'client' ? '/portal' : '/dashboard'} replace /> : <Login />} />
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
      <Route path="/archived"   element={<ProtectedRoute><Archived /></ProtectedRoute>} />
      <Route path="/admin"      element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
      <Route path="/more"       element={<ProtectedRoute><More /></ProtectedRoute>} />
      <Route path="/reviews"    element={<ProtectedRoute><PerformanceReviews /></ProtectedRoute>} />
      <Route path="/clients"    element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
      <Route path="/help"       element={<ProtectedRoute><Help /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  )
}
