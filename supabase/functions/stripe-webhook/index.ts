// Stripe webhook — handles both endpoints registered in the Stripe dashboard:
//   1. Platform events (PostCommand subscriptions)     → STRIPE_WEBHOOK_SECRET
//   2. Connect events (companies' own Stripe accounts) → STRIPE_CONNECT_WEBHOOK_SECRET
// Every event's signature is verified; unsigned/forged requests are rejected.

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { markPaymentSucceeded, markPaymentFailed } from '../_shared/billing.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' })
const cryptoProvider = Stripe.createSubtleCryptoProvider()

async function verify(body: string, sig: string): Promise<Stripe.Event | null> {
  const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')].filter(Boolean) as string[]
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider)
    } catch { /* try next secret */ }
  }
  return null
}

Deno.serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') || ''
  const body = await req.text()
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const event = await verify(body, sig)
  if (!event) return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })

  const obj: any = event.data?.object
  const companyId = obj?.metadata?.company_id

  async function getCompanyByCustomer(customerId: string): Promise<string | null> {
    if (!customerId) return null
    const { data } = await supabase.from('company_subscription').select('company_id').eq('stripe_customer_id', customerId).maybeSingle()
    return data?.company_id || null
  }

  // Company that owns the connected account an event came from.
  async function getCompanyByAccount(accountId?: string): Promise<string | null> {
    if (!accountId) return null
    const { data } = await supabase.from('company_payment_account').select('company_id').eq('stripe_account_id', accountId).maybeSingle()
    return data?.company_id || null
  }

  try {
    // ── Connect events: client payments on a company's own Stripe account ──
    if (event.account) {
      const accountCompany = await getCompanyByAccount(event.account)
      if (!accountCompany) return new Response(JSON.stringify({ received: true, ignored: 'unknown account' }))

      switch (event.type) {
        case 'account.updated': {
          await supabase.from('company_payment_account').update({
            charges_enabled: obj.charges_enabled,
            payouts_enabled: obj.payouts_enabled,
            details_submitted: obj.details_submitted,
            updated_at: new Date().toISOString(),
          }).eq('stripe_account_id', event.account)
          break
        }
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed': {
          const paymentId = obj.metadata?.client_payment_id
          if (!paymentId) break
          const { data: p } = await supabase.from('client_payment').select('company_id').eq('id', paymentId).maybeSingle()
          if (p?.company_id !== accountCompany) break
          if (event.type === 'payment_intent.succeeded') await markPaymentSucceeded(supabase, paymentId)
          else await markPaymentFailed(supabase, paymentId, obj.last_payment_error?.message || 'Payment failed')
          break
        }
        case 'setup_intent.succeeded':
        case 'setup_intent.setup_failed': {
          // ACH micro-deposit verification finished.
          await supabase.from('client_billing').update({
            pm_status: event.type === 'setup_intent.succeeded' ? 'active' : 'failed',
            pending_setup_intent_id: null,
            updated_at: new Date().toISOString(),
          }).eq('pending_setup_intent_id', obj.id).eq('company_id', accountCompany)
          break
        }
        case 'checkout.session.completed': {
          // "Pay Now" link from an invoice email.
          const invoiceId = obj.metadata?.invoice_id
          if (obj.mode === 'payment' && invoiceId && obj.payment_status === 'paid') {
            await supabase.from('invoice').update({ status: 'paid', paid_at: new Date().toISOString() })
              .eq('id', invoiceId).eq('company_id', accountCompany)
          }
          break
        }
      }
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // ── Platform events: PostCommand subscriptions ──
    switch (event.type) {
      case 'checkout.session.completed': {
        // Only subscription checkouts activate a company plan. Previously any
        // checkout carrying company_id (e.g. an invoice Pay Now) did this too.
        const cid = companyId
        if (cid && obj.mode === 'subscription') {
          await supabase.from('company_subscription').upsert({
            company_id: cid,
            stripe_subscription_id: obj.subscription,
            stripe_customer_id: obj.customer,
            status: 'active',
          }, { onConflict: 'company_id' })
        }
        break
      }
      case 'customer.subscription.updated': {
        const cid = companyId || await getCompanyByCustomer(obj.customer)
        if (cid) {
          await supabase.from('company_subscription').upsert({
            company_id: cid,
            stripe_subscription_id: obj.id,
            status: obj.status,
            cancel_at_period_end: obj.cancel_at_period_end,
            current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
          }, { onConflict: 'company_id' })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const cid = companyId || await getCompanyByCustomer(obj.customer)
        if (cid) {
          await supabase.from('company_subscription').update({ status: 'cancelled' }).eq('company_id', cid)
          await supabase.from('notifications').insert({ company_id: cid, type: 'general', title: 'Subscription Cancelled', message: 'Your subscription has been cancelled. Some features may be restricted.', target_url: '/billing', created_at: new Date().toISOString() })
        }
        break
      }
      case 'invoice.payment_failed': {
        const cid = await getCompanyByCustomer(obj.customer)
        if (cid) {
          await supabase.from('company_subscription').update({ status: 'past_due' }).eq('company_id', cid)
          await supabase.from('notifications').insert({ company_id: cid, type: 'general', title: 'Payment Failed', message: `Payment of $${(obj.amount_due/100).toFixed(2)} failed. Update your payment method.`, target_url: '/billing', created_at: new Date().toISOString() })
        }
        break
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
