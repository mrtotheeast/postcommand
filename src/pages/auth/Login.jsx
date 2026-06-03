import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isNative } from '../../lib/platform'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [hasSavedSession,     setHasSavedSession]     = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const { signIn }  = useAuth()
  const navigate    = useNavigate()

  useEffect(() => {
    async function checkBiometrics() {
      if (!isNative()) return
      try {
        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
        const result = await BiometricAuth.checkBiometry()
        setBiometricsAvailable(result.isAvailable)
        const savedEmail = localStorage.getItem('pc-last-email')
        setHasSavedSession(!!savedEmail)
        // Pre-fill email for UX
        if (savedEmail) setEmail(savedEmail)
      } catch {}
    }
    checkBiometrics()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      // Save credentials for biometric re-auth
      if (isNative()) {
        localStorage.setItem('pc-last-email', email)
        localStorage.setItem('pc-last-pass', password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loginWithBiometrics() {
    setBioLoading(true); setError(null)
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
      await BiometricAuth.authenticate({
        reason: 'Sign in to PostCommand',
        cancelTitle: 'Use Password',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Use Password',
      })
      const savedEmail = localStorage.getItem('pc-last-email')
      const savedPass  = localStorage.getItem('pc-last-pass')
      if (savedEmail && savedPass) {
        await signIn(savedEmail, savedPass)
        navigate('/dashboard')
      } else {
        setError('No saved credentials — please sign in with your password first.')
      }
    } catch (err) {
      if (err?.code !== 'biometryNotAvailable' && err?.message !== 'User cancelled') {
        setError('Biometric sign-in failed. Please use your password.')
      }
    } finally {
      setBioLoading(false)
    }
  }

  const inp = {
    width: '100%', padding: '12px 16px',
    background: '#f8f9fa', border: '1px solid #e2e6ea', borderRadius: '8px',
    color: '#0d0f14', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Barlow, sans-serif', transition: 'border-color 150ms ease',
  }

  const showBioBtn = isNative() && biometricsAvailable && hasSavedSession

  return (
    <div style={{ minHeight:'100vh', backgroundColor:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Barlow, sans-serif', padding:'20px' }}>
      <div style={{ backgroundColor:'#ffffff', borderRadius:'12px', padding:'48px', width:'100%', maxWidth:'420px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', border:'1px solid #e2e6ea' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <h1 style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'36px', color:'#0d0f14', letterSpacing:'3px', margin:0 }}>
            POST<span style={{ color:'#c8a84b' }}>COMMAND</span>
          </h1>
          <p style={{ color:'#495057', fontSize:'13px', marginTop:'6px', letterSpacing:'1px', textTransform:'uppercase' }}>
            Security Workforce Management
          </p>
        </div>

        {/* Biometric sign-in button — native only, shown when available */}
        {showBioBtn && (
          <button
            onClick={loginWithBiometrics} disabled={bioLoading}
            style={{ width:'100%', padding:'14px', background: bioLoading ? '#f0f0f0' : '#0d0f14', color:'#c8a84b', border:'1px solid #333', borderRadius:'8px', fontSize:'15px', fontWeight:700, fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'1px', textTransform:'uppercase', cursor: bioLoading ? 'not-allowed' : 'pointer', transition:'background 150ms ease', marginBottom:'20px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}
          >
            <span style={{ fontSize:'20px' }}>🔒</span>
            {bioLoading ? 'Authenticating...' : 'Sign In with Face ID'}
          </button>
        )}

        {showBioBtn && (
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
            <div style={{ flex:1, height:'1px', background:'#e2e6ea' }}/>
            <span style={{ color:'#8899aa', fontSize:'12px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px' }}>OR USE PASSWORD</span>
            <div style={{ flex:1, height:'1px', background:'#e2e6ea' }}/>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:'20px' }}>
            <label style={{ display:'block', color:'#495057', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px', fontFamily:'Barlow Condensed, sans-serif' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={inp}
              onFocus={e => e.target.style.borderColor = '#c8a84b'}
              onBlur={e  => e.target.style.borderColor = '#e2e6ea'}
            />
          </div>

          <div style={{ marginBottom:'28px' }}>
            <label style={{ display:'block', color:'#495057', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px', fontFamily:'Barlow Condensed, sans-serif' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={inp}
              onFocus={e => e.target.style.borderColor = '#c8a84b'}
              onBlur={e  => e.target.style.borderColor = '#e2e6ea'}
            />
          </div>

          {error && (
            <div style={{ background:'#fff3f3', border:'1px solid #ffcccc', borderRadius:'8px', padding:'12px 16px', color:'#c0392b', fontSize:'14px', marginBottom:'20px' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{ width:'100%', padding:'14px', background: loading ? '#e8d98a' : '#c8a84b', color:'#0d0f14', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:700, fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'1px', textTransform:'uppercase', cursor: loading ? 'not-allowed' : 'pointer', transition:'background 150ms ease' }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* CCW Map link */}
        <div style={{ textAlign:'center', marginTop:'24px' }}>
          <a
            href="/reciprocity" target="_blank" rel="noopener noreferrer"
            style={{ color:'#c8a84b', fontSize:'12px', textDecoration:'none', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px', display:'inline-flex', alignItems:'center', gap:'6px', opacity:0.8, transition:'opacity 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.opacity='1'}
            onMouseLeave={e => e.currentTarget.style.opacity='0.8'}
          >
            🗺 View CCW Reciprocity Map — All 50 States (No login required)
          </a>
        </div>

        <p style={{ textAlign:'center', color:'#8899aa', fontSize:'12px', marginTop:'24px' }}>
          © 2026 PostCommand · Powered by Nationwide Police Services LLC
        </p>
      </div>
    </div>
  )
}
