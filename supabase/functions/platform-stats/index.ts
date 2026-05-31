// Platform Stats — Super Admin only
// Returns cross-company aggregate metrics using service role key
// Frontend calls this with the user's JWT; function verifies super_admin role

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    // Verify calling user is super_admin
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { authorization: authHeader } }
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await userClient.from('user_profile').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') throw new Error('Forbidden — super_admin only')

    // Now use service role for cross-company queries
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const now      = new Date()
    const month    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    const [
      { count: totalCompanies },
      { count: totalEmployees },
      { count: totalUsers },
      { count: activeEmployees },
      { count: totalSites },
      { count: totalIncidents },
      { count: thisMonthIncidents },
      { count: activeSubs },
      { data: recentCompanies },
    ] = await Promise.all([
      admin.from('user_profile').select('company_id', { count:'exact', head:true }).not('company_id','is',null),
      admin.from('employee').select('id', { count:'exact', head:true }),
      admin.from('user_profile').select('id', { count:'exact', head:true }),
      admin.from('employee').select('id', { count:'exact', head:true }).eq('status','active'),
      admin.from('site').select('id', { count:'exact', head:true }),
      admin.from('incident_report').select('id', { count:'exact', head:true }),
      admin.from('incident_report').select('id', { count:'exact', head:true }).gte('created_at', month),
      admin.from('company_subscription').select('id', { count:'exact', head:true }).eq('status','active'),
      admin.from('user_profile').select('company_id, company_slug, created_at').order('created_at', { ascending:false }).limit(10),
    ])

    // Unique companies
    const uniqueCompanies = new Set((recentCompanies||[]).map(p=>p.company_id)).size

    return new Response(JSON.stringify({
      companies:       totalCompanies || 0,
      employees:       totalEmployees || 0,
      activeEmployees: activeEmployees || 0,
      users:           totalUsers || 0,
      sites:           totalSites || 0,
      incidents:       totalIncidents || 0,
      thisMonthIncidents: thisMonthIncidents || 0,
      activeSubscriptions: activeSubs || 0,
      recentCompanies: (recentCompanies||[])
        .filter((v,i,a)=>a.findIndex(c=>c.company_id===v.company_id)===i)
        .slice(0,8)
        .map(c=>({ company_id:c.company_id, slug:c.company_slug, joined:c.created_at })),
    }), { headers: { ...cors, 'Content-Type':'application/json' } })

  } catch (e) {
    const status = e.message.includes('Forbidden') ? 403 : e.message.includes('Unauthorized') ? 401 : 500
    return new Response(JSON.stringify({ error: e.message }), { status, headers: { ...cors, 'Content-Type':'application/json' } })
  }
})
