// Shared helpers for client direct-debit (Stripe Connect) edge functions.

import Stripe from 'npm:stripe@14.21.0'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function getStripe() {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured in Supabase secrets')
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// Verifies the caller's JWT and role. company_id always comes from the caller's
// own profile — never from the request body — so one company can't act on another.
export async function requireBillingUser(req: Request, roles: string[]) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) throw new HttpError(401, 'Missing authorization header')
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new HttpError(401, 'Unauthorized')
  const { data: profile } = await userClient.from('user_profile').select('role, company_id').eq('id', user.id).single()
  if (!profile?.company_id || !roles.includes(profile.role)) throw new HttpError(403, 'Forbidden')
  return { user, role: profile.role as string, companyId: profile.company_id as string }
}

// ── Schedule math ─────────────────────────────────────────────────────────────
// Dates are 'YYYY-MM-DD' strings handled in UTC to avoid DST drift.

export type Schedule = {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'days_of_month'
  start_date?: string | null
  days_of_month?: number[] | null
}

const DAY_MS = 86_400_000
const toDate = (s: string) => new Date(`${s}T00:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

export function todayUTC() { return fmt(new Date()) }

// First charge date that is >= onOrAfter.
export function nextChargeDate(s: Schedule, onOrAfter: string): string {
  const from = toDate(onOrAfter)
  switch (s.frequency) {
    case 'daily':
      return fmt(from)
    case 'weekly':
    case 'biweekly': {
      const step = s.frequency === 'weekly' ? 7 : 14
      const start = toDate(s.start_date || onOrAfter)
      if (start >= from) return fmt(start)
      const periods = Math.ceil((from.getTime() - start.getTime()) / (step * DAY_MS))
      return fmt(new Date(start.getTime() + periods * step * DAY_MS))
    }
    case 'days_of_month': {
      const days = [...new Set(s.days_of_month || [])].filter(d => d >= 1 && d <= 31).sort((a, b) => a - b)
      if (!days.length) throw new Error('days_of_month is empty')
      const floor = s.start_date && toDate(s.start_date) > from ? toDate(s.start_date) : from
      for (let i = 0; i < 14; i++) {
        const y = floor.getUTCFullYear(), m = floor.getUTCMonth() + i
        const yy = y + Math.floor(m / 12), mm = m % 12
        const dim = daysInMonth(yy, mm)
        // Clamp (e.g. 31 → 30 in April); dedupe in case 30 & 31 both clamp to 30.
        for (const d of [...new Set(days.map(d => Math.min(d, dim)))]) {
          const candidate = new Date(Date.UTC(yy, mm, d))
          if (candidate >= floor) return fmt(candidate)
        }
      }
      throw new Error('Could not compute next charge date')
    }
  }
}

export function dayAfter(s: string) { return fmt(new Date(toDate(s).getTime() + DAY_MS)) }

export function validateSchedule(s: Schedule) {
  if (!['daily', 'weekly', 'biweekly', 'days_of_month'].includes(s.frequency)) throw new HttpError(400, 'Invalid frequency')
  if ((s.frequency === 'weekly' || s.frequency === 'biweekly') && !/^\d{4}-\d{2}-\d{2}$/.test(s.start_date || '')) {
    throw new HttpError(400, 'start_date required for weekly / bi-weekly')
  }
  if (s.frequency === 'days_of_month') {
    const d = s.days_of_month || []
    if (!d.length || d.some(x => !Number.isInteger(x) || x < 1 || x > 31)) throw new HttpError(400, 'Pick at least one day of the month (1–31)')
  }
}

// ── Charging ──────────────────────────────────────────────────────────────────
// Charges all open (sent/overdue) invoices for a client that aren't already
// locked by an in-flight payment. Returns null if there's nothing to charge.
// Shared by process-autopay (cron) and client-billing "charge_now".

export async function chargeOpenInvoices(
  supabase: SupabaseClient,
  stripe: Stripe,
  billing: any,
  trigger: 'autopay' | 'manual',
  idempotencySuffix: string,
) {
  const { data: account } = await supabase.from('company_payment_account')
    .select('stripe_account_id, charges_enabled, card_surcharge_pct')
    .eq('company_id', billing.company_id).maybeSingle()
  if (!account?.charges_enabled) throw new Error('Company Stripe account is not enabled for charges')
  if (billing.pm_status !== 'active' || !billing.stripe_payment_method_id) throw new Error('No verified payment method on file')

  const { data: invoices, error } = await supabase.from('invoice')
    .select('id, invoice_number, total')
    .eq('company_id', billing.company_id)
    .eq('client_id', billing.client_id)
    .in('status', ['sent', 'overdue'])
    .is('autopay_payment_id', null)
  if (error) throw error
  const open = (invoices || []).filter(i => Number(i.total) > 0)
  if (!open.length) return null

  const baseCents = open.reduce((a, i) => a + Math.round(Number(i.total) * 100), 0)
  // Surcharge credit cards only — surcharging debit/prepaid cards is prohibited by card network rules.
  const surchargeCents = billing.pm_type === 'card' && billing.pm_funding === 'credit'
    ? Math.round(baseCents * Number(account.card_surcharge_pct || 0) / 100)
    : 0
  const amountCents = baseCents + surchargeCents
  if (amountCents < 50) return null // Stripe minimum

  const { data: payment, error: payErr } = await supabase.from('client_payment').insert({
    company_id: billing.company_id,
    client_id: billing.client_id,
    invoice_ids: open.map(i => i.id),
    amount_cents: amountCents,
    surcharge_cents: surchargeCents,
    pm_type: billing.pm_type,
    trigger,
  }).select('id').single()
  if (payErr) throw payErr

  // Lock invoices before charging so a concurrent run can't double-charge.
  const { data: locked } = await supabase.from('invoice')
    .update({ autopay_payment_id: payment.id })
    .in('id', open.map(i => i.id))
    .is('autopay_payment_id', null)
    .select('id')
  if ((locked || []).length !== open.length) {
    await supabase.from('invoice').update({ autopay_payment_id: null }).eq('autopay_payment_id', payment.id)
    await supabase.from('client_payment').update({ status: 'failed', failure_message: 'Invoices changed during charge — retry' }).eq('id', payment.id)
    return null
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: billing.stripe_customer_id,
      payment_method: billing.stripe_payment_method_id,
      payment_method_types: [billing.pm_type],
      off_session: true,
      confirm: true,
      description: `Invoices ${open.map(i => i.invoice_number).join(', ')}`,
      metadata: {
        client_payment_id: payment.id,
        company_id: billing.company_id,
        client_id: billing.client_id,
        surcharge_cents: String(surchargeCents),
      },
    }, {
      stripeAccount: account.stripe_account_id,
      idempotencyKey: `autopay-${billing.client_id}-${idempotencySuffix}`,
    })

    await supabase.from('client_payment').update({ stripe_payment_intent_id: pi.id, updated_at: new Date().toISOString() }).eq('id', payment.id)
    // Cards usually succeed synchronously; ACH stays 'processing' until the webhook.
    if (pi.status === 'succeeded') await markPaymentSucceeded(supabase, payment.id)
    return { payment_id: payment.id, amount_cents: amountCents, status: pi.status }
  } catch (err) {
    await markPaymentFailed(supabase, payment.id, (err as Error).message)
    throw err
  }
}

export async function markPaymentSucceeded(supabase: SupabaseClient, paymentId: string) {
  const now = new Date().toISOString()
  const { data: p } = await supabase.from('client_payment')
    .update({ status: 'succeeded', failure_message: null, updated_at: now })
    .eq('id', paymentId).neq('status', 'succeeded').select('id').maybeSingle()
  if (!p) return // already processed (webhook retry or sync success)
  await supabase.from('invoice').update({ status: 'paid', paid_at: now }).eq('autopay_payment_id', paymentId)
}

export async function markPaymentFailed(supabase: SupabaseClient, paymentId: string, message: string) {
  const { data: p } = await supabase.from('client_payment')
    .update({ status: 'failed', failure_message: message, updated_at: new Date().toISOString() })
    .eq('id', paymentId).neq('status', 'failed').select('company_id, client_id, amount_cents').maybeSingle()
  if (!p) return // already handled (sync decline + webhook both report the failure)
  // Unlock invoices (and revert to unpaid if an ACH payment was returned after success) so the next cycle retries.
  await supabase.from('invoice').update({ status: 'sent', paid_at: null })
    .eq('autopay_payment_id', paymentId).eq('status', 'paid')
  await supabase.from('invoice').update({ autopay_payment_id: null }).eq('autopay_payment_id', paymentId)
  const { data: client } = await supabase.from('client').select('name').eq('id', p.client_id).maybeSingle()
  await supabase.from('notifications').insert({
    company_id: p.company_id,
    type: 'general',
    title: 'Client Payment Failed',
    message: `Auto-debit of $${(p.amount_cents / 100).toFixed(2)} for ${client?.name || 'client'} failed: ${message}`,
    target_url: '/clients',
    created_at: new Date().toISOString(),
  })
}
