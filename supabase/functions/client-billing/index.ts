// Client payment methods + autopay schedule (Stripe Connect, direct charges).
//
// Card / bank numbers are entered into Stripe's Payment Element in the browser
// and never touch this function or our database — we only receive Stripe IDs.
//
// Actions (POST { action, client_id, ... }):
//   setup_intent   → { client_secret, stripe_account_id, publishable_key }
//   save_method    → { pm_status }        { setup_intent_id } after stripe.confirmSetup()
//   save_schedule  → { next_charge_date } { autopay_enabled, frequency, start_date, days_of_month }
//   remove_method  → { ok }
//   charge_now     → { charged, amount_cents?, status? }  charge all open invoices immediately
//
// Env: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY

import {
  corsHeaders, json, getStripe, adminClient, requireBillingUser, HttpError,
  validateSchedule, nextChargeDate, todayUTC, chargeOpenInvoices, Schedule,
} from '../_shared/billing.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, client_id } = body
    const { user, companyId } = await requireBillingUser(req, ['chief', 'super_admin'])
    const supabase = adminClient()
    const stripe = getStripe()

    if (!client_id) throw new HttpError(400, 'client_id required')
    const { data: client } = await supabase.from('client').select('id, name').eq('id', client_id).eq('company_id', companyId).maybeSingle()
    if (!client) throw new HttpError(404, 'Client not found')

    const { data: account } = await supabase.from('company_payment_account').select('stripe_account_id, charges_enabled').eq('company_id', companyId).maybeSingle()
    if (!account?.charges_enabled) throw new HttpError(400, 'Connect your Stripe account in Settings → Payments before adding client billing')
    const stripeAccount = account.stripe_account_id

    const { data: billing } = await supabase.from('client_billing').select('*').eq('client_id', client_id).maybeSingle()
    const now = new Date().toISOString()

    switch (action) {
      case 'setup_intent': {
        let customerId = billing?.stripe_customer_id
        if (!customerId) {
          const { data: contact } = await supabase.from('client_contact').select('email').eq('client_id', client_id).eq('is_main_contact', true).maybeSingle()
          const customer = await stripe.customers.create({
            name: client.name,
            email: contact?.email || undefined,
            metadata: { client_id, company_id: companyId },
          }, { stripeAccount })
          customerId = customer.id
          const { error } = await supabase.from('client_billing').upsert({ client_id, company_id: companyId, stripe_customer_id: customerId, updated_at: now }, { onConflict: 'client_id' })
          if (error) throw error
        }
        const si = await stripe.setupIntents.create({
          customer: customerId,
          usage: 'off_session',
          payment_method_types: ['us_bank_account', 'card'],
          payment_method_options: {
            // 'automatic' = instant bank login when possible, otherwise manual
            // routing/account entry verified by micro-deposits.
            us_bank_account: { verification_method: 'automatic', financial_connections: { permissions: ['payment_method'] } },
          },
          metadata: { client_id, company_id: companyId },
        }, { stripeAccount })
        const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY')
        if (!publishableKey) throw new Error('STRIPE_PUBLISHABLE_KEY not configured in Supabase secrets')
        return json({ client_secret: si.client_secret, stripe_account_id: stripeAccount, publishable_key: publishableKey })
      }

      case 'save_method': {
        const { setup_intent_id } = body
        if (!setup_intent_id || !billing?.stripe_customer_id) throw new HttpError(400, 'setup_intent_id required')
        const si = await stripe.setupIntents.retrieve(setup_intent_id, { expand: ['payment_method'] }, { stripeAccount })
        if (si.customer !== billing.stripe_customer_id) throw new HttpError(403, 'Setup intent does not belong to this client')
        const pm = si.payment_method as any
        if (!pm) throw new HttpError(400, 'No payment method on setup intent')

        let pmStatus: string
        if (si.status === 'succeeded') pmStatus = 'active'
        else if (si.status === 'requires_action' && si.next_action?.type === 'verify_with_microdeposits') pmStatus = 'pending_verification'
        else throw new HttpError(400, `Payment method not confirmed (status: ${si.status})`)

        const oldPm = billing.stripe_payment_method_id
        const { error } = await supabase.from('client_billing').update({
          stripe_payment_method_id: pm.id,
          pm_type: pm.type,
          pm_brand: pm.type === 'card' ? pm.card?.brand : pm.us_bank_account?.bank_name,
          pm_last4: pm.type === 'card' ? pm.card?.last4 : pm.us_bank_account?.last4,
          pm_funding: pm.type === 'card' ? pm.card?.funding : null,
          pm_status: pmStatus,
          pending_setup_intent_id: pmStatus === 'pending_verification' ? si.id : null,
          authorized_by: user.id,
          authorized_at: now,
          updated_at: now,
        }).eq('client_id', client_id)
        if (error) throw error
        if (oldPm && oldPm !== pm.id) await stripe.paymentMethods.detach(oldPm, {}, { stripeAccount }).catch(() => {})
        return json({ pm_status: pmStatus })
      }

      case 'save_schedule': {
        const { autopay_enabled } = body
        const schedule: Schedule = {
          frequency: body.frequency,
          start_date: body.start_date || null,
          days_of_month: body.frequency === 'days_of_month' ? (body.days_of_month || []).map(Number) : null,
        }
        validateSchedule(schedule)
        if (autopay_enabled && !billing?.stripe_payment_method_id) throw new HttpError(400, 'Add a payment method before enabling auto-pay')
        const next = autopay_enabled ? nextChargeDate(schedule, todayUTC() > (schedule.start_date || '') ? todayUTC() : schedule.start_date!) : null
        const { error } = await supabase.from('client_billing').upsert({
          client_id,
          company_id: companyId,
          autopay_enabled: !!autopay_enabled,
          frequency: schedule.frequency,
          start_date: schedule.start_date,
          days_of_month: schedule.days_of_month,
          next_charge_date: next,
          updated_at: now,
        }, { onConflict: 'client_id' })
        if (error) throw error
        return json({ next_charge_date: next })
      }

      case 'remove_method': {
        if (billing?.stripe_payment_method_id) {
          await stripe.paymentMethods.detach(billing.stripe_payment_method_id, {}, { stripeAccount }).catch(() => {})
        }
        const { error } = await supabase.from('client_billing').update({
          stripe_payment_method_id: null, pm_type: null, pm_brand: null, pm_last4: null, pm_funding: null,
          pm_status: null, pending_setup_intent_id: null, autopay_enabled: false, next_charge_date: null, updated_at: now,
        }).eq('client_id', client_id)
        if (error) throw error
        return json({ ok: true })
      }

      case 'charge_now': {
        if (!billing) throw new HttpError(400, 'No payment method on file')
        const result = await chargeOpenInvoices(supabase, stripe, billing, 'manual', `manual-${crypto.randomUUID()}`)
        if (!result) return json({ charged: false })
        await supabase.from('client_billing').update({ last_charged_at: now }).eq('client_id', client_id)
        return json({ charged: true, ...result })
      }

      default:
        throw new HttpError(400, 'Unknown action')
    }
  } catch (err) {
    const e = err as any
    // Stripe card declines etc. are user-facing, not server errors.
    const status = err instanceof HttpError ? err.status : e?.type?.startsWith?.('Stripe') ? 402 : 500
    return json({ error: e.message }, status)
  }
})
