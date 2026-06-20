import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function SetPassword() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const { user, profile, role, onPasswordSet } = useAuth()
  const navigate = useNavigate()

  const inp = {
    width: '100%', padding: '12px 16px',
    background: '#f8f9fa', border: '1px solid #e2e6ea', borderRadius: '8px',
    color: '#0d0f14', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Barlow', sans-serif",
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password })
      if (authErr) throw authErr

      // Mark password_set = true on the source record so the redirect clears
      const email = user?.email
      const companyId = profile?.company_id
      if (email && companyId) {
        if (role !== 'client') {
          await supabase.from('employee')
            .update({ password_set: true })
            .eq('email', email)
            .eq('company_id', companyId)
        } else {
          await supabase.from('client_contact')
            .update({ password_set: true })
            .eq('email', email)
            .eq('company_id', companyId)
        }
      }

      onPasswordSet()
      navigate(role === 'client' ? '/portal' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Barlow', sans-serif" }}>

      {/* Left panel — matches Login.jsx */}
      <div style={{
        width: '42%', flexShrink: 0,
        background: '#0a0c10',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(201,162,39,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '320px', width: '100%', textAlign: 'center' }}>
          <img src="/app-icon-transparent.png" alt="PostCommand" style={{ width: '120px', height: '120px', objectFit: 'contain', marginBottom: '24px' }}/>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '4px', color: '#c8a84b', lineHeight: 1, marginBottom: '4px' }}>
            POST<span style={{ color: '#ffffff' }}>COMMAND</span>
          </div>
          <div style={{ fontSize: '11px', color: '#5a6070', letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '40px' }}>
            Security Workforce Management
          </div>
          <div style={{ background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)', borderRadius: '10px', padding: '20px 24px', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', color: '#c8a84b', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '10px' }}>One-time setup</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
              For your security, all invited accounts must create a personal password before accessing the platform.
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '2px', color: '#0d0f14', margin: '0 0 6px' }}>
            CREATE YOUR PASSWORD
          </h2>
          <p style={{ fontSize: '13px', color: '#8899aa', margin: '0 0 32px', lineHeight: 1.5 }}>
            Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}. Choose a strong password to secure your account.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', color: '#495057', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                style={inp}
                onFocus={e => e.target.style.borderColor = '#c8a84b'}
                onBlur={e  => e.target.style.borderColor = '#e2e6ea'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#495057', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                style={inp}
                onFocus={e => e.target.style.borderColor = '#c8a84b'}
                onBlur={e  => e.target.style.borderColor = '#e2e6ea'}
              />
            </div>

            {error && (
              <div style={{ background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '8px', padding: '11px 14px', color: '#c0392b', fontSize: '13px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#e8d98a' : '#c8a84b',
                color: '#0d0f14', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 700,
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 150ms ease',
              }}
            >
              {loading ? 'SAVING...' : 'SET PASSWORD & CONTINUE'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#c0c8d0', marginTop: '24px', lineHeight: 1.5 }}>
            This is a one-time step. You will use this password for all future logins.
          </p>
        </div>
      </div>
    </div>
  )
}
