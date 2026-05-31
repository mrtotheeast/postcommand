import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'

const s = {
  page:     { padding:'24px', maxWidth:'1000px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'28px' },
  kpiGrid:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'12px', marginBottom:'24px' },
  kpiCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'18px 20px' },
  kpiVal:   { fontFamily:'var(--font-display)', fontSize:'36px', letterSpacing:'2px', lineHeight:1, marginBottom:'4px' },
  kpiLbl:   { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)' },
  kpiSub:   { fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' },
  card:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px' },
  cardTitle:{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' },
  compRow:  { display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
  badge:    { display:'inline-flex', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' },
}

function fmtDate(iso) { if(!iso)return'—'; return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

export default function SuperAdmin() {
  const { profile } = useAuth()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [companyStats, setCompanyStats] = useState(null)

  useEffect(() => {
    if (profile?.company_id) {
      loadPlatformStats()
      loadCompanyStats()
    }
  }, [profile])

  async function loadPlatformStats() {
    setLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('platform-stats')
      if (fnErr) throw fnErr
      setStats(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function loadCompanyStats() {
    const cid = profile?.company_id
    if (!cid) return
    const today = new Date().toISOString().slice(0,10)
    const [{ count: officers }, { count: sites }, { count: openInc }, { count: pendingTS }, { data: sub }] = await Promise.all([
      supabase.from('employee').select('id',{count:'exact',head:true}).eq('company_id',cid).eq('status','active'),
      supabase.from('site').select('id',{count:'exact',head:true}).eq('company_id',cid).eq('is_active',true),
      supabase.from('incident_report').select('id',{count:'exact',head:true}).eq('company_id',cid).in('status',['submitted','reviewed']),
      supabase.from('timesheet').select('id',{count:'exact',head:true}).eq('company_id',cid).eq('status','pending'),
      supabase.from('company_subscription').select('*').eq('company_id',cid).single(),
    ])
    setCompanyStats({ officers, sites, openInc, pendingTS, sub:sub||null })
  }

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>PLATFORM ADMIN</h2>
      <p style={s.sub}>Cross-company oversight and platform health.</p>

      {/* Your company stats */}
      {companyStats && (
        <>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px' }}>
            {profile?.company_slug?.toUpperCase()} — Your Company
          </div>
          <div style={s.kpiGrid}>
            {[
              { label:'Active Officers',      value:companyStats.officers||0,  color:'var(--color-success)', sub:'employees' },
              { label:'Active Sites',         value:companyStats.sites||0,     color:'var(--accent)',        sub:'locations' },
              { label:'Open Incidents',       value:companyStats.openInc||0,   color:companyStats.openInc>0?'var(--color-danger)':'var(--text-secondary)', sub:'pending review' },
              { label:'Pending Timesheets',   value:companyStats.pendingTS||0, color:companyStats.pendingTS>0?'var(--color-warning)':'var(--text-secondary)', sub:'awaiting approval' },
            ].map(k => (
              <div key={k.label} style={s.kpiCard}>
                <div style={{ ...s.kpiVal, color:k.color }}>{k.value}</div>
                <div style={s.kpiLbl}>{k.label}</div>
                <div style={s.kpiSub}>{k.sub}</div>
              </div>
            ))}
          </div>

          {companyStats.sub && (
            <div style={{ ...s.card, marginBottom:'16px' }}>
              <div style={s.cardTitle}>Subscription</div>
              <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
                {[
                  { label:'Plan', value: companyStats.sub.plan_id?.toUpperCase() || 'STARTER' },
                  { label:'Status', value: companyStats.sub.status?.toUpperCase() || '—' },
                  { label:'Renews', value: companyStats.sub.current_period_end ? fmtDate(companyStats.sub.current_period_end) : '—' },
                  { label:'Stripe ID', value: companyStats.sub.stripe_customer_id?.slice(0,12)+'...' || '—' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'3px' }}>{item.label}</div>
                    <div style={{ fontSize:'13px', color:'var(--text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Platform-wide stats */}
      <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', marginTop:'8px' }}>
        Platform-Wide
      </div>

      {loading ? (
        <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontSize:'12px' }}>LOADING PLATFORM STATS...</div>
      ) : error ? (
        <div style={{ padding:'20px', background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-md)', color:'var(--color-danger)', fontSize:'13px' }}>
          Could not load platform stats: {error}
          <br/><span style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'6px', display:'block' }}>Deploy the platform-stats edge function and ensure service role key is set.</span>
        </div>
      ) : stats && (
        <>
          <div style={s.kpiGrid}>
            {[
              { label:'Total Companies',   value: stats.companies,          color:'var(--text-primary)' },
              { label:'Total Employees',   value: stats.employees,          color:'var(--color-info)' },
              { label:'Active Officers',   value: stats.activeEmployees,    color:'var(--color-success)' },
              { label:'Total Sites',       value: stats.sites,              color:'var(--accent)' },
              { label:'Total Incidents',   value: stats.incidents,          color:'var(--color-danger)' },
              { label:'This Month',        value: stats.thisMonthIncidents, color:'var(--color-warning)' },
              { label:'Active Plans',      value: stats.activeSubscriptions,color:'var(--color-success)' },
            ].map(k => (
              <div key={k.label} style={s.kpiCard}>
                <div style={{ ...s.kpiVal, fontSize:'28px', color:k.color }}>{k.value}</div>
                <div style={s.kpiLbl}>{k.label}</div>
              </div>
            ))}
          </div>

          {stats.recentCompanies?.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>Companies on Platform</div>
              {stats.recentCompanies.map((c,i) => (
                <div key={c.company_id} style={{ ...s.compRow, borderBottom:i<stats.recentCompanies.length-1?'1px solid var(--border)':'none' }}>
                  <div style={{ width:'34px', height:'34px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                    {c.slug?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{c.slug?.toUpperCase() || 'Unknown'}</div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>Joined {fmtDate(c.joined)}</div>
                  </div>
                  <span style={{ ...s.badge, background:'var(--color-success-bg)', color:'var(--color-success)' }}>ACTIVE</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
