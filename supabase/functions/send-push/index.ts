// Send Push Notification Edge Function
// Called by: SOS triggers, incident submissions, geofence violations
// Env vars needed: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, title, body, url, target_roles } = await req.json()

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@postcommand.app',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get subscriptions for target company + optional role filter
    let query = supabase
      .from('push_subscription')
      .select('subscription_json, employee_id')
      .eq('company_id', company_id)
      .eq('active', true)

    const { data: subs } = await query

    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const payload = JSON.stringify({ title, body, url: url || '/', tag: 'postcommand' })
    let sent = 0, failed = 0

    await Promise.allSettled(
      subs.map(async ({ subscription_json, employee_id }) => {
        try {
          await webpush.sendNotification(subscription_json, payload)
          sent++
        } catch (e: any) {
          failed++
          // If subscription expired/invalid, mark as inactive
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabase.from('push_subscription').update({ active: false }).eq('employee_id', employee_id)
          }
        }
      })
    )

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
