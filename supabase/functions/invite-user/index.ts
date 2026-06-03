import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { email, first_name, last_name, employee_id, company_id, role } = await req.json()

  if (!email || !employee_id || !company_id) {
    return new Response(JSON.stringify({ error: 'email, employee_id, and company_id are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Generate a secure invite link via Supabase admin API
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://postcommand.app',
      data: {
        first_name,
        last_name,
        company_id,
        employee_id,
        role: role || 'officer',
      }
    })

    if (inviteError) throw new Error(inviteError.message)

    // Send branded email via send-email function
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        type: 'invite',
        to: email,
        data: {
          company_id,
          firstName: first_name,
          inviteUrl: 'https://postcommand.app',
        }
      })
    }).catch(() => {}) // non-fatal — invite was created, email is best-effort

    // Mark invitation as sent
    await supabase
      .from('employee')
      .update({ invitation_status: 'sent' })
      .eq('id', employee_id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
