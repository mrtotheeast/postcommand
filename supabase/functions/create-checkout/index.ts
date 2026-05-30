// Create Stripe Checkout Session
// Env vars: STRIPE_SECRET_KEY, APP_URL

import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { plan_id, price_id, company_id, return_url } = await req.json()
    const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion:'2023-10-16' })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Get or create Stripe customer for this company
    const { data: sub } = await supabase.from('company_subscription').select('stripe_customer_id').eq('company_id', company_id).single()

    let customerId = sub?.stripe_customer_id
    if (!customerId) {
      // Get company info to create customer
      const { data: profile } = await supabase.from('user_profile').select('email,first_name,last_name,company_slug').eq('company_id', company_id).eq('role','super_admin').single()
      const customer = await stripe.customers.create({
        email: profile?.email,
        name: profile?.company_slug || 'PostCommand Customer',
        metadata: { company_id },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${return_url}?checkout=success&plan=${plan_id}`,
      cancel_url:  `${return_url}?checkout=cancelled`,
      subscription_data: {
        metadata: { company_id, plan_id },
        trial_period_days: 14, // 14-day free trial on upgrades
      },
      allow_promotion_codes: true,
    })

    // Store customer ID
    await supabase.from('company_subscription').upsert({
      company_id,
      stripe_customer_id: customerId,
      plan_id,
      status: 'pending_checkout',
      updated_at: new Date().toISOString(),
    }, { onConflict:'company_id' })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status:500, headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  }
})
