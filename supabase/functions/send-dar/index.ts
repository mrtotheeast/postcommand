import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { dar_id, in_app_recipients = [], external_emails = [] } = await req.json()
    if (!dar_id) return new Response(JSON.stringify({ error: 'dar_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: dar, error: darErr } = await supabase
      .from('dar')
      .select('*, site:site_id(name,city,state), company:company_id(id,name,logo_url,company_phone,company_email,company_address)')
      .eq('id', dar_id)
      .single()

    if (darErr || !dar) {
      return new Response(JSON.stringify({ error: 'DAR not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyName  = dar.company?.name || 'PostCommand'
    const siteName     = dar.site?.name || '—'
    const shiftDate    = dar.shift_date
      ? new Date(dar.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
      : '—'
    const shiftLabel   = dar.shift_label || 'General Shift'
    const pdfUrl       = dar.pdf_url || null
    const accentColor  = '#c9a227'

    // Build email HTML
    function buildEmailHtml(recipientName?: string): string {
      function row(label: string, value: string | null) {
        if (!value?.trim()) return ''
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;width:160px">
              <span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700">${label}</span>
            </td>
            <td style="padding:10px 0 10px 16px;border-bottom:1px solid #eee;vertical-align:top">
              <span style="font-size:13px;color:#333;line-height:1.6">${value.replace(/\n/g, '<br>')}</span>
            </td>
          </tr>`
      }
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <tr><td style="background:#0e1014;padding:24px 32px">
    <p style="margin:0;font-size:18px;font-weight:700;color:${accentColor};letter-spacing:2px;text-transform:uppercase">Daily Activity Report</p>
    <p style="margin:6px 0 0;font-size:12px;color:#aaa">${companyName}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 8px">
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111">${siteName}</p>
    <p style="margin:0;font-size:12px;color:#888">${shiftLabel} &middot; ${shiftDate}</p>
  </td></tr>
  <tr><td style="padding:0 32px 24px">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Officers on Duty', dar.officers_on_duty)}
      ${row('Incident Summary', dar.incident_summary)}
      ${row('Patrol Summary', dar.patrol_summary)}
      ${row('Maintenance Concerns', dar.maintenance_concerns)}
      ${row('Resident / Client Concerns', dar.resident_concerns)}
      ${row('Other Notes', dar.other_notes)}
    </table>
  </td></tr>
  ${pdfUrl ? `<tr><td style="padding:0 32px 24px"><a href="${pdfUrl}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:1px">DOWNLOAD PDF</a></td></tr>` : ''}
  <tr><td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#aaa">${companyName}${dar.company?.company_phone ? ' &middot; ' + dar.company.company_phone : ''}${dar.company?.company_email ? ' &middot; ' + dar.company.company_email : ''}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const fromAddress = 'PostCommand <noreply@postcommand.app>'
    const subject     = `Daily Activity Report — ${siteName} · ${shiftDate}`

    // Fetch in-app recipient profiles for their emails
    let inAppEmailMap: Record<string, string> = {}
    if (in_app_recipients.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profile')
        .select('id, email, first_name')
        .in('id', in_app_recipients)
      ;(profiles || []).forEach((p: { id: string; email: string; first_name: string }) => {
        inAppEmailMap[p.id] = p.email
      })
    }

    // Collect unique emails for external sends
    const allExternalEmails = new Set<string>([
      ...external_emails.filter((e: string) => e.includes('@')),
      ...Object.values(inAppEmailMap).filter(Boolean),
    ])

    // Send external emails via Resend
    const emailResults: Array<{ email: string; ok: boolean }> = []
    for (const email of allExternalEmails) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject,
            html: buildEmailHtml(),
          }),
        })
        emailResults.push({ email, ok: res.ok })
      } catch {
        emailResults.push({ email, ok: false })
      }
    }

    // Insert dar_recipient rows for in-app recipients
    if (in_app_recipients.length > 0) {
      const rows = in_app_recipients.map((uid: string) => ({
        dar_id,
        user_id: uid,
        email: inAppEmailMap[uid] || null,
        company_id: dar.company?.id || null,
      }))
      await supabase.from('dar_recipient').upsert(rows, { onConflict: 'dar_id,user_id', ignoreDuplicates: true })
    }

    // Mark DAR as sent
    await supabase
      .from('dar')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', dar_id)

    return new Response(JSON.stringify({ success: true, emailResults }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
