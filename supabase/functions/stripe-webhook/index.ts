import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const sig    = req.headers.get('stripe-signature') || ''
  const body   = await req.text()
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let event: any
  try {
    event = JSON.parse(body)
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const obj = event.data?.object
  const companyId = obj?.metadata?.company_id

  async function getCompanyByCustomer(customerId: string): Promise<string | null> {
    if (!customerId) return null
    const { data } = await supabase.from('company_subscription').select('company_id').eq('stripe_customer_id', customerId).maybeSingle()
    return data?.company_id || null
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const cid = companyId
        if (cid) {
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
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
