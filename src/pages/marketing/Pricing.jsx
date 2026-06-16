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
              <a href="/pricing" style={{ color: C.accent, fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textDecoration: 'none' }}>PRICING</a>
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

function Check() {
  return (
    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: C.accentDim, border: `1.5px solid ${C.accentBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
        <path d="M1 3.5L3.5 6L8 1" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const PLANS = [
  {
    name: 'Starter',
    price: '$25',
    desc: 'For small teams getting started with digital workforce management.',
    features: [
      'Up to 15 officers',
      'Scheduling and timesheets',
      'Incident and activity reports',
      'Mobile app (iOS and Android)',
      'Client contact portal',
      'Email support',
    ],
  },
  {
    name: 'Professional',
    price: '$75',
    desc: 'For growing companies managing multiple sites and clients.',
    featured: true,
    features: [
      'Up to 75 officers',
      'Everything in Starter',
      'Live officer GPS tracking',
      'HR document management',
      'AI-assisted report writing',
      'Patrol checkpoint logging',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: '$199',
    desc: 'For large operations requiring advanced controls and compliance.',
    features: [
      'Unlimited officers',
      'Everything in Professional',
      'Full audit log',
      'Performance reviews',
      'Custom roles and permissions',
      'SOS emergency alerts',
      'Dedicated onboarding',
      'Phone and priority support',
    ],
  },
]

const ADDONS = [
  { name: 'Additional Officers', desc: 'Add officer seats beyond your plan limit.', price: '$2/officer/mo' },
  { name: 'Payroll Integration', desc: 'Connect to ADP, Gusto, or Paychex for direct payroll export.', price: 'Contact us' },
  { name: 'Custom Branding', desc: 'Apply your company logo and colors to client-facing documents and the officer app.', price: 'Contact us' },
]

export default function Pricing() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .mkt-plan:hover { transform: translateY(-3px); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
      `}</style>

      <Nav isMobile={isMobile} />

      {/* Hero */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: isMobile ? '64px 24px 48px' : '96px 24px 72px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2.5px', color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: '20px', padding: '5px 16px', marginBottom: '24px' }}>
          PRICING
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '42px' : '62px', letterSpacing: '2px', lineHeight: 1.05, color: C.text, margin: '0 0 18px', fontWeight: 700 }}>
          STRAIGHTFORWARD<br /><span style={{ color: C.accent }}>PLANS FOR EVERY TEAM</span>
        </h1>
        <p style={{ fontSize: '16px', color: C.textSec, lineHeight: 1.75, margin: 0 }}>
          No hidden fees. No per-feature add-ons. All plans include a 14-day free trial — no credit card required.
        </p>
      </section>

      {/* Plan cards */}
      <section style={{ maxWidth: '1060px', margin: '0 auto', padding: isMobile ? '0 20px 72px' : '0 24px 88px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          {PLANS.map(p => (
            <div key={p.name} className="mkt-plan" style={{ background: p.featured ? 'rgba(200,168,75,0.06)' : C.card, border: `1px solid ${p.featured ? C.accentBorder : C.border}`, borderRadius: '14px', padding: '32px 28px', display: 'flex', flexDirection: 'column', transition: 'all 200ms ease', position: 'relative' }}>
              {p.featured && (
                <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: C.accent, color: '#0d0f14', fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2px', fontWeight: 700, padding: '4px 16px', borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap' }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ marginTop: p.featured ? '12px' : 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', letterSpacing: '2.5px', color: p.featured ? C.accent : C.textMuted, marginBottom: '10px' }}>{p.name.toUpperCase()}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '52px', fontWeight: 700, color: C.text, lineHeight: 1, marginBottom: '4px' }}>
                  {p.price}<span style={{ fontSize: '15px', fontWeight: 400, color: C.textMuted }}>/mo</span>
                </div>
                <p style={{ fontSize: '13px', color: C.textSec, lineHeight: 1.55, margin: '12px 0 24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{p.desc}</p>
                <div style={{ height: '1px', background: C.border, marginBottom: '20px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Check />
                    <span style={{ fontSize: '13px', color: C.textSec, fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.5, paddingTop: '1px' }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/register" style={{ display: 'block', marginTop: '28px', textAlign: 'center', background: p.featured ? C.accent : 'transparent', color: p.featured ? '#0d0f14' : C.text, border: `1px solid ${p.featured ? C.accent : C.border}`, borderRadius: '8px', padding: '12px 0', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none' }}>
                START FREE TRIAL
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '56px 24px' : '72px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '28px' : '38px', letterSpacing: '2px', color: C.text, margin: '0 0 36px', fontWeight: 700 }}>ADD-ONS</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {ADDONS.map(a => (
              <div key={a.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', letterSpacing: '1px', color: C.text, marginBottom: '4px' }}>{a.name}</div>
                  <div style={{ fontSize: '13px', color: C.textSec, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{a.desc}</div>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', letterSpacing: '1px', color: C.accent, whiteSpace: 'nowrap' }}>{a.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Store note */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '48px 24px' : '64px 24px' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px 32px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', letterSpacing: '1px', color: C.text, marginBottom: '6px' }}>AVAILABLE ON IOS AND ANDROID</div>
            <p style={{ fontSize: '13px', color: C.textSec, lineHeight: 1.6, margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              The PostCommand mobile app is available for download on the App Store and Google Play. Officers use the mobile app for clock in/out, incident reporting, daily activity reports, and real-time communication. Your subscription covers all users — no separate per-device fees.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: isMobile ? '0 24px 80px' : '0 24px 100px' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '28px' : '38px', letterSpacing: '2px', color: C.text, margin: '0 0 36px', fontWeight: 700 }}>COMMON QUESTIONS</h2>
        {[
          ['Can I switch plans later?', 'Yes. You can upgrade or downgrade your plan at any time from your billing settings. Changes take effect at the start of the next billing cycle.'],
          ['What happens after the free trial?', 'After 14 days your account transitions to the plan you selected. You will be notified before any charge occurs. If you choose not to continue, your account is deactivated and your data is retained for 30 days.'],
          ['Is there a setup fee?', 'No. There are no setup fees, no onboarding fees, and no annual commitments. All plans are billed month-to-month.'],
          ['Can I add more officers later?', 'Yes. Additional officer seats can be added at any time through your account settings. Additional seats are billed at $2 per officer per month beyond your plan limit.'],
          ['Is my data secure?', 'Yes. PostCommand is hosted on enterprise-grade cloud infrastructure with encryption at rest and in transit. See our Privacy Policy for details on data handling and retention.'],
        ].map(([q, a]) => (
          <div key={q} style={{ borderTop: `1px solid ${C.border}`, padding: '24px 0' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', letterSpacing: '0.5px', color: C.text, marginBottom: '10px' }}>{q}</div>
            <p style={{ fontSize: '13px', color: C.textSec, lineHeight: 1.65, margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>{a}</p>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.border}` }} />
      </section>

      <Footer />
    </div>
  )
}
