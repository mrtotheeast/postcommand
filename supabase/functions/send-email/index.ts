import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { type, to, data } = await req.json()

  // Load company branding
  const { data: company } = await supabase
    .from('company')
    .select('name, logo_url, email, phone, primary_color')
    .eq('id', data.company_id)
    .single()

  const companyName    = company?.name        || data.companyName || 'PostCommand'
  const companyLogo    = company?.logo_url    || null
  const companyEmail   = company?.email       || 'noreply@postcommand.app'
  const companyPhone   = company?.phone       || null
  const primaryColor   = company?.primary_color || '#1a2e4a'

  function branded(subject: string, body: string) {
    return {
      subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        
        <!-- Header -->
        <tr><td style="background:${primaryColor};border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
          ${companyLogo
            ? `<img src="${companyLogo}" alt="${companyName}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:8px;"/>`
            : `<div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">${companyName}</div>`
          }
          <div style="font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Powered by PostCommand</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
            ${companyName}
            ${companyPhone ? ` · ${companyPhone}` : ''}
            ${companyEmail !== 'noreply@postcommand.app' ? ` · <a href="mailto:${companyEmail}" style="color:#94a3b8;">${companyEmail}</a>` : ''}
          </div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:8px;">
            This email was sent via PostCommand Workforce Management
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
    }
  }

  let emailPayload: { subject: string; html: string } | null = null

  switch (type) {

    case 'invite': {
      const { firstName, inviteUrl } = data
      emailPayload = branded(
        `You've been invited to join ${companyName}`,
        `
        <h2 style="margin:0 0 8px;font-size:24px;color:#0f172a;">Welcome to the team, ${firstName}!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          ${companyName} has invited you to join their workforce management platform. 
          Click below to set up your account and get started.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${inviteUrl}" 
             style="display:inline-block;background:${primaryColor};color:#ffffff;font-weight:700;
                    font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;
                    padding:16px 40px;border-radius:8px;">
            Set Up My Account
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          This link expires in 24 hours. If you didn't expect this invitation, you can ignore this email.
        </p>
        `
      )
      break
    }

    case 'welcome': {
      const { firstName, loginUrl } = data
      emailPayload = branded(
        `Welcome to ${companyName}`,
        `
        <h2 style="margin:0 0 8px;font-size:24px;color:#0f172a;">You're all set, ${firstName}!</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          Your account has been confirmed. You can now log in to access your schedule, 
          timesheets, incident reports, and more.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${loginUrl || 'https://postcommand.app'}" 
             style="display:inline-block;background:${primaryColor};color:#ffffff;font-weight:700;
                    font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;
                    padding:16px 40px;border-radius:8px;">
            Log In Now
          </a>
        </div>
        `
      )
      break
    }

    case 'sos_alert': {
      const { officerName, siteName, timestamp, mapUrl } = data
      emailPayload = branded(
        `🚨 SOS Alert — ${officerName} at ${siteName}`,
        `
        <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:8px;padding:20px;margin-bottom:24px;">
          <div style="font-size:18px;font-weight:800;color:#dc2626;margin-bottom:4px;">⚠ EMERGENCY SOS TRIGGERED</div>
          <div style="font-size:14px;color:#b91c1c;">Immediate response required</div>
        </div>
        <table style="width:100%;font-size:14px;color:#475569;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;width:40%;">Officer</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${officerName}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Site</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${siteName}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;color:#0f172a;">Time</td><td style="padding:8px 0;">${timestamp}</td></tr>
        </table>
        ${mapUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${mapUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:8px;">
            View Location
          </a>
        </div>` : ''}
        `
      )
      break
    }

    case 'incident_filed': {
      const { officerName, incidentType, siteName, reportUrl } = data
      emailPayload = branded(
        `New Incident Report — ${incidentType} at ${siteName}`,
        `
        <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Incident Report Filed</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;">A new incident report has been submitted and requires your review.</p>
        <table style="width:100%;font-size:14px;color:#475569;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;width:40%;">Type</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-transform:capitalize;">${incidentType?.replace(/_/g,' ')}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Site</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${siteName}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;color:#0f172a;">Filed By</td><td style="padding:8px 0;">${officerName}</td></tr>
        </table>
        ${reportUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${reportUrl}" style="display:inline-block;background:${primaryColor};color:#ffffff;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:8px;">
            Review Report
          </a>
        </div>` : ''}
        `
      )
      break
    }

    case 'schedule_published': {
      const { weekOf, shiftCount, viewUrl } = data
      emailPayload = branded(
        `Your Schedule is Ready — Week of ${weekOf}`,
        `
        <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Schedule Published</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          Your schedule for the week of <strong>${weekOf}</strong> has been published. 
          You have <strong>${shiftCount} shift${shiftCount !== 1 ? 's' : ''}</strong> assigned.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${viewUrl || 'https://postcommand.app/scheduling'}" 
             style="display:inline-block;background:${primaryColor};color:#ffffff;font-weight:700;
                    font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;
                    padding:16px 40px;border-radius:8px;">
            View My Schedule
          </a>
        </div>
        `
      )
      break
    }

    case 'enterprise_signup_alert': {
      const { signupCompany, adminEmail, adminName, phone, state, officerCount, wantsPayroll } = data
      emailPayload = branded(
        `New Enterprise Signup — ${signupCompany}`,
        `
        <div style="background:#fff8e6;border:2px solid #c8a84b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:16px;font-weight:800;color:#0d0f14;margin-bottom:2px;">New Enterprise Account Created</div>
          <div style="font-size:13px;color:#6b5a2a;">Action may be required — review and onboard this account.</div>
        </div>
        <table style="width:100%;font-size:14px;color:#475569;border-collapse:collapse;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;width:40%;">Company</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:700;color:#0f172a;">${signupCompany}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Admin Name</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">${adminName}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Admin Email</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;"><a href="mailto:${adminEmail}" style="color:#1a56db;">${adminEmail}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">${phone}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">State</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">${state}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">Officer Count</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">${officerCount}</td></tr>
          <tr><td style="padding:10px 0;font-weight:600;color:#0f172a;">Payroll Add-on</td><td style="padding:10px 0;">${wantsPayroll}</td></tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">This alert was generated automatically when the enterprise account was created on postcommand.app.</p>
        `
      )
      break
    }

    case 'enterprise_welcome': {
      const { firstName } = data
      emailPayload = branded(
        `Welcome to PostCommand Enterprise`,
        `
        <h2 style="margin:0 0 8px;font-size:24px;color:#0f172a;">Welcome, ${firstName}!</h2>
        <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
          Your <strong>PostCommand Enterprise</strong> account has been created and your 14-day free trial has started.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          Our team will reach out within one business day to schedule your onboarding call and help you get your account fully configured — including custom integrations, data migration, and team setup.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="https://postcommand.app/login"
             style="display:inline-block;background:#c8a84b;color:#0d0f14;font-weight:700;
                    font-size:14px;letter-spacing:1px;text-transform:uppercase;text-decoration:none;
                    padding:16px 40px;border-radius:8px;">
            Sign In to PostCommand
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          Questions? Reply to this email or contact us at <a href="mailto:support@postcommand.app" style="color:#94a3b8;">support@postcommand.app</a>
        </p>
        `
      )
      break
    }

    case 'invoice': {
      const { invoiceNumber, amount, dueDate, pdf_url, total_cents, invoice_id: invoiceId } = data

      // Attempt to create a Stripe one-time checkout session for the Pay Now button.
      // Uses price_data (not price_id) so no pre-created Stripe product is needed.
      // TODO: set STRIPE_SECRET_KEY in Supabase secrets to enable Pay Now links in invoice emails.
      let payNowUrl: string | null = null
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (stripeKey && total_cents && total_cents > 0 && invoiceId) {
        try {
          const successUrl = pdf_url || 'https://postcommand.app'
          const cancelUrl  = pdf_url || 'https://postcommand.app'
          const params = new URLSearchParams()
          params.append('mode', 'payment')
          params.append('line_items[0][price_data][currency]', 'usd')
          params.append('line_items[0][price_data][unit_amount]', String(total_cents))
          params.append('line_items[0][price_data][product_data][name]', `Invoice ${invoiceNumber}`)
          params.append('line_items[0][quantity]', '1')
          params.append('success_url', `${successUrl}?payment=success`)
          params.append('cancel_url', cancelUrl)
          params.append('metadata[invoice_id]', invoiceId)
          params.append('metadata[company_id]', data.company_id || '')
          const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          })
          const stripeData = await stripeRes.json()
          if (stripeRes.ok && stripeData.url) payNowUrl = stripeData.url
        } catch {
          // Stripe session creation failed — omit Pay Now button, email still sends
        }
      }

      emailPayload = branded(
        `Invoice ${invoiceNumber} from ${companyName}`,
        `
        <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Invoice ${invoiceNumber}</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          Please find your invoice from <strong>${companyName}</strong> attached below.
        </p>
        <table style="width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;border-collapse:collapse;margin-bottom:28px;">
          <tr>
            <td style="padding:16px 20px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;width:45%;">Amount Due</td>
            <td style="padding:16px 20px;font-size:22px;font-weight:800;color:#0f172a;border-bottom:1px solid #e2e8f0;">${amount}</td>
          </tr>
          <tr>
            <td style="padding:16px 20px;font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;">Due Date</td>
            <td style="padding:16px 20px;font-size:15px;color:#0f172a;">${dueDate || '—'}</td>
          </tr>
        </table>
        ${payNowUrl ? `
        <div style="text-align:center;margin:32px 0 16px;">
          <a href="${payNowUrl}"
             style="display:inline-block;background:#0f172a;color:#ffffff;font-weight:700;
                    font-size:14px;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;
                    padding:16px 44px;border-radius:8px;">
            Pay Now
          </a>
        </div>` : ''}
        ${pdf_url ? `
        <div style="text-align:center;margin:${payNowUrl ? '8px' : '32px'} 0;">
          <a href="${pdf_url}"
             style="display:inline-block;background:#c8a84b;color:#0d0f14;font-weight:700;
                    font-size:14px;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;
                    padding:16px 44px;border-radius:8px;">
            View Invoice
          </a>
        </div>` : ''}
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
          Questions about this invoice? Reply to this email or contact us at
          <a href="mailto:${companyEmail}" style="color:#94a3b8;">${companyEmail}</a>
        </p>
        `
      )
      break
    }

    case 'invoice_reminder': {
      const { invoiceNumber, total, dueDate } = data
      emailPayload = branded(
        `Payment Reminder — Invoice ${invoiceNumber}`,
        `
        <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Friendly Payment Reminder</h2>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          This is a reminder that invoice <strong>${invoiceNumber}</strong> from <strong>${companyName}</strong> is outstanding.
        </p>
        <table style="width:100%;background:#fff8e6;border-radius:8px;border:1px solid #e9d99b;border-collapse:collapse;margin-bottom:28px;">
          <tr>
            <td style="padding:16px 20px;font-size:12px;font-weight:700;color:#92740a;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e9d99b;width:45%;">Amount Due</td>
            <td style="padding:16px 20px;font-size:22px;font-weight:800;color:#0f172a;border-bottom:1px solid #e9d99b;">${total}</td>
          </tr>
          <tr>
            <td style="padding:16px 20px;font-size:12px;font-weight:700;color:#92740a;letter-spacing:1px;text-transform:uppercase;">Due Date</td>
            <td style="padding:16px 20px;font-size:15px;color:#0f172a;">${dueDate || '—'}</td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          If you have already made payment, please disregard this notice.
          Questions? Contact us at <a href="mailto:${companyEmail}" style="color:#94a3b8;">${companyEmail}</a>
        </p>
        `
      )
      break
    }

    default:
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
  }

  // Send via Resend
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const fromName  = companyName
  const fromEmail = `noreply@postcommand.app`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: emailPayload.subject,
      html: emailPayload.html,
    }),
  })

  const result = await res.json()

  if (!res.ok) {
    return new Response(JSON.stringify({ error: result }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
