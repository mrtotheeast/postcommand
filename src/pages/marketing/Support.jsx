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
              <a href="/features" style={{ color: C.textSec, fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textDecoration: 'none' }}>FEATURES</a>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif", fontSize: '18px', letterSpacing: '3px', color: C.accent, marginBottom: '6px' }}>
              POST<span style={{ color: '#fff' }}>COMMAND</span>
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted, fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.6 }}>
              Security workforce management platform.<br />
              Built for private security companies.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', color: C.textMuted, marginBottom: '12px' }}>PRODUCT</div>
              {links.map(([l, h]) => (
                <div key={l} style={{ marginBottom: '8px' }}>
                  <a href={h} style={{ color: C.textSec, fontSize: '13px', textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{l}</a>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', color: C.textMuted, marginBottom: '12px' }}>CONTACT</div>
              <a href="mailto:support@postcommand.app" style={{ color: C.textSec, fontSize: '13px', textDecoration: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>support@postcommand.app</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '24px', color: C.textMuted, fontSize: '11px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          &copy; 2026 PostCommand. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

const FAQ = [
  {
    q: 'How do I log in to PostCommand?',
    a: 'Open the PostCommand app or visit postcommand.app. Enter the email address your administrator used to set up your account and the password you created when you accepted your invitation. If you have not yet accepted an invitation, check your email for a setup link from support@postcommand.app.',
  },
  {
    q: 'I forgot my password. How do I reset it?',
    a: 'On the login screen, tap Forgot password and enter your account email address. You will receive a password reset link within a few minutes. Check your spam folder if it does not appear. The link expires after 24 hours.',
  },
  {
    q: 'Why is the app asking for my location?',
    a: 'PostCommand uses your device location to verify that you are at your assigned site when clocking in, to log patrol checkpoint scans, and to support geofence monitoring during active shifts. Location is only collected while the app is in use during a shift. Your company administrator controls location settings in the platform.',
  },
  {
    q: 'My timesheet or patrol data is not showing. What do I do?',
    a: 'First, confirm you have an active internet connection. Pull to refresh on the relevant screen. If data is still missing, log out and log back in. If the issue persists, contact your supervisor to verify your assignment and company configuration, then email support@postcommand.app with your company name and a description of the issue.',
  },
  {
    q: 'How do I submit an incident report?',
    a: 'Tap Incidents in the bottom navigation, then tap New Report. Complete the required fields: incident type, date and time, and narrative. You may use the AI-assisted guided mode to answer structured questions and generate a narrative automatically. Tap Submit to send the report for supervisor review, or Save as Draft to return to it later.',
  },
  {
    q: 'How do I delete my account?',
    a: 'PostCommand accounts are managed by your company administrator. To request account deletion or removal of your personal data, email support@postcommand.app from the email address associated with your account. Include your name and company. We will process your request within 30 days in accordance with our Privacy Policy.',
  },
  {
    q: 'The app is crashing or not loading. What should I do?',
    a: 'Close and reopen the app. If the problem continues, force-quit the app and reopen it. Ensure your device is running a current version of iOS or Android and that the PostCommand app is up to date. If issues persist, email support@postcommand.app with your device model, OS version, and a description of the problem.',
  },
]

const ACCESSIBILITY = [
  { feature: 'Dark and Light Mode',         status: 'Supported',    supported: true },
  { feature: 'Sufficient Contrast',          status: 'Supported',    supported: true },
  { feature: 'Differentiate Without Color',  status: 'Supported',    supported: true },
  { feature: 'Larger Text',                  status: 'Supported',    supported: true },
  { feature: 'Reduced Motion',               status: 'Supported',    supported: true },
  { feature: 'VoiceOver and Voice Control',  status: 'Coming Soon',  supported: false },
]

const IOS_SETTINGS = [
  {
    label: 'Dark Mode',
    path: 'Settings > Display & Brightness > Appearance > Dark',
  },
  {
    label: 'Larger Text',
    path: 'Settings > Accessibility > Display & Text Size > Larger Text',
  },
  {
    label: 'Reduce Motion',
    path: 'Settings > Accessibility > Motion > Reduce Motion',
  },
  {
    label: 'Increase Contrast',
    path: 'Settings > Accessibility > Display & Text Size > Increase Contrast',
  },
]

const PROSE = { fontSize: '14px', color: C.textSec, lineHeight: 1.75, margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }

export default function Support() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .support-faq:hover { background: rgba(255,255,255,0.03) !important; }
        .support-acc-card:hover { border-color: rgba(200,168,75,0.2) !important; }
      `}</style>

      <Nav isMobile={isMobile} />

      {/* Hero */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: isMobile ? '56px 24px 48px' : '88px 24px 64px' }}>
        <div style={{ display: 'inline-block', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2.5px', color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: '20px', padding: '5px 16px', marginBottom: '20px' }}>
          SUPPORT
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '38px' : '56px', letterSpacing: '2px', lineHeight: 1.05, color: C.text, margin: '0 0 16px', fontWeight: 700 }}>
          APP SUPPORT
        </h1>
        <p style={{ ...PROSE, fontSize: '16px', lineHeight: 1.7 }}>
          PostCommand is a security workforce management platform for private security companies. If you have a question or need assistance, the resources below cover the most common topics.
        </p>
      </section>

      {/* Contact */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '0 24px 64px' : '0 24px 80px' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '26px' : '34px', letterSpacing: '2px', color: C.text, margin: '0 0 28px', fontWeight: 700 }}>CONTACT</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px 28px 24px' }}>
            <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', color: C.textMuted, marginBottom: '12px' }}>EMAIL SUPPORT</div>
            <a href="mailto:support@postcommand.app" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', letterSpacing: '0.5px', color: C.accent, textDecoration: 'none', display: 'block', marginBottom: '10px' }}>
              support@postcommand.app
            </a>
            <p style={{ ...PROSE, fontSize: '13px' }}>
              For questions about your account, billing, or any technical issue with the PostCommand app or platform.
            </p>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px 28px 24px' }}>
            <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', color: C.textMuted, marginBottom: '12px' }}>RESPONSE TIME</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px', letterSpacing: '1px', color: C.text, marginBottom: '10px' }}>
              Within 1 business day
            </div>
            <p style={{ ...PROSE, fontSize: '13px' }}>
              Support is available Monday through Friday. We respond to all inquiries within one business day, typically sooner.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '56px 24px' : '72px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '26px' : '34px', letterSpacing: '2px', color: C.text, margin: '0 0 32px', fontWeight: 700 }}>FREQUENTLY ASKED QUESTIONS</h2>
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="support-faq"
              style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 150ms ease', borderRadius: openFaq === i ? '8px' : '0', margin: openFaq === i ? '4px 0' : '0', background: 'transparent' }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '20px 0' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', letterSpacing: '0.5px', color: C.text, lineHeight: 1.3, paddingLeft: openFaq === i ? '0' : '0' }}>
                  {item.q}
                </div>
                <div style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: 'system-ui', fontSize: '14px', color: C.accent, lineHeight: 1, marginTop: openFaq === i ? '1px' : '-1px' }}>
                    {openFaq === i ? '−' : '+'}
                  </div>
                </div>
              </div>
              {openFaq === i && (
                <p style={{ ...PROSE, paddingBottom: '20px' }}>{item.a}</p>
              )}
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}` }} />
        </div>
      </section>

      {/* Accessibility */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '56px 24px' : '72px 24px' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '26px' : '34px', letterSpacing: '2px', color: C.text, margin: '0 0 12px', fontWeight: 700 }}>ACCESSIBILITY</h2>
        <p style={{ ...PROSE, marginBottom: '28px', fontSize: '14px' }}>
          PostCommand is designed to work with the accessibility features built into iOS and Android. The table below reflects the current state of support within the app.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px' }}>
          {ACCESSIBILITY.map((item) => (
            <div
              key={item.feature}
              className="support-acc-card"
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '20px 20px 18px', transition: 'border-color 150ms ease' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '10px', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.4 }}>
                {item.feature}
              </div>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '1px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '10px',
                background: item.supported ? 'rgba(58,170,106,0.12)' : 'rgba(232,148,58,0.12)',
                color: item.supported ? '#3aaa6a' : '#e8943a',
              }}>
                {item.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How to enable on iPhone */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '56px 24px' : '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '26px' : '34px', letterSpacing: '2px', color: C.text, margin: '0 0 10px', fontWeight: 700 }}>HOW TO ENABLE ON IPHONE</h2>
          <p style={{ ...PROSE, marginBottom: '28px', fontSize: '14px' }}>
            These settings are controlled by iOS and apply system-wide, including within PostCommand. Access them through the iPhone Settings app.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
            {IOS_SETTINGS.map((item) => (
              <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '18px 16px' }}>
                <div style={{ fontSize: '12px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', color: C.accent, marginBottom: '10px', fontWeight: 700 }}>
                  {item.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', color: C.textSec, fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.6 }}>
                  {item.path}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: isMobile ? '56px 24px 80px' : '80px 24px 100px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '22px' : '28px', letterSpacing: '1.5px', color: C.text, marginBottom: '16px', fontWeight: 700 }}>
          QUESTIONS ABOUT POSTCOMMAND?
        </div>
        <p style={{ ...PROSE, marginBottom: '24px' }}>
          If you did not find what you were looking for above, our support team is ready to help. Email us and we will respond within one business day.
        </p>
        <a
          href="mailto:support@postcommand.app"
          style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '8px', padding: '0 28px', height: '48px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none' }}
        >
          EMAIL SUPPORT
        </a>
        <div style={{ marginTop: '16px', fontSize: '13px', color: C.textMuted, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          support@postcommand.app
        </div>
      </section>

      <Footer />
    </div>
  )
}
