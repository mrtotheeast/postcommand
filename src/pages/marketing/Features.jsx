import { useState, useEffect } from 'react'

const C = {
  bg: '#0a0c10',
  surface: '#0f1117',
  card: '#13161e',
  accent: '#c8a84b',
  accentDim: 'rgba(200,168,75,0.1)',
  accentBorder: 'rgba(200,168,75,0.22)',
  text: '#f0f2f8',
  textSec: 'rgba(240,242,248,0.65)',
  textMuted: 'rgba(240,242,248,0.35)',
  border: 'rgba(255,255,255,0.07)',
}

function Nav({ isMobile }) {
  return (
    <nav style={{ position: 'sticky', top: 0, background: 'rgba(10,12,16,0.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.border}`, zIndex: 100 }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/app-icon-transparent.png" alt="PostCommand" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
          <span style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif", fontSize: '20px', letterSpacing: '3px', color: C.accent }}>
            POST<span style={{ color: '#fff' }}>COMMAND</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '28px' }}>
          {!isMobile && (
            <>
              <a href="/features" style={{ color: C.accent, fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textDecoration: 'none' }}>FEATURES</a>
              <a href="/pricing" style={{ color: C.textSec, fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textDecoration: 'none' }}>PRICING</a>
            </>
          )}
          <a href="/login" style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '6px', padding: '0 18px', height: '36px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', textDecoration: 'none' }}>
            SIGN IN
          </a>
        </div>
      </div>
    </nav>
  )
}

function Footer() {
  const links = [['Features', '/features'], ['Pricing', '/pricing'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']]
  return (
    <footer style={{ background: '#060709', borderTop: `1px solid ${C.border}`, padding: '48px 24px 40px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif", fontSize: '18px', letterSpacing: '3px', color: C.accent }}>
            POST<span style={{ color: '#fff' }}>COMMAND</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            {links.map(([l, h]) => (
              <a key={l} href={h} style={{ color: C.textSec, fontSize: '13px', textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{l}</a>
            ))}
            <a href="mailto:support@postcommand.app" style={{ color: C.textSec, fontSize: '13px', textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>support@postcommand.app</a>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '24px', color: C.textMuted, fontSize: '11px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          &copy; 2026 PostCommand. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

const SECTIONS = [
  {
    title: 'Scheduling',
    tagline: 'Build and publish shift schedules in minutes.',
    bullets: [
      'Drag-and-drop shift grid with per-site views for full visibility across all locations.',
      'Open shift pool lets eligible officers claim available shifts directly from the mobile app.',
      'Automatic overtime alerts trigger before hours breach configured thresholds, protecting payroll margins.',
      'Publish schedules with a single click — officers receive push notifications and can view upcoming shifts instantly.',
      'Copy previous week templates to eliminate repetitive data entry for recurring schedules.',
    ],
  },
  {
    title: 'Timesheets',
    tagline: 'Accurate hours capture with built-in accountability.',
    bullets: [
      'Officers clock in and out from the mobile app. GPS verification confirms presence within the assigned site geofence.',
      'Photo confirmation captures a photo at clock-in for a timestamped visual record of each shift start.',
      'Supervisors review and approve timesheets through a structured workflow before hours are locked for payroll.',
      'Timesheet corrections require a documented reason, creating an audit trail for every adjustment.',
      'Payroll-ready export with totals, overtime breakdowns, and site-level summaries.',
    ],
  },
  {
    title: 'Incident Reports',
    tagline: 'From the field to the file in minutes.',
    bullets: [
      'CAD numbers are auto-generated at submission so every incident has a unique, traceable reference.',
      'AI-assisted narrative writing helps officers produce complete, professional incident documentation in the field.',
      'Confidential flag restricts visibility so sensitive incidents are seen only by authorized personnel.',
      'Reports move through a draft-to-submitted-to-approved status workflow with supervisor review at each stage.',
      'Attach photos, audio memos, and supporting files directly to incident records.',
    ],
  },
  {
    title: 'Daily Activity Reports',
    tagline: 'Transparent operations delivered to your clients.',
    bullets: [
      'Officers complete structured DAR entries that capture all noteworthy activity during the shift.',
      'AI narrative generation converts structured entries into professional, client-ready prose automatically.',
      'Reports are compiled and delivered as PDF emails directly to client contacts at shift close.',
      'Supervisors can review and annotate DARs before delivery to ensure quality and accuracy.',
      'Clients gain visibility without system access, protecting your operational data while meeting contractual obligations.',
    ],
  },
  {
    title: 'HR Management',
    tagline: 'Compliance and personnel records in one place.',
    bullets: [
      'Track guard licenses, CPR certifications, background checks, and any custom credential with automatic expiration alerts.',
      'Distribute policy documents company-wide and require digital acknowledgment before personnel can acknowledge receipt.',
      'Onboarding workflows guide new hires through required documents, training materials, and policy sign-offs.',
      'Write-ups, commendations, performance notes, and counseling records are logged with date, author, and full context.',
      'Downloadable personnel file exports for compliance audits and legal review.',
    ],
  },
  {
    title: 'Live Map',
    tagline: 'Real-time situational awareness across every site.',
    bullets: [
      'A live GPS map shows every officer currently on duty, updated in real time as they move.',
      'Site geofences trigger alerts when officers leave assigned patrol zones or miss check-in windows.',
      'Checkpoint logging lets officers mark patrol waypoints during rounds, creating a verifiable patrol record.',
      'All location data is scoped to active shift periods — no continuous tracking outside working hours.',
      'Integrated SOS alert system lets officers flag emergencies directly from the map view with one tap.',
    ],
  },
]

export default function Features() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Nav isMobile={isMobile} />

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '64px 24px 48px' : '96px 24px 72px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2.5px', color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: '20px', padding: '5px 16px', marginBottom: '24px' }}>
          PLATFORM OVERVIEW
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '42px' : '62px', letterSpacing: '2px', lineHeight: 1.05, color: C.text, margin: '0 0 18px', fontWeight: 700 }}>
          BUILT FOR<br /><span style={{ color: C.accent }}>SECURITY OPERATIONS</span>
        </h1>
        <p style={{ fontSize: '16px', color: C.textSec, lineHeight: 1.75, margin: '0 auto', maxWidth: '560px' }}>
          Every module in PostCommand was designed around the actual workflows of private security companies — from shift handoffs to client reporting.
        </p>
      </section>

      {/* Feature sections */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '0 20px 80px' : '0 24px 100px' }}>
        {SECTIONS.map((s, i) => (
          <div key={s.title} style={{ borderTop: `1px solid ${C.border}`, paddingTop: isMobile ? '48px' : '64px', marginBottom: isMobile ? '48px' : '64px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', letterSpacing: '2.5px', color: C.accent }}>0{i + 1}</span>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '30px' : '40px', letterSpacing: '2px', color: C.text, margin: 0, fontWeight: 700 }}>{s.title.toUpperCase()}</h2>
            </div>
            <p style={{ fontSize: '15px', color: C.accent, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.5px', margin: '0 0 28px' }}>{s.tagline}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {s.bullets.map((b, bi) => (
                <div key={bi} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1.5px solid ${C.accentBorder}`, background: C.accentDim, flexShrink: 0, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p style={{ fontSize: '14px', color: C.textSec, lineHeight: 1.65, margin: 0 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: isMobile ? '64px 24px' : '88px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '34px' : '48px', letterSpacing: '2px', color: C.text, margin: '0 0 16px', fontWeight: 700 }}>
          SEE IT IN ACTION
        </h2>
        <p style={{ color: C.textSec, fontSize: '15px', margin: '0 0 36px', lineHeight: 1.7 }}>
          Start your free 14-day trial. No credit card required.
        </p>
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/register" style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '8px', padding: '0 32px', height: '50px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none' }}>
            START FREE TRIAL
          </a>
          <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0 32px', height: '50px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', letterSpacing: '2px', textDecoration: 'none' }}>
            VIEW PRICING
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
