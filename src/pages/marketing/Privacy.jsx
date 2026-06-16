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

export default function Privacy() {
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
            PRIVACY POLICY
          </h1>
          <p style={{ fontSize: '13px', color: C.textMuted, fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0 }}>
            Effective Date: June 15, 2026
          </p>
        </div>

        <p style={PROSE}>
          This Privacy Policy describes how PostCommand ("PostCommand," "we," "us," or "our") collects, uses, and shares information when you use our security workforce management platform, including our web application and mobile apps (collectively, the "Service"). By using the Service, you agree to the collection and use of information as described in this policy.
        </p>
        <p style={PROSE}>
          PostCommand is operated by PostCommand, Inc., located at 9920 Franklin Square Drive, Suite 110, Nottingham, MD 21236. If you have questions about this policy, contact us at <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a>.
        </p>

        <Section title="Information We Collect">
          <p style={PROSE}><strong style={{ color: C.text }}>Account and profile information.</strong> When a company administrator creates an account, we collect the company name, billing contact name, email address, and payment information. When officers and supervisors are added to the platform, we collect names, email addresses, job titles, and role assignments provided by the company administrator.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Usage and activity data.</strong> We collect data generated through your use of the Service, including shift records, timesheet entries, incident reports, daily activity reports, HR documents, messaging activity, audit log entries, and other content you create or upload.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Location data.</strong> When officers use the mobile app to clock in or out, we collect GPS coordinates to verify presence within assigned site geofences. When the live tracking feature is active, we collect periodic location updates scoped to active shift windows. Location data is not collected outside of active shifts.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Device and technical data.</strong> We automatically collect technical information such as IP address, browser type, device identifiers, operating system, and crash logs. This information is used to operate and improve the Service.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Communications.</strong> If you contact our support team, we retain the content of those communications to respond to your request and improve our support processes.</p>
        </Section>

        <Section title="How We Use Your Information">
          <p style={PROSE}>We use the information we collect to:</p>
          {[
            'Provide, operate, and maintain the Service and all features within it.',
            'Authenticate users and maintain the security of accounts.',
            'Verify officer locations at clock-in/clock-out against assigned site geofences.',
            'Enable supervisors to review and approve timesheets, reports, and HR documents.',
            'Deliver daily activity reports and other documents to client contacts by email.',
            'Send push notifications related to scheduling, incident alerts, SOS events, and in-app messages.',
            'Process subscription payments and manage billing.',
            'Respond to support requests and troubleshoot issues.',
            'Analyze aggregate usage patterns to improve the Service.',
            'Comply with legal obligations.',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.accent, flexShrink: 0, marginTop: '8px' }} />
              <p style={{ ...PROSE, margin: 0 }}>{item}</p>
            </div>
          ))}
        </Section>

        <Section title="Information Sharing">
          <p style={PROSE}>We do not sell your personal information. We do not share your information with third parties for their own marketing purposes. We share information only in the following circumstances:</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Within your organization.</strong> Content you create in PostCommand — such as timesheets, reports, and HR records — is shared with others in your company according to the permissions assigned by your administrator. Client contacts receive only the documents specifically delivered to them, such as daily activity reports.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Service providers.</strong> We work with third-party vendors who help us operate the Service, including cloud infrastructure providers, payment processors, and email delivery services. These vendors are contractually required to protect your data and may only use it to provide services to us.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Legal requirements.</strong> We may disclose information if required by law, court order, or governmental authority, or when we believe disclosure is necessary to protect the safety of any person, to address fraud or security issues, or to protect our legal rights.</p>
          <p style={PROSE}><strong style={{ color: C.text }}>Business transfers.</strong> If PostCommand is acquired or merges with another company, your information may be transferred as part of that transaction. We will notify you before your information becomes subject to a different privacy policy.</p>
        </Section>

        <Section title="Data Security">
          <p style={PROSE}>We implement industry-standard security measures to protect your data, including encryption in transit (TLS) and encryption at rest for stored data. Access to production systems is restricted to authorized personnel only. Despite these measures, no system is completely secure, and we cannot guarantee absolute security. If you believe your account has been compromised, contact us immediately at <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a>.</p>
        </Section>

        <Section title="Data Retention">
          <p style={PROSE}>We retain your data for as long as your account is active or as needed to provide the Service. If you cancel your subscription, your account data is retained for 30 days to allow for account reactivation or data export, after which it is deleted from our systems. Certain records may be retained longer if required by law.</p>
          <p style={PROSE}>Location data collected during shift clock-in/clock-out is retained as part of the timesheet record and follows the same retention schedule as other operational data.</p>
        </Section>

        <Section title="Your Rights and Choices">
          <p style={PROSE}>Depending on your location, you may have certain rights regarding your personal information, including the right to access, correct, or delete information we hold about you. Company administrators can update most profile and account information directly within the platform. For requests related to deletion or data export, contact us at <a href="mailto:support@postcommand.app" style={{ color: C.accent, textDecoration: 'none' }}>support@postcommand.app</a>.</p>
          <p style={PROSE}>If you are an individual user (officer or supervisor) whose information was added by your employer, please contact your company administrator for requests related to your employment records within PostCommand.</p>
        </Section>

        <Section title="Children's Privacy">
          <p style={PROSE}>The Service is designed for use by security professionals in a business context. We do not knowingly collect personal information from individuals under the age of 18. If you believe we have inadvertently collected information from a minor, contact us and we will take steps to delete it.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p style={PROSE}>We may update this Privacy Policy from time to time. When we do, we will revise the effective date at the top of this page and, for material changes, notify account administrators by email. Your continued use of the Service after a policy update constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="Contact Us">
          <p style={PROSE}>If you have questions or concerns about this Privacy Policy or how we handle your data, contact us at:</p>
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
