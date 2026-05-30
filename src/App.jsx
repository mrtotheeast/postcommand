import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import Dashboard from './pages/dashboard/Dashboard'
import Personnel from './pages/personnel/Personnel'
import Scheduling from './pages/scheduling/Scheduling'
import ClockIn from './pages/clockin/clockin'
import Incidents from './pages/incidents/Incidents'


function ComingSoon({ name }) {
  return <div style={{padding:'40px 24px',fontFamily:'var(--font-display)',fontSize:'24px',letterSpacing:'2px',color:'var(--accent)'}}>{name.toUpperCase()} — COMING SOON</div>
}
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}
export default function App() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <div style={{minHeight:'100vh',backgroundColor:'var(--bg-base)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontSize:'22px',color:'var(--accent)',letterSpacing:'3px'}}>LOADING...</div>
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/personnel"  element={<ProtectedRoute><Personnel /></ProtectedRoute>} />
      <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
      <Route path="/timesheets" element={<ProtectedRoute><ComingSoon name="Timesheets" /></ProtectedRoute>} />
      <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
      <Route path="/map"        element={<ProtectedRoute><ComingSoon name="Live Map" /></ProtectedRoute>} />
      <Route path="/patrol"     element={<ProtectedRoute><ComingSoon name="Patrol Logs" /></ProtectedRoute>} />
      <Route path="/clockin" element={<ProtectedRoute><ClockIn /></ProtectedRoute>} />
      <Route path="/hr"         element={<ProtectedRoute><ComingSoon name="HR & Documents" /></ProtectedRoute>} />
      <Route path="/invoices"   element={<ProtectedRoute><ComingSoon name="Invoices" /></ProtectedRoute>} />
      <Route path="/uniforms"   element={<ProtectedRoute><ComingSoon name="Uniforms" /></ProtectedRoute>} />
      <Route path="/messaging"  element={<ProtectedRoute><ComingSoon name="Messaging" /></ProtectedRoute>} />
      <Route path="/settings"   element={<ProtectedRoute><ComingSoon name="Settings" /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
