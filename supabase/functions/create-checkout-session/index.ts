import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { price_id, company_id, user_email, success_url, cancel_url } = await req.json()

    if (!price_id || !company_id) {
      return new Response(JSON.stringify({ error: 'price_id and company_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured in Supabase secrets')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Get or create Stripe customer
    const { data: sub } = await supabase.from('company_subscription').select('stripe_customer_id').eq('company_id', company_id).maybeSingle()
    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const custRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: user_email || '', 'metadata[company_id]': company_id }),
      })
      const cust = await custRes.json()
      if (!custRes.ok) throw new Error(cust.error?.message || 'Failed to create Stripe customer')
      customerId = cust.id
      await supabase.from('company_subscription').upsert({ company_id, stripe_customer_id: customerId }, { onConflict: 'company_id' })
    }

    // Create checkout session
    const params = new URLSearchParams({
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': price_id,
      'line_items[0][quantity]': '1',
      success_url: success_url || `${req.headers.get('origin')}/billing?success=true`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/billing`,
      'metadata[company_id]': company_id,
      'subscription_data[metadata][company_id]': company_id,
    })

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    const session = await sessionRes.json()
    if (!sessionRes.ok) throw new Error(session.error?.message || 'Failed to create checkout session')

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
