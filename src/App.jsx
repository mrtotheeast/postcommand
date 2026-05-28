import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B1F3A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Bebas Neue, sans-serif',
      fontSize: '24px',
      color: '#c9a227',
      letterSpacing: '3px'
    }}>
      LOADING...
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B1F3A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Bebas Neue, sans-serif',
      fontSize: '24px',
      color: '#c9a227',
      letterSpacing: '3px'
    }}>
      LOADING...
    </div>
  )

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div style={{
              minHeight: '100vh',
              backgroundColor: '#0B1F3A',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '32px',
              letterSpacing: '3px'
            }}>
              DASHBOARD — COMING SOON
            </div>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}