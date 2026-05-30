// Stripe Customer Portal Session
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { company_id, return_url } = await req.json()
    const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion:'2023-10-16' })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data } = await supabase.from('company_subscription').select('stripe_customer_id').eq('company_id', company_id).single()
    if (!data?.stripe_customer_id) throw new Error('No Stripe customer found')
    const session = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url })
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type':'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status:500, headers: { ...cors, 'Content-Type':'application/json' } })
  }
})
