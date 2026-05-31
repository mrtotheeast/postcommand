import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0B1F3A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Barlow, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a2b4a',
        borderRadius: '12px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '36px',
            color: '#c9a227',
            letterSpacing: '3px',
            margin: 0
          }}>
            POST<span style={{ color: '#ffffff' }}>COMMAND</span>
          </h1>
          <p style={{
            color: '#8899aa',
            fontSize: '13px',
            marginTop: '6px',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            Security Workforce Management
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#8899aa',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0B1F3A',
                border: '1px solid #2a3d5a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#c9a227'}
              onBlur={e => e.target.style.borderColor = '#2a3d5a'}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              color: '#8899aa',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0B1F3A',
                border: '1px solid #2a3d5a',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#c9a227'}
              onBlur={e => e.target.style.borderColor = '#2a3d5a'}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(176,48,48,0.2)',
              border: '1px solid #b03030',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#ff6b6b',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#7a6218' : '#c9a227',
              color: '#0B1F3A',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '700',
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <a
            href="/reciprocity"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#c9a227',
              fontSize: '12px',
              textDecoration: 'none',
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '0.5px',
              opacity: 0.8,
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
          >
            🗺 View CCW Reciprocity Map — All 50 States (No login required)
          </a>
        </div>

        <p style={{
          textAlign: 'center',
          color: '#4a5568',
          fontSize: '12px',
          marginTop: '16px'
        }}>
          © 2026 PostCommand · Powered by Nationwide Police Services LLC
        </p>
      </div>
    </div>
  )
}