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

function Section({ title, children }) {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '36px', marginBottom: '36px' }}>
      <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', letterSpacing: '1.5px', color: '#c8a84b', margin: '0 0 16px', fontWeight: 700 }}>
        {title.toUpperCase()}
      </h2>
      {children}
    </div>
  )
}

const PROSE = { fontSize: '14px', color: 'rgba(240,242,248,0.65)', lineHeight: 1.75, margin: '0 0 14px', fontFamily: 'system-ui, -apple-system, sans-serif' }

export default function Terms() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Nav isMobile={isMobile} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: isMobile ? '56px 24px 80px' : '80px 40px 100px' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '11px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '2.5px', color: C.accent, marginBottom: '12px' }}>LEGAL</div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: isMobile ? '38px' : '52px', letterSpacing: '2px', color: C.text, margin: '0 0 12px', fontWeight: 700 }}>
            TERMS OF SERVICE
          </h1>
          <p style={{ fontSize: '13px', color: C.textMuted, fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0 }}>
            Effective Date: June 15, 2026
          </p>
        </div>

        <p style={PROSE}>
          These Terms of Service ("Terms") govern your access to and use of the PostCommand security workforce management platform, including our web application and mobile apps (the "Service"). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.
        </p>
        <p style={PROSE}>
          The Service is provided by PostCommand, Inc., located at 9920 Franklin Square Drive, Suite 110, Nottingham, MD 21236 ("PostCommand," "we," "us," or "our"). Questions regarding these Terms may be sent to <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a>.
        </p>

        <Section title="Account Registration">
          <p style={PROSE}>To use the Service, the company administrator must register for an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a> if you suspect unauthorized access to your account.</p>
          <p style={PROSE}>Each account represents a single company or organization. You may not share a single account across multiple unrelated businesses. Reselling or sublicensing access to the Service to third parties without our written consent is prohibited.</p>
        </Section>

        <Section title="Acceptable Use">
          <p style={PROSE}>You agree to use the Service only for lawful purposes and in accordance with these Terms. You may not use the Service to:</p>
          {[
            'Violate any applicable federal, state, or local law or regulation.',
            'Collect, store, or transmit the personal information of individuals without proper authority or consent as required by law.',
            'Upload content that is unlawful, defamatory, harassing, obscene, or that infringes on the intellectual property rights of others.',
            'Attempt to gain unauthorized access to any portion of the Service or its related systems.',
            'Interfere with or disrupt the integrity or performance of the Service.',
            'Use automated tools, scripts, or bots to access the Service in ways that exceed normal use.',
            'Reverse engineer, decompile, or disassemble any software underlying the Service.',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: '8px' }} />
              <p style={{ ...PROSE, margin: 0 }}>{item}</p>
            </div>
          ))}
          <p style={{ ...PROSE, marginTop: '14px' }}>We reserve the right to suspend or terminate accounts that violate these restrictions without prior notice.</p>
        </Section>

        <Section title="Subscription and Payment">
          <p style={PROSE}>Access to the Service requires a paid subscription after the expiration of the 14-day free trial. Subscription fees are billed monthly in advance. All fees are stated in U.S. dollars and are non-refundable except as required by law or as explicitly stated herein.</p>
          <p style={PROSE}>You authorize us to charge your designated payment method on the billing cycle selected at signup. If a payment fails, we will notify you and your account may be suspended until payment is received. We reserve the right to change subscription fees with 30 days written notice to the account administrator's email address on file.</p>
          <p style={PROSE}>Additional officer seats beyond your plan limit are billed at the rates disclosed in the pricing schedule at the time of addition. Changes to officer counts are reflected in the following billing cycle.</p>
        </Section>

        <Section title="Intellectual Property">
          <p style={PROSE}>PostCommand and its licensors retain all rights, title, and interest in and to the Service, including all software, designs, trademarks, and documentation. These Terms do not grant you any ownership rights in the Service.</p>
          <p style={PROSE}>You retain ownership of all content you create or upload through the Service ("Customer Data"), including incident reports, timesheets, HR documents, and other records. You grant us a limited license to host, process, and transmit your Customer Data solely to provide the Service. We will not use your Customer Data for any purpose beyond operating and improving the Service.</p>
        </Section>

        <Section title="Data and Privacy">
          <p style={PROSE}>Our collection and use of personal information in connection with the Service is governed by our <a href="/privacy" style={{ color: C.accent, textDecoration: 'none' }}>Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the data practices described in the Privacy Policy.</p>
          <p style={PROSE}>You are responsible for obtaining any necessary consents from your officers and employees before adding their personal information to the Service, including consent to GPS location collection during active shifts as described in the Privacy Policy.</p>
        </Section>

        <Section title="Termination">
          <p style={PROSE}>You may cancel your subscription at any time from your account billing settings. Cancellation takes effect at the end of the current billing period and you retain access to the Service through that date. No partial refunds are issued for unused time within a billing period.</p>
          <p style={PROSE}>We may suspend or terminate your account immediately if you violate these Terms, fail to pay subscription fees after notice, or if we are required to do so by law. Upon termination, your right to access the Service ends. Your data will be retained for 30 days after termination to allow for export, after which it will be permanently deleted.</p>
        </Section>

        <Section title="Disclaimers and Limitation of Liability">
          <p style={PROSE}>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free from security vulnerabilities. Your use of the Service is at your sole risk.</p>
          <p style={PROSE}>To the maximum extent permitted by applicable law, PostCommand's total liability to you for any claims arising out of or related to these Terms or the Service shall not exceed the total fees paid by you in the twelve months preceding the claim. In no event shall PostCommand be liable for any indirect, incidental, consequential, special, or exemplary damages, including loss of profits, data, or business opportunities, even if advised of the possibility of such damages.</p>
        </Section>

        <Section title="Governing Law and Disputes">
          <p style={PROSE}>These Terms are governed by the laws of the State of Maryland, without regard to conflict of law principles. Any disputes arising out of or related to these Terms or the Service shall be resolved in the state or federal courts located in Baltimore County, Maryland, and you consent to personal jurisdiction in those courts.</p>
          <p style={PROSE}>Before filing any formal legal action, you agree to contact us at <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a> and attempt to resolve the dispute informally for at least 30 days.</p>
        </Section>

        <Section title="Changes to These Terms">
          <p style={PROSE}>We may update these Terms from time to time. When we do, we will revise the effective date at the top of this page. For material changes, we will notify account administrators by email at least 14 days before the change takes effect. Your continued use of the Service after the effective date of updated Terms constitutes acceptance of the changes.</p>
        </Section>

        <Section title="Contact Us">
          <p style={PROSE}>For questions about these Terms or the Service, contact us at:</p>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '20px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px', color: C.textSec, lineHeight: 1.75 }}>
            PostCommand, Inc.<br />
            9920 Franklin Square Drive, Suite 110<br />
            Nottingham, MD 21236<br />
            <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a>
          </div>
        </Section>
      </div>

      <Footer />
    </div>
  )
}
