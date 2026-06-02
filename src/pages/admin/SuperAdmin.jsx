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

      {/* CCW Monitor Panel */}
      <CCWMonitorPanel />
    </div>
  )
}

// ── CCW Monitor Panel ─────────────────────────────────────────────────────────

function CCWMonitorPanel() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [approving, setApproving] = useState(false)

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('ccw_monitor_log')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(12)
    setLogs(data || [])
    setLoading(false)
  }

  async function runCheck() {
    setRunning(true)
    try {
      await supabase.functions.invoke('ccw-monitor')
      await loadLogs()
    } catch (e) { console.error('CCW monitor error:', e) }
    setRunning(false)
  }

  async function approveUpdate(logId) {
    setApproving(true)
    await supabase.from('ccw_monitor_log').update({
      approved: true,
      resolved: true,
      needs_review: false,
      status: 'APPROVED',
      reviewed_at: new Date().toISOString(),
    }).eq('id', logId)
    await supabase.from('platform_notification').update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('type', 'ccw_update_required').eq('resolved', false)
    await loadLogs()
    setApproving(false)
  }

  const latest    = logs[0]
  const needsReview = latest?.needs_review && !latest?.approved
  const fmtDate   = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

  return (
    <div style={{ background:'var(--bg-card)', border:`2px solid ${needsReview?'var(--color-warning)':'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', padding:'20px', marginTop:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
            <Icon name="map" size={16} color="var(--accent)"/>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)' }}>CCW Reciprocity Monitor</div>
          </div>
          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
            Source: <a href="https://handgunlaw.us/states/USStatesThatHonorMyPermit.pdf" target="_blank" rel="noopener noreferrer" style={{ color:'var(--color-info)' }}>handgunlaw.us/states/USStatesThatHonorMyPermit.pdf</a>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => setShowLog(l=>!l)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer', letterSpacing:'1px' }}>
            <Icon name="list" size={13}/>{showLog?'HIDE':'VIEW'} LOG
          </button>
          <button onClick={runCheck} disabled={running} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', letterSpacing:'1px', opacity:running?0.6:1 }}>
            <Icon name="refresh-cw" size={13}/>{running?'CHECKING...':'RUN CHECK NOW'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>
      ) : latest ? (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'14px' }}>
            {[
              { label:'Last Check', value: fmtDate(latest.checked_at) },
              { label:'Source Last Modified', value: fmtDate(latest.source_last_modified) },
              { label:'Status', value: latest.status || '—', highlight: latest.needs_review && !latest.approved },
            ].map(item => (
              <div key={item.label} style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', padding:'10px 12px' }}>
                <div style={{ fontSize:'9px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'3px' }}>{item.label}</div>
                <div style={{ fontSize:'13px', fontWeight:600, color: item.highlight ? 'var(--color-warning)' : 'var(--text-primary)', fontFamily:'var(--font-condensed)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {needsReview && (
            <div style={{ background:'var(--color-warning-bg)', border:'1px solid rgba(232,148,58,0.4)', borderRadius:'var(--radius-sm)', padding:'14px 16px', marginBottom:'12px' }}>
              <div style={{ fontSize:'13px', fontWeight:600, color:'var(--color-warning)', marginBottom:'6px', display:'flex', alignItems:'center', gap:'6px' }}>
                <Icon name="alert-triangle" size={14}/>Source data has changed — review required
              </div>
              <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'10px' }}>
                Handgunlaw.us has updated their reciprocity data. Review the changes at <a href="https://handgunlaw.us/states/USStatesThatHonorMyPermit.pdf" target="_blank" rel="noopener noreferrer" style={{ color:'var(--color-info)' }}>handgunlaw.us</a> before approving. Only approve after verifying the data is accurate. Super Admin must update ccwData.js manually with verified changes.
              </div>
              <button onClick={() => approveUpdate(latest.id)} disabled={approving} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:approving?0.6:1 }}>
                <Icon name="check-circle" size={13}/>{approving?'APPROVING...':'MARK AS REVIEWED'}
              </button>
            </div>
          )}

          {showLog && logs.length > 0 && (
            <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 12px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)' }}>Check History (Last 12)</div>
              {logs.map((log, i) => (
                <div key={log.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'9px 12px', borderBottom:i<logs.length-1?'1px solid var(--border)':'none', fontSize:'12px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:log.needs_review&&!log.approved?'var(--color-warning)':log.approved?'var(--color-success)':'var(--color-success)', flexShrink:0 }}/>
                  <div style={{ flex:1, color:'var(--text-secondary)' }}>{fmtDate(log.checked_at)}</div>
                  <div style={{ fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:700, color:log.needs_review&&!log.approved?'var(--color-warning)':log.approved?'var(--color-success)':'var(--text-muted)' }}>{log.approved?'APPROVED':log.status||'—'}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No checks run yet. Click "RUN CHECK NOW" to initialize.</div>
      )}

      <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'12px', lineHeight:1.6 }}>
        Cron schedule: 1st of each month at 8am UTC via cron-job.org → https://xtylrvmzoxuyzcprqkql.supabase.co/functions/v1/ccw-monitor
      </div>
    </div>
  )
}
