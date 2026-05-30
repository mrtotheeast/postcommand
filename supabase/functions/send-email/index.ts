// PostCommand Email Service — Resend API
// Env vars: RESEND_API_KEY, FROM_EMAIL (default: noreply@postcommand.app)
// Docs: https://resend.com/docs/api-reference/emails/send-email

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'PostCommand <noreply@postcommand.app>'

// ── HTML email template ───────────────────────────────────────────────────────

function template(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f0f2f5; color:#1a1a2e; }
  .wrap { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#0d0f14; padding:24px 32px; display:flex; align-items:center; gap:12px; }
  .logo { font-size:22px; font-weight:900; letter-spacing:4px; color:#c8a84b; }
  .logo span { color:#f0f2f8; }
  .body { padding:32px; }
  h1 { font-size:22px; font-weight:700; color:#0d1f35; margin-bottom:12px; line-height:1.3; }
  p { font-size:15px; color:#4a5568; line-height:1.7; margin-bottom:12px; }
  .cta { display:inline-block; background:#c8a84b; color:#0d0f14; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:700; font-size:14px; letter-spacing:0.5px; margin-top:8px; }
  .divider { height:1px; background:#e8edf3; margin:24px 0; }
  .meta { font-size:12px; color:#8899aa; background:#f7f9fc; padding:16px 32px; }
  .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.5px; }
  .badge-success { background:#d1fae5; color:#065f46; }
  .badge-warning { background:#fef3c7; color:#92400e; }
  .badge-danger { background:#fee2e2; color:#991b1b; }
  .badge-info { background:#dbeafe; color:#1e40af; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">POST<span>COMMAND</span></div>
  </div>
  <div class="body">
    <h1>${title}</h1>
    ${body}
    ${cta ? `<br/><a class="cta" href="${cta.url}">${cta.label}</a>` : ''}
  </div>
  <div class="meta">
    <strong>PostCommand</strong> · Security Workforce Management ·
    <a href="https://postcommand.app" style="color:#8899aa;">postcommand.app</a>
    <br/>You're receiving this because you have a PostCommand account.
  </div>
</div>
</body>
</html>`
}

// ── Email templates ───────────────────────────────────────────────────────────

const templates = {
  timesheet_approved: (d: any) => ({
    subject: `✅ Timesheet Approved — ${d.date}`,
    html: template(
      'Your timesheet has been approved.',
      `<p>Hi ${d.firstName},</p>
       <p>Your timesheet for <strong>${d.date}</strong> at <strong>${d.siteName}</strong> has been reviewed and approved.</p>
       <div class="divider"></div>
       <p><strong>Date:</strong> ${d.date}</p>
       <p><strong>Hours:</strong> ${d.hours}</p>
       <p><strong>Site:</strong> ${d.siteName}</p>`,
      { label: 'View Timesheets →', url: `${d.appUrl}/timesheets` }
    ),
  }),

  timesheet_rejected: (d: any) => ({
    subject: `⚠️ Timesheet Rejected — ${d.date}`,
    html: template(
      'Your timesheet was not approved.',
      `<p>Hi ${d.firstName},</p>
       <p>Your timesheet for <strong>${d.date}</strong> has been rejected.</p>
       ${d.reason ? `<p><strong>Reason:</strong> ${d.reason}</p>` : ''}
       <p>Please review and resubmit if needed, or contact your supervisor.</p>`,
      { label: 'View Timesheets →', url: `${d.appUrl}/timesheets` }
    ),
  }),

  schedule_published: (d: any) => ({
    subject: `📅 Your Schedule Has Been Published`,
    html: template(
      'New shifts posted to your schedule.',
      `<p>Hi ${d.firstName},</p>
       <p>Your supervisor has published ${d.shiftCount} shift${d.shiftCount !== 1 ? 's' : ''} to your schedule.</p>
       <p><strong>Period:</strong> ${d.period}</p>
       <p>Log in to view your full schedule, request swaps, or set your availability.</p>`,
      { label: 'View My Schedule →', url: `${d.appUrl}/scheduling` }
    ),
  }),

  training_assigned: (d: any) => ({
    subject: `📚 Training Assigned: ${d.courseTitle}`,
    html: template(
      `New training assigned: ${d.courseTitle}`,
      `<p>Hi ${d.firstName},</p>
       <p>You've been assigned a training course:</p>
       <div class="divider"></div>
       <p><strong>Course:</strong> ${d.courseTitle}</p>
       ${d.dueDate ? `<p><strong>Due Date:</strong> ${d.dueDate}</p>` : ''}
       ${d.duration ? `<p><strong>Duration:</strong> ${d.duration} minutes</p>` : ''}
       <div class="divider"></div>
       <p>Complete this training to stay compliant with your organization's requirements.</p>`,
      { label: 'Start Training →', url: `${d.appUrl}/training` }
    ),
  }),

  pto_approved: (d: any) => ({
    subject: `✅ PTO Approved — ${d.startDate} to ${d.endDate}`,
    html: template(
      'Your PTO request has been approved.',
      `<p>Hi ${d.firstName},</p>
       <p>Your <strong>${d.ptoType}</strong> request has been approved.</p>
       <div class="divider"></div>
       <p><strong>Dates:</strong> ${d.startDate} → ${d.endDate}</p>
       <p><strong>Days:</strong> ${d.days}</p>`,
      { label: 'View Timesheets →', url: `${d.appUrl}/timesheets` }
    ),
  }),

  pto_denied: (d: any) => ({
    subject: `❌ PTO Request Denied — ${d.startDate}`,
    html: template(
      'Your PTO request was not approved.',
      `<p>Hi ${d.firstName},</p>
       <p>Your <strong>${d.ptoType}</strong> request for <strong>${d.startDate} → ${d.endDate}</strong> was denied.</p>
       <p>Please speak with your supervisor for more information.</p>`,
      { label: 'View Timesheets →', url: `${d.appUrl}/timesheets` }
    ),
  }),

  sos_alert: (d: any) => ({
    subject: `🚨 SOS ALERT — ${d.officerName} at ${d.siteName}`,
    html: template(
      `SOS triggered by ${d.officerName}`,
      `<p>An SOS alert has been triggered by <strong>${d.officerName}</strong>.</p>
       <div class="divider"></div>
       <p><strong>Officer:</strong> ${d.officerName}</p>
       <p><strong>Site:</strong> ${d.siteName || 'Unknown'}</p>
       <p><strong>Time:</strong> ${d.time}</p>
       ${d.location ? `<p><strong>Location:</strong> ${d.location}</p>` : ''}
       <p style="color:#c0392b;font-weight:bold;">Take immediate action. Log in to PostCommand to view the live alert.</p>`,
      { label: 'View SOS Dashboard →', url: `${d.appUrl}/sos` }
    ),
  }),

  incident_submitted: (d: any) => ({
    subject: `🔔 New Incident Report — ${d.cadNumber} (${d.incidentType})`,
    html: template(
      `Incident report submitted for review`,
      `<p>A new incident report has been submitted and is awaiting your review.</p>
       <div class="divider"></div>
       <p><strong>CAD #:</strong> ${d.cadNumber}</p>
       <p><strong>Type:</strong> ${d.incidentType}</p>
       <p><strong>Site:</strong> ${d.siteName || '—'}</p>
       <p><strong>Submitted by:</strong> ${d.officerName}</p>
       <p><strong>Time:</strong> ${d.time}</p>`,
      { label: 'Review Incident →', url: `${d.appUrl}/incidents` }
    ),
  }),

  welcome: (d: any) => ({
    subject: `Welcome to PostCommand — ${d.companyName}`,
    html: template(
      `Welcome to PostCommand, ${d.firstName}!`,
      `<p>Your account has been created for <strong>${d.companyName}</strong>.</p>
       <div class="divider"></div>
       <p>To get started:</p>
       <ol style="padding-left:20px;margin:12px 0;line-height:2">
         <li>Check your email for a confirmation link from Supabase</li>
         <li>Click the link to verify your account</li>
         <li>Use the "Forgot Password" link to set your password</li>
         <li>Log in at postcommand.app</li>
       </ol>`,
      { label: 'Go to PostCommand →', url: `${d.appUrl}/login` }
    ),
  }),
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { type, to, data } = await req.json()
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not set')
    if (!to || !type) throw new Error('Missing required fields: to, type')

    const templateFn = templates[type as keyof typeof templates]
    if (!templateFn) throw new Error(`Unknown email type: ${type}`)

    const appUrl = Deno.env.get('APP_URL') || 'https://postcommand.app'
    const { subject, html } = templateFn({ ...data, appUrl })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
    })

    const result = await res.json()
    if (!res.ok) throw new Error(result.message || 'Resend API error')

    return new Response(JSON.stringify({ id: result.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('send-email error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
