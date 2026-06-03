import { LegalLayout, Section, P, UL } from './LegalLayout'

const TOC = [
  { id:'what-we-collect', label:'What We Collect' },
  { id:'why-we-collect', label:'Why We Collect It' },
  { id:'who-sees-it', label:'Who Sees Your Data' },
  { id:'location', label:'Location Data' },
  { id:'retention', label:'Data Retention' },
  { id:'third-parties', label:'Third Parties' },
  { id:'your-rights', label:'Your Rights' },
  { id:'children', label:'Children' },
  { id:'contact', label:'Contact' },
]

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="PRIVACY POLICY" lastUpdated="June 2026" toc={TOC}>

      <P>PostCommand is a workforce management platform for licensed security companies. This Privacy Policy explains how we collect, use, and protect your information when you use PostCommand.</P>
      <P><strong>This is a B2B enterprise application.</strong> Your employer (the company account holder) controls what data is collected and how long it is retained. PostCommand processes this data on your employer's behalf.</P>

      <Section id="what-we-collect" title="What We Collect">
        <P>We collect the following categories of information:</P>
        <UL items={[
          'Identity data: name, email address, phone number, employee ID number',
          'Employment data: job title, role, hire date, employment type, status',
          'Location data: GPS coordinates during clock-in/out and active patrol sessions',
          'Work records: timesheets, incident reports, patrol logs, training completions',
          'Device data: device type (iOS/Android/web), IP address, push notification token',
          'Photos: clock-in/out verification photos, profile photos (if uploaded)',
          'Documents: employment documents uploaded by HR or the employee',
        ]}/>
      </Section>

      <Section id="why-we-collect" title="Why We Collect It">
        <UL items={[
          'GPS location: to verify you are physically present at your assigned work site when clocking in or out, and to record patrol checkpoint locations',
          'Timesheets: to calculate pay hours for payroll processing',
          'Incident reports: to document workplace events for legal and compliance requirements',
          'Photos: to confirm officer identity at clock-in (per your employer\'s security policy)',
          'Training records: to track certifications required by state licensing authorities',
          'Push tokens: to deliver schedule notifications, SOS alerts, and timesheet approvals',
        ]}/>
      </Section>

      <Section id="who-sees-it" title="Who Sees Your Data">
        <P>Your data is visible to:</P>
        <UL items={[
          'You — your own records, shifts, timesheets, and reports',
          'Your employer\'s administrators and supervisors — based on their access level in PostCommand',
          'PostCommand administrators — only for platform support and maintenance purposes',
          'No other parties — we do not sell, share, or license your data to third parties for marketing',
        ]}/>
      </Section>

      <Section id="location" title="Location Data">
        <P><strong>Location is only captured in these specific situations:</strong></P>
        <UL items={[
          'When you tap Clock In: a single GPS reading verifies you are within the required distance of your assigned post',
          'When you tap Clock Out: a single GPS reading is recorded',
          'During active patrol sessions: your route is recorded between checkpoint scans',
          'When you trigger an SOS alert: your location is shared with your supervisors for emergency response',
          'Background tracking while clocked in: if enabled by your employer, your location updates every 60 seconds during an active shift for supervisor oversight',
        ]}/>
        <P><strong>Location is never collected for advertising, never sold, and never shared outside your company account.</strong></P>
      </Section>

      <Section id="retention" title="Data Retention">
        <UL items={[
          'Employment records: retained per your company\'s settings, up to 7 years after employment ends',
          'Incident reports: retained for 3 years from the incident date (required by security industry regulations)',
          'GPS location logs: retained for 90 days, then deleted',
          'Clock-in photos: retained for 1 year, then deleted',
          'Audit logs: retained for 24 months',
          'After account deletion: all personal data deleted within 30 days, anonymized aggregate statistics may be retained',
        ]}/>
      </Section>

      <Section id="third-parties" title="Third-Party Services">
        <P>PostCommand uses these third-party services to operate the platform:</P>
        <UL items={[
          'Supabase (Supabase Inc.) — database and authentication. Data stored in US-East servers.',
          'Stripe (Stripe Inc.) — payment processing for company subscriptions. Card data is never stored by PostCommand.',
          'Resend (Resend Inc.) — transactional email delivery (invites, notifications).',
          'Gusto (Gusto Inc.) — payroll processing when connected by your employer.',
          'Anthropic (Anthropic PBC) — AI features (incident writing, audit reports). Incident text may be sent to Anthropic\'s API.',
        ]}/>
      </Section>

      <Section id="your-rights" title="Your Rights">
        <UL items={[
          'Access: request a copy of all data PostCommand holds about you',
          'Correction: request correction of inaccurate data',
          'Deletion: request deletion of your data after your employment ends',
          'Export: request a machine-readable export of your employment records',
          'Opt out of marketing: PostCommand does not send marketing emails — all emails are transactional',
        ]}/>
        <P>To exercise these rights, contact your employer\'s PostCommand administrator or email <strong>privacy@postcommand.app</strong>.</P>
      </Section>

      <Section id="children" title="Children">
        <P>PostCommand is a professional workforce management platform not intended for use by anyone under 18 years of age. We do not knowingly collect data from minors.</P>
      </Section>

      <Section id="contact" title="Contact">
        <P>For privacy questions or data requests:</P>
        <UL items={[
          'Email: privacy@postcommand.app',
          'Company: Nationwide Police Services LLC',
          'Address: Maryland, USA',
        ]}/>
      </Section>
    </LegalLayout>
  )
}
