import { useState, useEffect } from 'react'
import { openBrowser } from '../../lib/platform'

const STORAGE_KEY = 'pc-privacy-dismissed'
const PRIVACY_URL = 'https://www.nationwidepolice.com/post-command'

export default function PrivacyBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 100,
      background: '#ffffff',
      borderTop: '1px solid #e2e6ea',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      fontFamily: "'Barlow', Helvetica, sans-serif",
    }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#495057', lineHeight: 1.5, flex: 1, minWidth: 200 }}>
        PostCommand collects location, work hours, and device data to deliver workforce management services.
        By signing in you agree to our{' '}
        <button onClick={() => openBrowser(PRIVACY_URL)}
          style={{ background: 'none', border: 'none', color: '#c8a84b', cursor: 'pointer', padding: 0, fontSize: '12px', fontFamily: 'inherit', textDecoration: 'underline' }}>
          Privacy Policy
        </button>.
        Data is accessible to your company administrator.
      </p>
      <button
        onClick={accept}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: '#c8a84b',
          color: '#0d0f14',
          border: 'none',
          borderRadius: '6px',
          padding: '0 18px', height: '36px',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Got It — Don't Show Again
      </button>
    </div>
  )
}
