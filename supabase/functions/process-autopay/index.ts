// Called once a day by cron-job.org (e.g. 14:00 UTC / 10:00 ET).
// For every client whose next_charge_date <= today, charges all open invoices
// on their saved payment method, then advances next_charge_date.
//
// Protected by a shared secret: send header  x-cron-secret: <CRON_SECRET>
// Env: STRIPE_SECRET_KEY, CRON_SECRET

import { corsHeaders, json, getStripe, adminClient, chargeOpenInvoices, nextChargeDate, dayAfter, todayUTC } from '../_shared/billing.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorized' }, 401)

  try {
    const supabase = adminClient()
    const stripe = getStripe()
    const today = todayUTC()

    const { data: due, error } = await supabase.from('client_billing')
      .select('*')
      .eq('autopay_enabled', true)
      .lte('next_charge_date', today)
    if (error) throw error

    let charged = 0, skipped = 0, failed = 0
    for (const billing of due || []) {
      try {
        if (billing.pm_status !== 'active') { skipped++; continue }
        // Idempotency key per client per scheduled date: a re-run of the cron the
        // same day can never create a second charge for that cycle.
        const result = await chargeOpenInvoices(supabase, stripe, billing, 'autopay', billing.next_charge_date)
        if (result) {
          charged++
          await supabase.from('client_billing').update({ last_charged_at: new Date().toISOString() }).eq('client_id', billing.client_id)
        } else skipped++
      } catch (err) {
        console.error(`Autopay failed for client ${billing.client_id}:`, err)
        failed++
      } finally {
        // Always advance, even on failure — the next cycle retries the still-open invoices.
        // Not advancing on failure would retry a declined card every day.
        const next = nextChargeDate(billing, dayAfter(today))
        await supabase.from('client_billing').update({ next_charge_date: next, updated_at: new Date().toISOString() }).eq('client_id', billing.client_id)
      }
    }

    return json({ processed: (due || []).length, charged, skipped, failed })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
