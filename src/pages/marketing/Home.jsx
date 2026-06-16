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

const DOT_BG = {
  backgroundImage: 'radial-gradient(circle, rgba(200,168,75,0.06) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
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

const FEATURES = [
  {
    title: 'Smart Scheduling',
    desc: 'Drag-and-drop shift grid with site assignment, open shift pool, and automatic overtime alerts before hours exceed thresholds.',
  },
  {
    title: 'Timesheet Management',
    desc: 'GPS-verified clock in/out with photo confirmation. Supervisor approval workflows before payroll export.',
  },
  {
    title: 'Incident Reports',
    desc: 'CAD number auto-generation, AI-assisted narrative writing, confidential flagging, and tracked status from draft to approved.',
  },
  {
    title: 'Daily Activity Reports',
    desc: 'Structured field reporting with AI narrative generation, PDF export, and email delivery directly to client contacts.',
  },
  {
    title: 'HR Document Management',
    desc: 'Credential tracking with expiration alerts, document acknowledgment workflows, write-ups, and onboarding packet distribution.',
  },
  {
    title: 'Live Officer Tracking',
    desc: 'Real-time GPS across all active sites. Geofence monitoring, checkpoint logging, and shift-scoped location history.',
  },
]

const PLANS = [
  { name: 'Starter', price: '$25', desc: 'Small teams up to 15 officers.' },
  { name: 'Professional', price: '$75', desc: 'Growing companies with multiple sites.', featured: true },
  { name: 'Enterprise', price: '$199', desc: 'Large operations with advanced needs.' },
]

export default function Home() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        a.mkt-nav-link:hover { color: #f0f2f8 !important; }
        .mkt-feat-card:hover { border-color: rgba(200,168,75,0.32) !important; background: #181b24 !important; }
        .mkt-plan-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .mkt-btn-primary:hover { opacity: 0.87; }
        .mkt-btn-ghost:hover { border-color: rgba(255,255,255,0.22) !important; }
        a.mkt-footer-link:hover { color: #f0f2f8 !important; }
      `}</style>

      <Nav isMobile={isMobile} />

      {/* Hero */}
      <section style={{ ...DOT_BG, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% -10%, rgba(200,168,75,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '72px 24px 64px' : '110px 24px 96px', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-block', fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2.5px', color: C.accent, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: '20px', padding: '5px 16px', marginBottom: '28px' }}>
            SECURITY WORKFORCE MANAGEMENT
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '52px' : '80px', letterSpacing: '2px', lineHeight: 1.02, color: C.text, margin: '0 0 22px', fontWeight: 700 }}>
            COMMAND YOUR<br /><span style={{ color: C.accent }}>WORKFORCE.</span>
          </h1>
          <p style={{ fontSize: isMobile ? '16px' : '18px', color: C.textSec, lineHeight: 1.75, maxWidth: '600px', margin: '0 auto 40px' }}>
            The complete security workforce management platform built for private security companies. Scheduling, timesheets, incident reporting, HR, and compliance — unified in one system.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" className="mkt-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '8px', padding: '0 32px', height: '52px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none', transition: 'opacity 150ms ease' }}>
              START FREE TRIAL
            </a>
            <a href="/login" className="mkt-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '0 32px', height: '52px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', letterSpacing: '2px', textDecoration: 'none', transition: 'border-color 150ms ease' }}>
              SIGN IN
            </a>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '56px 20px' : '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '34px' : '46px', letterSpacing: '2px', color: C.text, margin: '0 0 14px', fontWeight: 700 }}>
            EVERYTHING YOU NEED
          </h2>
          <p style={{ color: C.textSec, fontSize: '15px', margin: 0, maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
            Purpose-built tools for every layer of security workforce operations.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="mkt-feat-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', transition: 'all 200ms ease', cursor: 'default' }}>
              <div style={{ width: '32px', height: '3px', background: C.accent, borderRadius: '2px', marginBottom: '16px' }} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', letterSpacing: '1px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>{f.title}</div>
              <div style={{ fontSize: '13px', color: C.textSec, lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <a href="/features" style={{ color: C.accent, fontSize: '13px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '1.5px', textDecoration: 'none' }}>
            VIEW ALL FEATURES &rarr;
          </a>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: '1px', background: C.border, maxWidth: '1100px', margin: '0 auto' }} />

      {/* Pricing teaser */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: isMobile ? '64px 20px' : '88px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '34px' : '46px', letterSpacing: '2px', color: C.text, margin: '0 0 12px', fontWeight: 700 }}>
            SIMPLE, TRANSPARENT PRICING
          </h2>
          <p style={{ color: C.textSec, fontSize: '15px', margin: '0 0 44px' }}>
            No hidden fees. Cancel anytime. 14-day free trial on all plans.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px', marginBottom: '36px' }}>
            {PLANS.map(p => (
              <div key={p.name} className="mkt-plan-card" style={{ background: p.featured ? C.accentDim : C.card, border: `1px solid ${p.featured ? C.accentBorder : C.border}`, borderRadius: '12px', padding: '28px 24px', transition: 'all 200ms ease', cursor: 'default', textAlign: 'left' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '11px', letterSpacing: '2.5px', color: p.featured ? C.accent : C.textMuted, marginBottom: '10px' }}>{p.name.toUpperCase()}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '40px', fontWeight: 700, color: C.text, lineHeight: 1, marginBottom: '4px' }}>
                  {p.price}<span style={{ fontSize: '13px', fontWeight: 400, color: C.textMuted, letterSpacing: '0' }}>/mo</span>
                </div>
                <div style={{ fontSize: '12px', color: C.textSec, fontFamily: 'system-ui, -apple-system, sans-serif', marginTop: '10px' }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '8px', padding: '0 32px', height: '50px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none' }}>
            SEE FULL PRICING
          </a>
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '72px 24px' : '100px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '36px' : '52px', letterSpacing: '2px', color: C.text, margin: '0 0 16px', fontWeight: 700 }}>
          READY TO TAKE COMMAND?
        </h2>
        <p style={{ color: C.textSec, fontSize: '15px', margin: '0 0 40px', lineHeight: 1.7 }}>
          Join security companies already running their operations on PostCommand. Start your 14-day free trial — no credit card required.
        </p>
        <a href="/register" style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#0d0f14', borderRadius: '8px', padding: '0 36px', height: '54px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: 700, letterSpacing: '2px', textDecoration: 'none' }}>
          START FREE TRIAL
        </a>
      </section>

      <Footer />
    </div>
  )
}
