import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isNative } from '../../lib/platform'

const OAUTH_REDIRECT = isNative()
  ? 'postcommand://auth'
  : `${window.location.origin}/auth/callback`

// ── Forgot Password ───────────────────────────────────────────────────────────

function ForgotPasswordView({ onBack }) {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function sendReset() {
    if (!email.trim()) { setError('Email required.'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://postcommand.app/reset-password',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>✓</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', letterSpacing: '2px', color: '#c8a84b', marginBottom: '12px' }}>CHECK YOUR EMAIL</div>
      <div style={{ fontSize: '13px', color: '#8899aa', marginBottom: '24px', lineHeight: 1.6 }}>
        A password reset link has been sent to {email}.
      </div>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#c8a84b', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>
        BACK TO SIGN IN
      </button>
    </div>
  )

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '2px', color: '#0d0f14', marginBottom: '6px' }}>RESET PASSWORD</div>
      <div style={{ fontSize: '13px', color: '#8899aa', marginBottom: '24px' }}>Enter your email and we'll send a reset link.</div>
      {error && (
        <div style={{ background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c0392b', marginBottom: '14px' }}>{error}</div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendReset()}
          style={{ width: '100%', padding: '12px 16px', background: '#f8f9fa', border: '1px solid #e2e6ea', borderRadius: '8px', color: '#0d0f14', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Barlow', sans-serif" }}
          onFocus={e => e.target.style.borderColor = '#c8a84b'}
          onBlur={e  => e.target.style.borderColor = '#e2e6ea'}/>
      </div>
      <button onClick={sendReset} disabled={loading}
        style={{ width: '100%', height: '48px', background: loading ? '#e8d98a' : '#c8a84b', border: 'none', borderRadius: '8px', color: '#0d0f14', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, letterSpacing: '2px', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px' }}>
        {loading ? 'SENDING...' : 'SEND RESET LINK'}
      </button>
      <button onClick={onBack}
        style={{ width: '100%', background: 'transparent', border: 'none', color: '#8899aa', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1px' }}>
        BACK TO SIGN IN
      </button>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [oauthLoading, setOauthLoading]       = useState(null)
  const [biometricsAvailable, setBiometricsAvailable] = useState(false)
  const [hasSavedSession,     setHasSavedSession]     = useState(false)
  const [bioLoading, setBioLoading]   = useState(false)
  const [showReset,  setShowReset]    = useState(false)
  const [isMobile,   setIsMobile]     = useState(window.innerWidth < 768)
  const { signIn }  = useAuth()
  const navigate    = useNavigate()

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

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
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { skipBrowserRedirect: true, redirectTo: OAUTH_REDIRECT },
        })
        if (error) throw error
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.url })
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/dashboard` },
        })
        if (error) throw error
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
        setError('No saved credentials — please sign in with password first.')
      }
    } catch (err) {
      if (err?.code !== 'biometryNotAvailable' && err?.message !== 'User cancelled') {
        setError('Biometric sign-in failed. Please use your password.')
      }
    } finally {
      setBioLoading(false)
    }
  }

  const showBioBtn     = isNative() && biometricsAvailable && hasSavedSession
  const anyOauthLoading = oauthLoading !== null

  const inp = {
    width: '100%', padding: '12px 16px',
    background: '#f8f9fa', border: '1px solid #e2e6ea', borderRadius: '8px',
    color: '#0d0f14', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Barlow', sans-serif", transition: 'border-color 150ms ease',
  }

  const oauthBtn = (bg, color, border) => ({
    width: '100%', padding: '12px',
    background: bg, color, border: `1px solid ${border}`,
    borderRadius: '8px', fontSize: '14px', fontWeight: 600,
    fontFamily: "'Barlow', sans-serif", letterSpacing: '0.2px',
    cursor: 'pointer', transition: 'opacity 150ms ease',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  })

  // ── LEFT PANEL ────────────────────────────────────────────────────────────
  const LeftPanel = () => (
    <div style={{
      width: '42%', flexShrink: 0,
      background: '#0a0c10',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '60px 48px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background texture dots */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(201,162,39,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }}/>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '320px', width: '100%', textAlign: 'center' }}>
        {/* Shield icon */}
        <div style={{ marginBottom: '28px' }}>
          <svg width="64" height="72" viewBox="0 0 64 72" fill="none">
            <path d="M32 2L4 13V36C4 52 17 66 32 70C47 66 60 52 60 36V13L32 2Z" fill="rgba(201,162,39,0.12)" stroke="#c8a84b" strokeWidth="1.5"/>
            <path d="M32 16L12 23V36C12 48 21 59 32 62C43 59 52 48 52 36V23L32 16Z" fill="rgba(201,162,39,0.18)"/>
            <polyline points="22,36 29,43 43,29" stroke="#c8a84b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', letterSpacing: '4px', color: '#c8a84b', lineHeight: 1, marginBottom: '4px' }}>
          POST<span style={{ color: '#ffffff' }}>COMMAND</span>
        </div>
        <div style={{ fontSize: '11px', color: '#5a6070', letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: '40px' }}>
          Security Workforce Management
        </div>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', marginBottom: '48px' }}>
          {[
            ['map-pin', 'GPS-verified clock-in & patrol tracking'],
            ['alert-circle', 'Incident reports & real-time dispatch'],
            ['calendar', 'Scheduling, timesheets & compliance'],
          ].map(([, text]) => (
            <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(201,162,39,0.15)', border: '1px solid rgba(201,162,39,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8a84b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style={{ fontSize: '13px', color: '#a0aab8', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <div style={{ fontSize: '11px', color: '#3a4050', letterSpacing: '1px', fontFamily: "'Barlow Condensed', sans-serif" }}>
          TRUSTED BY SECURITY PROFESSIONALS
        </div>
      </div>
    </div>
  )

  // ── RIGHT PANEL (form area) ────────────────────────────────────────────────
  const RightPanel = () => (
    <div style={{
      flex: 1,
      background: '#ffffff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '40px 24px' : '48px 56px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo — shown on mobile only (desktop shows left panel) */}
        {isMobile && (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '34px', letterSpacing: '3px', color: '#0d0f14', margin: 0 }}>
              POST<span style={{ color: '#c8a84b' }}>COMMAND</span>
            </h1>
            <p style={{ fontSize: '11px', color: '#8899aa', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '4px', marginBottom: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
              Security Workforce Management
            </p>
          </div>
        )}

        {/* ── Forgot password flow ── */}
        {showReset ? (
          <ForgotPasswordView onBack={() => setShowReset(false)} />
        ) : (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '2px', color: '#0d0f14', margin: '0 0 4px' }}>SIGN IN</h2>
            <p style={{ fontSize: '13px', color: '#8899aa', margin: '0 0 24px' }}>Access your PostCommand account</p>

            {/* Biometrics */}
            {showBioBtn && (
              <button onClick={loginWithBiometrics} disabled={bioLoading || anyOauthLoading}
                style={{ ...oauthBtn('#0d0f14', '#c8a84b', '#333'), marginBottom: '10px', opacity: (bioLoading || anyOauthLoading) ? 0.6 : 1 }}>
                <span style={{ fontSize: '18px' }}>🔒</span>
                {bioLoading ? 'Authenticating...' : 'Sign In with Face ID'}
              </button>
            )}

            {/* Apple */}
            <button onClick={() => signInWithProvider('apple')} disabled={anyOauthLoading || loading}
              style={{ ...oauthBtn('#000000', '#ffffff', '#000'), marginBottom: '10px', opacity: (anyOauthLoading || loading) ? 0.6 : 1 }}>
              <svg width="17" height="19" viewBox="0 0 814 1000" fill="white">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-167.8-111.9C140.6 768.8 95.7 681.4 84.6 628.2c-8.3-35.5-12.3-71.2-12.3-106.8 0-190.5 126.4-291.5 250.8-291.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
              </svg>
              {oauthLoading === 'apple' ? 'Connecting...' : 'Sign in with Apple'}
            </button>

            {/* Google */}
            <button onClick={() => signInWithProvider('google')} disabled={anyOauthLoading || loading}
              style={{ ...oauthBtn('#ffffff', '#3c4043', '#dadce0'), marginBottom: '20px', opacity: (anyOauthLoading || loading) ? 0.6 : 1 }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              {oauthLoading === 'google' ? 'Connecting...' : 'Sign in with Google'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e6ea' }}/>
              <span style={{ color: '#8899aa', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>OR SIGN IN WITH PASSWORD</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e6ea' }}/>
            </div>

            {/* Email + Password form */}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#495057', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px', fontFamily: "'Barlow Condensed', sans-serif" }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp}
                  onFocus={e => e.target.style.borderColor = '#c8a84b'}
                  onBlur={e  => e.target.style.borderColor = '#e2e6ea'}/>
              </div>

              <div style={{ marginBottom: '4px' }}>
                <label style={{ display: 'block', color: '#495057', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '7px', fontFamily: "'Barlow Condensed', sans-serif" }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp}
                  onFocus={e => e.target.style.borderColor = '#c8a84b'}
                  onBlur={e  => e.target.style.borderColor = '#e2e6ea'}/>
              </div>
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button type="button" onClick={() => setShowReset(true)}
                  style={{ background: 'transparent', border: 'none', color: '#8899aa', cursor: 'pointer', fontSize: '12px', fontFamily: "'Barlow', sans-serif", padding: 0 }}>
                  Forgot password?
                </button>
              </div>

              {error && (
                <div style={{ background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '8px', padding: '11px 14px', color: '#c0392b', fontSize: '13px', marginBottom: '16px' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || anyOauthLoading}
                style={{ width: '100%', padding: '14px', background: (loading || anyOauthLoading) ? '#e8d98a' : '#c8a84b', color: '#0d0f14', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textTransform: 'uppercase', cursor: (loading || anyOauthLoading) ? 'not-allowed' : 'pointer', transition: 'background 150ms ease' }}>
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>

            {/* CCW map link */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/reciprocity" target="_blank" rel="noopener noreferrer"
                style={{ color: '#c8a84b', fontSize: '12px', textDecoration: 'none', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center', gap: '5px', opacity: 0.75, transition: 'opacity 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}>
                🗺 CCW Reciprocity Map — All 50 States
              </a>
            </div>

            {/* Register link */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#8899aa' }}>New agency?{' '}</span>
              <button onClick={() => navigate('/register')}
                style={{ background: 'none', border: 'none', color: '#c8a84b', cursor: 'pointer', fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', padding: 0, fontWeight: 600 }}>
                Register your company →
              </button>
            </div>

            {/* Privacy footer */}
            <p style={{ textAlign: 'center', fontSize: '11px', color: '#c0c8d0', marginTop: '20px', lineHeight: 1.5 }}>
              By signing in you agree to our{' '}
              <a href="/privacy" style={{ color: '#c8a84b', textDecoration: 'none', opacity: 0.8 }}>Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms" style={{ color: '#c8a84b', textDecoration: 'none', opacity: 0.8 }}>Terms of Service</a>.
              PostCommand collects location data during active shifts only.
            </p>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Barlow', sans-serif" }}>
      {!isMobile && <LeftPanel />}
      <RightPanel />
    </div>
  )
}
