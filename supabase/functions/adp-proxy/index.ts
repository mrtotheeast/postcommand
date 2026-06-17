import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ADP Workforce Now Integration Proxy
// Documentation: https://developers.adp.com/
// Auth: OAuth 2.0 with client credentials
// Required secrets: ADP_CLIENT_ID, ADP_CLIENT_SECRET, ADP_CERT (SSL cert for mTLS)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, company_id, data } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify company has ADP addon enabled
    const { data: company } = await supabase
      .from('company')
      .select('id, name, payroll_addon')
      .eq('id', company_id)
      .single()

    if (!company?.payroll_addon) {
      return new Response(JSON.stringify({ error: 'Payroll addon not enabled for this company' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ADP OAuth token endpoint: https://accounts.adp.com/auth/oauth/v2/token
    // This requires mTLS (mutual TLS) with ADP-issued certificate
    // Until ADP API credentials are provisioned, return a structured placeholder
    // that the frontend can detect and show "pending connection" UI

    if (action === 'status') {
      return new Response(JSON.stringify({
        connected: false,
        message: 'ADP credentials pending. Contact support@postcommand.app to complete setup.',
        required_secrets: ['ADP_CLIENT_ID', 'ADP_CLIENT_SECRET', 'ADP_CERT']
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'sync_timesheets') {
      // Will sync approved timesheets to ADP once credentials are set
      // ADP endpoint: POST /hr/v2/workers/{associateOID}/businessCommunication/payroll
      const adpClientId = Deno.env.get('ADP_CLIENT_ID')
      if (!adpClientId) {
        return new Response(JSON.stringify({ error: 'ADP credentials not configured' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      // TODO: implement full OAuth + timesheet sync when credentials are provisioned
      return new Response(JSON.stringify({ success: false, message: 'ADP sync pending credential setup' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
