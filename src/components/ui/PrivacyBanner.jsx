import { useState, useEffect } from 'react'
import { openBrowser } from '../../lib/platform'

const STORAGE_KEY = 'pc-privacy-accepted'
const PRIVACY_URL = 'https://www.nationwidepolice.com/nps-portal#section-3'

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
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 16px 20px', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)' }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', width:'100%', maxWidth:'480px', boxShadow:'var(--shadow-modal)', animation:'slideUp 220ms ease' }}>
        <style>{`@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        <h3 style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'10px' }}>
          POSTCOMMAND DATA NOTICE
        </h3>

        <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'14px' }}>
          To provide workforce management services, PostCommand collects:
        </p>

        <ul style={{ listStyle:'none', padding:0, marginBottom:'16px', display:'flex', flexDirection:'column', gap:'6px' }}>
          {[
            ['map-pin',      'Location data — to verify work site check-ins'],
            ['camera',       'Photos — for identity verification and incident documentation'],
            ['clock',        'Work hours and activity — for payroll and compliance'],
            ['smartphone',   'Device information — for security and performance'],
          ].map(([icon, text]) => (
            <li key={icon} style={{ display:'flex', alignItems:'flex-start', gap:'10px', fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.5 }}>
              <span style={{ fontSize:'14px', flexShrink:0, marginTop:'1px' }}>•</span>
              {text}
            </li>
          ))}
        </ul>

        <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'18px', lineHeight:1.5 }}>
          This data is accessible to your employer/company administrator.
          By continuing, you agree to our Privacy Policy.
        </p>

        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button
            onClick={() => openBrowser(PRIVACY_URL)}
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--accent)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer', flex:1 }}
          >
            View Privacy Policy
          </button>
          <button
            onClick={accept}
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flex:1 }}
          >
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  )
}
