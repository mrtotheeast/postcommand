import { LegalLayout, Section, P, UL } from './LegalLayout'

const TOC = [
  { id:'service', label:'Service Description' },
  { id:'accounts', label:'Accounts' },
  { id:'use', label:'Acceptable Use' },
  { id:'payment', label:'Payment & Billing' },
  { id:'data', label:'Data Ownership' },
  { id:'termination', label:'Termination' },
  { id:'liability', label:'Liability' },
  { id:'law', label:'Governing Law' },
  { id:'contact', label:'Contact' },
]

export default function TermsOfService() {
  return (
    <LegalLayout title="TERMS OF SERVICE" lastUpdated="June 2026" toc={TOC}>

      <P>These Terms of Service govern your use of PostCommand, a B2B workforce management platform operated by Nationwide Police Services LLC ("PostCommand," "we," "us").</P>
      <P>By using PostCommand, you agree to these terms. If you are using PostCommand on behalf of a company, you represent that you have authority to bind that company.</P>

      <Section id="service" title="Service Description">
        <P>PostCommand is a cloud-based security workforce management platform providing scheduling, timekeeping, incident reporting, patrol tracking, HR document management, payroll integration, and compliance tools for licensed security companies.</P>
      </Section>

      <Section id="accounts" title="Accounts">
        <P>PostCommand operates two types of accounts:</P>
        <UL items={[
          'Company accounts: created by a security company administrator. The company account holder is responsible for all users under their account.',
          'Employee accounts: created by the company administrator via invitation. Employees access PostCommand using the credentials provided.',
          'There is no public self-registration. All accounts require employer authorization.',
          'You are responsible for maintaining the security of your account credentials.',
        ]}/>
      </Section>

      <Section id="use" title="Acceptable Use">
        <P>PostCommand is licensed exclusively for use in security industry workforce management. You agree not to:</P>
        <UL items={[
          'Use PostCommand for any purpose other than authorized workforce management',
          'Attempt to reverse-engineer, decompile, or extract our source code',
          'Access PostCommand accounts you are not authorized to use',
          'Upload malicious code, spam, or content that violates applicable law',
          'Use PostCommand to discriminate against employees in violation of applicable employment law',
          'Resell, sublicense, or transfer your PostCommand subscription without our written consent',
        ]}/>
      </Section>

      <Section id="payment" title="Payment & Billing">
        <UL items={[
          'Subscriptions are billed to the company account, not individual employees',
          'Pricing is based on plan tier (Standard or Professional), not per individual user',
          'Payment is due monthly in advance',
          'Failed payments result in account suspension after 7 days notice',
          'No refunds for partial months',
          'Price changes will be communicated 30 days in advance',
          'On iOS: subscriptions are managed at postcommand.app, not through the App Store',
        ]}/>
      </Section>

      <Section id="data" title="Data Ownership">
        <P>You own your data. PostCommand processes it on your behalf.</P>
        <UL items={[
          'Your company retains ownership of all employee records, incident reports, timesheets, and other data you create in PostCommand',
          'PostCommand does not sell, license, or use your data for any purpose other than providing the PostCommand service',
          'You may export your data at any time in CSV or PDF format',
          'PostCommand may use anonymized, aggregated, non-identifying data for service improvement',
        ]}/>
      </Section>

      <Section id="termination" title="Termination">
        <UL items={[
          'You may cancel your subscription at any time with 30 days written notice',
          'Upon cancellation, your data will be available for export for 30 days, then permanently deleted',
          'PostCommand may suspend or terminate accounts that violate these terms, with immediate notice for serious violations',
          'After termination, all employee access is revoked and data is deleted per our retention policy',
        ]}/>
      </Section>

      <Section id="liability" title="Limitation of Liability">
        <P>PostCommand is provided "as is" without warranty of any kind. To the maximum extent permitted by law:</P>
        <UL items={[
          'PostCommand is not liable for indirect, incidental, special, or consequential damages',
          'Our total liability to you shall not exceed the fees you paid in the 3 months prior to the claim',
          'PostCommand is not responsible for regulatory compliance decisions made using data in our platform',
          'We do not guarantee 100% uptime but target 99.9% monthly availability',
        ]}/>
      </Section>

      <Section id="law" title="Governing Law">
        <P>These terms are governed by the laws of the State of Maryland, USA. Any disputes shall be resolved in the courts of Maryland. Both parties consent to personal jurisdiction in Maryland.</P>
      </Section>

      <Section id="contact" title="Contact">
        <UL items={[
          'General: legal@postcommand.app',
          'Support: support@postcommand.app',
          'Company: Nationwide Police Services LLC, Maryland, USA',
        ]}/>
      </Section>
    </LegalLayout>
  )
}
