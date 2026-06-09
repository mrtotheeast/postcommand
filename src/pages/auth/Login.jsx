import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isNative } from '../../lib/platform'

// Redirect URL used for both native deep link and web
const OAUTH_REDIRECT = isNative()
  ? 'postcommand://auth'
  : `${window.location.origin}/auth/callback`

function ForgotPasswordView({ onBack }) {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function sendReset() {
    if (!email.trim()) { setError('Email required.'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://postcommand.app/reset-password'
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontSize:'32px', marginBottom:'16px' }}>✓</div>
      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'18px', letterSpacing:'2px', color:'#c8a84b', marginBottom:'12px' }}>CHECK YOUR EMAIL</div>
      <div style={{ fontSize:'13px', color:'#8899aa', marginBottom:'24px', lineHeight:1.6 }}>
        A password reset link has been sent to {email}. Check your inbox and follow the instructions.
      </div>
      <button onClick={onBack} style={{ background:'transparent', border:'none', color:'#c8a84b', cursor:'pointer', fontSize:'13px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'1px' }}>
        BACK TO LOGIN
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'20px', letterSpacing:'2px', color:'#0d0f14', marginBottom:'8px' }}>RESET PASSWORD</div>
      <div style={{ fontSize:'13px', color:'#8899aa', marginBottom:'24px' }}>Enter your email and we'll send you a reset link.</div>
      {error && (
        <div style={{ background:'#fff3f3', border:'1px solid #ffcccc', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#c0392b', marginBottom:'14px' }}>{error}</div>
      )}
      <div style={{ marginBottom:'16px' }}>
        <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendReset()}
          style={{ width:'100%', padding:'12px 16px', background:'#f8f9fa', border:'1px solid #e2e6ea', borderRadius:'8px', color:'#0d0f14', fontSize:'15px', outline:'none', boxSizing:'border-box', fontFamily:'Barlow, sans-serif' }}
          onFocus={e => e.target.style.borderColor = '#c8a84b'}
          onBlur={e  => e.target.style.borderColor = '#e2e6ea'}
        />
      </div>
      <button onClick={sendReset} disabled={loading}
        style={{ width:'100%', height:'48px', background: loading ? '#e8d98a' : '#c8a84b', border:'none', borderRadius:'8px', color:'#0d0f14', fontFamily:'Barlow Condensed, sans-serif', fontSize:'14px', fontWeight:700, letterSpacing:'2px', cursor: loading ? 'not-allowed' : 'pointer', marginBottom:'16px' }}>
        {loading ? 'SENDING...' : 'SEND RESET LINK'}
      </button>
      <button onClick={onBack}
        style={{ width:'100%', background:'transparent', border:'none', color:'#8899aa', cursor:'pointer', fontSize:'13px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'1px' }}>
        BACK TO LOGIN
      </button>
    </div>
  )
}

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null) // 'google' | 'apple'
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [hasSavedSession,     setHasSavedSession]     = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [showReset, setShowReset]   = useState(false)
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
        if (savedEmail) setEmail(savedEmail)
      } catch {}
    }
    checkBiometrics()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await signIn(email, password)
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

  async function signInWithProvider(provider) {
    setError(null); setOauthLoading(provider)
    try {
      if (isNative()) {
        // Native: get URL, open in system browser, deep link returns to app
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { skipBrowserRedirect: true, redirectTo: OAUTH_REDIRECT }
        })
        if (error) throw error
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.url })
        // The App.addListener('appUrlOpen') in App.jsx handles the callback
      } else {
        // Web: standard redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/dashboard` }
        })
        if (error) throw error
        // Browser redirects to provider — no further action needed here
      }
    } catch (err) {
      setError(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed: ${err.message}`)
    } finally {
      setOauthLoading(null)
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

  const oauthBtn = (bg, color, border) => ({
    width: '100%', padding: '13px', background: bg, color, border: `1px solid ${border}`,
    borderRadius: '8px', fontSize: '15px', fontWeight: 600, fontFamily: 'Barlow, sans-serif',
    letterSpacing: '0.2px', cursor: 'pointer', transition: 'opacity 150ms ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  })

  const showBioBtn = isNative() && biometricsAvailable && hasSavedSession
  const anyOauthLoading = oauthLoading !== null

  if (showReset) return (
    <div style={{ minHeight:'100vh', backgroundColor:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Barlow, sans-serif', padding:'20px' }}>
      <div style={{ backgroundColor:'#ffffff', borderRadius:'12px', padding:'48px', width:'100%', maxWidth:'420px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', border:'1px solid #e2e6ea' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <h1 style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'36px', color:'#0d0f14', letterSpacing:'3px', margin:0 }}>POST<span style={{ color:'#c8a84b' }}>COMMAND</span></h1>
        </div>
        <ForgotPasswordView onBack={() => setShowReset(false)} />
      </div>
    </div>
  )

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

        {/* Face ID — native only, shown when available */}
        {showBioBtn && (
          <button onClick={loginWithBiometrics} disabled={bioLoading || anyOauthLoading}
            style={{ ...oauthBtn('#0d0f14', '#c8a84b', '#333'), marginBottom:'12px', opacity: (bioLoading||anyOauthLoading) ? 0.6 : 1 }}>
            <span style={{ fontSize:'20px' }}>🔒</span>
            {bioLoading ? 'Authenticating...' : 'Sign In with Face ID'}
          </button>
        )}

        {/* Apple Sign In */}
        <button
          onClick={() => signInWithProvider('apple')}
          disabled={anyOauthLoading || loading}
          style={{ ...oauthBtn('#000000', '#ffffff', '#000'), marginBottom:'12px', opacity: (anyOauthLoading||loading) ? 0.6 : 1 }}
        >
          {/* Apple logo SVG */}
          <svg width="18" height="20" viewBox="0 0 814 1000" fill="white">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-167.8-111.9C140.6 768.8 95.7 681.4 84.6 628.2c-8.3-35.5-12.3-71.2-12.3-106.8 0-190.5 126.4-291.5 250.8-291.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
          </svg>
          {oauthLoading === 'apple' ? 'Connecting...' : 'Sign in with Apple'}
        </button>

        {/* Google Sign In */}
        <button
          onClick={() => signInWithProvider('google')}
          disabled={anyOauthLoading || loading}
          style={{ ...oauthBtn('#ffffff', '#3c4043', '#dadce0'), marginBottom:'24px', opacity: (anyOauthLoading||loading) ? 0.6 : 1 }}
        >
          {/* Google logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          {oauthLoading === 'google' ? 'Connecting...' : 'Sign in with Google'}
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <div style={{ flex:1, height:'1px', background:'#e2e6ea' }}/>
          <span style={{ color:'#8899aa', fontSize:'12px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px' }}>OR SIGN IN WITH PASSWORD</span>
          <div style={{ flex:1, height:'1px', background:'#e2e6ea' }}/>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:'20px' }}>
            <label style={{ display:'block', color:'#495057', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px', fontFamily:'Barlow Condensed, sans-serif' }}>
              Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp}
              onFocus={e => e.target.style.borderColor = '#c8a84b'}
              onBlur={e  => e.target.style.borderColor = '#e2e6ea'}/>
          </div>

          <div style={{ marginBottom:'4px' }}>
            <label style={{ display:'block', color:'#495057', fontSize:'12px', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px', fontFamily:'Barlow Condensed, sans-serif' }}>
              Password
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp}
              onFocus={e => e.target.style.borderColor = '#c8a84b'}
              onBlur={e  => e.target.style.borderColor = '#e2e6ea'}/>
          </div>
          <button type="button" onClick={() => setShowReset(true)}
            style={{ background:'transparent', border:'none', color:'#8899aa', cursor:'pointer', fontSize:'12px', textAlign:'right', width:'100%', fontFamily:'Barlow, sans-serif', marginBottom:'20px', padding:0 }}>
            Forgot password?
          </button>

          {error && (
            <div style={{ background:'#fff3f3', border:'1px solid #ffcccc', borderRadius:'8px', padding:'12px 16px', color:'#c0392b', fontSize:'14px', marginBottom:'20px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || anyOauthLoading}
            style={{ width:'100%', padding:'14px', background: (loading||anyOauthLoading) ? '#e8d98a' : '#c8a84b', color:'#0d0f14', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:700, fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'1px', textTransform:'uppercase', cursor: (loading||anyOauthLoading) ? 'not-allowed' : 'pointer', transition:'background 150ms ease' }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* CCW Map link */}
        <div style={{ textAlign:'center', marginTop:'24px' }}>
          <a href="/reciprocity" target="_blank" rel="noopener noreferrer"
            style={{ color:'#c8a84b', fontSize:'12px', textDecoration:'none', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px', display:'inline-flex', alignItems:'center', gap:'6px', opacity:0.8, transition:'opacity 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.opacity='1'}
            onMouseLeave={e => e.currentTarget.style.opacity='0.8'}>
            🗺 View CCW Reciprocity Map — All 50 States (No login required)
          </a>
        </div>

        <p style={{ textAlign:'center', color:'#8899aa', fontSize:'12px', marginTop:'24px' }}>
          © 2026 PostCommand · Security Workforce Management
        </p>
      </div>
    </div>
  )
}
