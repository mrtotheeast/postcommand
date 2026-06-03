import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GUSTO_BASE = 'https://api.gusto.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const clientSecret = Deno.env.get('GUSTO_CLIENT_SECRET')
  const clientId     = Deno.env.get('GUSTO_CLIENT_ID')

  const { action, company_id, ...rest } = await req.json()

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.from('gusto_connection').select('*').eq('company_id', company_id).single()
    if (!data) return null
    // Refresh if expired
    if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
      const res = await fetch('https://api.gusto.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token, client_id: clientId!, client_secret: clientSecret! }),
      })
      const tok = await res.json()
      if (tok.access_token) {
        const expires = new Date(Date.now() + tok.expires_in * 1000).toISOString()
        await supabase.from('gusto_connection').update({ access_token: tok.access_token, refresh_token: tok.refresh_token || data.refresh_token, token_expires_at: expires }).eq('company_id', company_id)
        return tok.access_token
      }
      return null
    }
    return data.access_token
  }

  async function gustoGet(path: string): Promise<any> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not connected to Gusto')
    const res = await fetch(`${GUSTO_BASE}${path}`, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
    if (!res.ok) { const err = await res.text(); throw new Error(`Gusto API error: ${err}`) }
    return res.json()
  }

  async function gustoPost(path: string, body: any): Promise<any> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not connected to Gusto')
    const res = await fetch(`${GUSTO_BASE}${path}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const err = await res.text(); throw new Error(`Gusto API error: ${err}`) }
    return res.json()
  }

  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }

  try {
    switch (action) {

      case 'exchange-code': {
        // Exchange OAuth code for tokens
        const res = await fetch('https://api.gusto.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code: rest.code, redirect_uri: rest.redirect_uri, client_id: clientId!, client_secret: clientSecret! }),
        })
        const tok = await res.json()
        if (!tok.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(tok))
        // Get company info
        const me = await fetch(`${GUSTO_BASE}/v1/me`, { headers: { 'Authorization': `Bearer ${tok.access_token}` } })
        const meData = await me.json()
        const gustoCompanyId = meData?.roles?.payroll_admin?.companies?.[0]?.id || null
        const gustoCompanyName = meData?.roles?.payroll_admin?.companies?.[0]?.name || null
        const expires = new Date(Date.now() + tok.expires_in * 1000).toISOString()
        await supabase.from('gusto_connection').upsert({
          company_id, gusto_company_id: String(gustoCompanyId), gusto_company_name: gustoCompanyName,
          access_token: tok.access_token, refresh_token: tok.refresh_token, token_expires_at: expires,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'company_id' })
        return new Response(JSON.stringify({ ok: true, company_name: gustoCompanyName }), { headers: cors })
      }

      case 'submit-payroll': {
        const { data: conn } = await supabase.from('gusto_connection').select('gusto_company_id').eq('company_id', company_id).single()
        if (!conn?.gusto_company_id) throw new Error('Gusto company ID not found')
        // Create payroll run in Gusto
        const payroll = await gustoPost(`/v1/companies/${conn.gusto_company_id}/payrolls`, {
          off_cycle: true,
          check_date: rest.pay_period_end,
          start_date: rest.pay_period_start,
          end_date:   rest.pay_period_end,
        })
        // Store run locally
        const totalGross = rest.employees?.reduce((a: number, e: any) => a + ((e.hours || 0) * (e.pay_rate || 0)), 0) || null
        await supabase.from('payroll_run').insert({
          company_id, gusto_payroll_id: String(payroll.id),
          pay_period_start: rest.pay_period_start, pay_period_end: rest.pay_period_end,
          status: 'submitted', total_gross: totalGross, submitted_at: new Date().toISOString(),
        })
        return new Response(JSON.stringify({ ok: true, message: `Payroll submitted to Gusto (ID: ${payroll.id}). Processing within 2 business days.` }), { headers: cors })
      }

      case 'sync-employees': {
        // Push PostCommand employees to Gusto (simplified)
        const { data: emps } = await supabase.from('employee').select('id,first_name,last_name,email').eq('company_id', company_id).eq('status','active')
        const { data: conn2 } = await supabase.from('gusto_connection').select('gusto_company_id').eq('company_id', company_id).single()
        let synced = 0
        for (const emp of (emps || [])) {
          if (!emp.email) continue
          try {
            await gustoPost(`/v1/companies/${conn2?.gusto_company_id}/employees`, {
              first_name: emp.first_name, last_name: emp.last_name, email: emp.email,
            })
            synced++
          } catch {}
        }
        await supabase.from('gusto_connection').update({ last_sync_at: new Date().toISOString() }).eq('company_id', company_id)
        return new Response(JSON.stringify({ ok: true, synced }), { headers: cors })
      }

      case 'pay-stub-url': {
        const payroll = await gustoGet(`/v1/payrolls/${rest.payroll_id}`)
        const url = payroll?.payroll_confirmation_url || `https://app.gusto.com/payrolls/${rest.payroll_id}`
        return new Response(JSON.stringify({ url }), { headers: cors })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors })
    }
  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
