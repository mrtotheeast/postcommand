// Stripe Webhook Handler
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body      = await req.text()

  const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion:'2023-10-16' })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  } catch (e) {
    return new Response(`Webhook signature failed: ${e.message}`, { status:400 })
  }

  const sub = event.data.object as any

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = sub as Stripe.CheckoutSession
      if (session.mode === 'subscription') {
        const { company_id, plan_id } = session.subscription_data?.metadata || {}
        if (company_id) {
          await supabase.from('company_subscription').upsert({
            company_id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan_id: plan_id || 'growth',
            status: 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict:'company_id' })
        }
      }
      break
    }
    case 'customer.subscription.updated': {
      const { company_id, plan_id } = sub.metadata || {}
      if (company_id) {
        await supabase.from('company_subscription').update({
          status: sub.status,
          plan_id: plan_id || sub.items?.data?.[0]?.price?.metadata?.plan_id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq('company_id', company_id)
      }
      break
    }
    case 'customer.subscription.deleted': {
      const { company_id } = sub.metadata || {}
      if (company_id) {
        await supabase.from('company_subscription').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('company_id', company_id)
      }
      break
    }
    case 'invoice.payment_failed': {
      const customerId = sub.customer as string
      await supabase.from('company_subscription').update({ status:'past_due', updated_at:new Date().toISOString() }).eq('stripe_customer_id', customerId)
      break
    }
    case 'invoice.paid': {
      const customerId = sub.customer as string
      await supabase.from('company_subscription').update({ status:'active', updated_at:new Date().toISOString() }).eq('stripe_customer_id', customerId)
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type':'application/json' } })
})
