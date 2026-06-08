import { useState, useEffect } from 'react'
import { openBrowser } from '../../lib/platform'

const STORAGE_KEY = 'pc-privacy-accepted'
const PRIVACY_URL = 'https://www.nationwidepolice.com/post-command'

export default function PrivacyBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 16px 20px',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e6ea',
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        animation: 'slideUp 220ms ease',
        fontFamily: "'Barlow', Helvetica, sans-serif",
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        <h3 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '20px',
          letterSpacing: '2px',
          color: '#0d0f14',
          marginBottom: '10px',
        }}>
          POSTCOMMAND DATA NOTICE
        </h3>

        <p style={{ fontSize: '13px', color: '#495057', lineHeight: 1.6, marginBottom: '14px' }}>
          To provide workforce management services, PostCommand collects:
        </p>

        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            'Location data — to verify work site check-ins',
            'Photos — for identity verification and incident documentation',
            'Work hours and activity — for payroll and compliance',
            'Device information — for security and performance',
          ].map((text, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#495057', lineHeight: 1.5 }}>
              <span style={{ color: '#c8a84b', fontWeight: 700, flexShrink: 0 }}>•</span>
              {text}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: '12px', color: '#868e96', marginBottom: '18px', lineHeight: 1.5 }}>
          This data is accessible to your employer/company administrator.
          By continuing, you agree to our Privacy Policy.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => openBrowser(PRIVACY_URL)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#f8f9fa',
              border: '1px solid #e2e6ea',
              color: '#0d0f14',
              borderRadius: '6px',
              padding: '0 16px', height: '44px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '13px', letterSpacing: '1px',
              cursor: 'pointer', flex: 1,
            }}
          >
            View Privacy Policy
          </button>
          <button
            onClick={accept}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              background: '#c8a84b',
              color: '#0d0f14',
              border: 'none',
              borderRadius: '6px',
              padding: '0 20px', height: '44px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '13px', fontWeight: 700, letterSpacing: '1px',
              cursor: 'pointer', flex: 1,
            }}
          >
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  )
}
