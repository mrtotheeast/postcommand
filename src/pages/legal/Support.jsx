import { LegalLayout, Section, P, UL } from './LegalLayout'

export default function Support() {
  return (
    <LegalLayout title="SUPPORT" lastUpdated="June 2026">

      <P>Welcome to PostCommand Support. This page is the official support URL for the PostCommand iOS and web applications.</P>

      <Section id="employees" title="For Employees">
        <P>If you are an employee who uses PostCommand through your employer:</P>
        <UL items={[
          'Contact your company administrator first for issues with your account, schedules, or timesheets',
          'Your administrator can reset your password, update your profile, and resolve access issues',
          'For app crashes or technical issues that your administrator cannot resolve, use the contact below',
        ]}/>
      </Section>

      <Section id="admins" title="For Company Administrators">
        <P><strong>Email:</strong> support@postcommand.app</P>
        <P><strong>Response time:</strong> 1 business day</P>
        <P><strong>Hours:</strong> Monday – Friday, 9am – 6pm EST</P>
        <P>When contacting support, please include:</P>
        <UL items={[
          'Your Company ID (shown in the sidebar of the app)',
          'Description of the issue and steps to reproduce it',
          'Screenshots if applicable',
          'Device type (iPhone model, iOS version, or browser)',
        ]}/>
      </Section>

      <Section id="requests" title="Feature Requests & Feedback">
        <P><strong>Feature requests:</strong> feedback@postcommand.app</P>
        <P><strong>Bug reports:</strong> support@postcommand.app with "Bug Report" in the subject line</P>
        <P>We review all feedback and prioritize features requested by multiple customers.</P>
      </Section>

      <Section id="billing" title="Billing Support">
        <P>For subscription and billing questions: billing@postcommand.app</P>
        <P>Note: PostCommand subscriptions are managed at postcommand.app — not through the Apple App Store or Google Play Store. There are no in-app purchases.</P>
      </Section>

      <Section id="privacy" title="Privacy & Data Requests">
        <P>For data export, deletion requests, or privacy questions: privacy@postcommand.app</P>
        <P>See our <a href="/privacy" style={{ color:'#c8a84b' }}>Privacy Policy</a> for information about how we handle your data.</P>
      </Section>

      <Section id="status" title="Service Status">
        <P>For real-time service status and incident updates, contact support@postcommand.app.</P>
      </Section>
    </LegalLayout>
  )
}
