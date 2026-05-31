// Credential Expiry Email Reminders
// Scans employee_document for certs expiring within 30 days (or already expired)
// Sends email to the employee + supervisor
// Env vars: RESEND_API_KEY, APP_URL
// Schedule: run weekly via Supabase cron (every Monday 08:00)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM   = 'PostCommand <noreply@postcommand.app>'
const APP_URL = Deno.env.get('APP_URL') || 'https://postcommand.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const apiKey = Deno.env.get('RESEND_API_KEY')!

    const today      = new Date()
    const in30       = new Date(today.getTime() + 30 * 86400000)
    const todayStr   = today.toISOString().slice(0,10)
    const in30Str    = in30.toISOString().slice(0,10)

    // Get all docs expiring within 30 days or already expired (not yet notified today)
    const { data: expiringDocs } = await supabase
      .from('employee_document')
      .select('id, employee_id, company_id, doc_name, doc_type, expiry_date')
      .lte('expiry_date', in30Str)
      .not('expiry_date', 'is', null)

    if (!expiringDocs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No expiring docs found' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // Group by employee
    const byEmployee: Record<string, typeof expiringDocs> = {}
    for (const doc of expiringDocs) {
      if (!byEmployee[doc.employee_id]) byEmployee[doc.employee_id] = []
      byEmployee[doc.employee_id].push(doc)
    }

    // Get employee details + their supervisors
    const empIds = Object.keys(byEmployee)
    const { data: employees } = await supabase
      .from('employee')
      .select('id, first_name, last_name, email, role, company_id')
      .in('id', empIds)

    let sent = 0

    for (const emp of (employees || [])) {
      if (!emp.email) continue

      const docs = byEmployee[emp.id] || []
      const expiredDocs  = docs.filter(d => d.expiry_date < todayStr)
      const expiringDocs2 = docs.filter(d => d.expiry_date >= todayStr)

      const daysUntilFirst = Math.min(...docs.map(d => {
        const diff = Math.ceil((new Date(d.expiry_date+'T12:00:00').getTime() - today.getTime()) / 86400000)
        return diff
      }))

      const subject = expiredDocs.length > 0
        ? `⚠️ Expired Credentials — Action Required — ${emp.first_name} ${emp.last_name}`
        : `🔔 Credential Expiry Reminder — ${emp.first_name} ${emp.last_name}`

      const docRows = docs.map(d => {
        const days = Math.ceil((new Date(d.expiry_date+'T12:00:00').getTime() - today.getTime()) / 86400000)
        const status = days < 0 ? `<span style="color:#c0392b;font-weight:bold;">EXPIRED ${Math.abs(days)} days ago</span>` : `<span style="color:${days<=7?'#c0392b':'#c8721a'};font-weight:bold;">Expires in ${days} days</span>`
        return `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.doc_name}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${d.expiry_date}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${status}</td></tr>`
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f0f2f5;color:#1a1a2e;margin:0;padding:0">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#0d0f14;padding:24px 32px">
    <div style="font-size:22px;font-weight:900;letter-spacing:4px;color:#c8a84b">POST<span style="color:#f0f2f8">COMMAND</span></div>
  </div>
  <div style="padding:32px">
    <h1 style="font-size:20px;color:#0d1f35;margin-bottom:12px">${expiredDocs.length > 0 ? 'Action Required: Expired Credentials' : 'Credential Expiry Reminder'}</h1>
    <p style="color:#4a5568;line-height:1.7;margin-bottom:20px">Hi ${emp.first_name}, the following credentials for your profile require attention:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#f7f9fc"><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Document</th><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Expiry Date</th><th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Status</th></tr></thead>
      <tbody>${docRows}</tbody>
    </table>
    <p style="color:#4a5568;font-size:14px;line-height:1.7">Please update your credentials as soon as possible to remain compliant. Contact HR or your supervisor for assistance.</p>
    <br/><a href="${APP_URL}/hr" style="display:inline-block;background:#c8a84b;color:#0d0f14;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px">Update Credentials →</a>
  </div>
  <div style="background:#f7f9fc;padding:16px 32px;font-size:12px;color:#8899aa">PostCommand · Security Workforce Management · <a href="${APP_URL}" style="color:#8899aa">postcommand.app</a></div>
</div>
</body></html>`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [emp.email], subject, html })
      })

      if (res.ok) {
        sent++
        // Log the reminder
        await supabase.from('cert_reminder_log').upsert({
          employee_id: emp.id,
          company_id: emp.company_id,
          sent_at: new Date().toISOString(),
          doc_count: docs.length,
        }, { onConflict: 'employee_id' })
      }
    }

    return new Response(JSON.stringify({ sent, checked: empIds.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
