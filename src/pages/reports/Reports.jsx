import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'
import { exportReportPDF } from '../../lib/pdfExport'
import { exportToSheets } from '../../lib/googleSheets'

const PERIODS = [
  { id:'7d',  label:'Last 7 Days' },
  { id:'30d', label:'Last 30 Days' },
  { id:'90d', label:'Last 90 Days' },
  { id:'ytd', label:'Year to Date' },
]

const s = {
  page:     { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  toolbar:  { display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' },
  sel:      { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' },
  exportBtn:{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-card)', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer', transition:'all 150ms ease' },
  grid:     { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'12px', marginBottom:'20px' },
  kpiCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'18px 20px' },
  kpiVal:   { fontFamily:'var(--font-display)', fontSize:'32px', letterSpacing:'2px', lineHeight:1, marginBottom:'4px' },
  kpiLbl:   { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)' },
  kpiSub:   { fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' },
  row2:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' },
  row3:     { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom:'16px' },
  chartCard:{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px' },
  chartTitle:{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'16px' },
  barRow:   { display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' },
  barLabel: { fontSize:'12px', color:'var(--text-secondary)', minWidth:'130px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:0 },
  barTrack: { flex:1, height:'8px', borderRadius:'4px', background:'var(--border)', overflow:'hidden' },
  barFill:  { height:'100%', borderRadius:'4px', transition:'width 600ms ease' },
  barVal:   { fontSize:'12px', color:'var(--text-muted)', minWidth:'32px', textAlign:'right', flexShrink:0 },
  tableCard:{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'16px' },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'6px 10px', borderBottom:'1px solid var(--border)' },
  tr:       { borderBottom:'1px solid var(--border)' },
  td:       { padding:'10px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  tdNum:    { padding:'10px', fontSize:'13px', color:'var(--text-primary)', fontFamily:'var(--font-condensed)', fontWeight:600 },
}

function BarChart({ data, color = 'var(--accent)', max }) {
  const m = max || Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      {data.map((d,i) => (
        <div key={i} style={s.barRow}>
          <div style={s.barLabel} title={d.label}>{d.label}</div>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width:`${(d.value/m)*100}%`, background: d.color || color }} />
          </div>
          <div style={s.barVal}>{d.value}</div>
        </div>
      ))}
      {data.length === 0 && <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'12px 0' }}>No data for this period.</div>}
    </div>
  )
}

function MiniDonut({ pct, color, size = 60 }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition:'stroke-dasharray 600ms ease' }} />
    </svg>
  )
}

export default function Reports() {
  const { profile } = useAuth()
  const [period, setPeriod]       = useState('30d')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [mainSection, setMainSection] = useState('ops')

  useEffect(() => { if (profile?.company_id) load() }, [profile, period])

  function periodStart() {
    const now = new Date()
    if (period === '7d')  return new Date(now - 7  * 86400000).toISOString()
    if (period === '30d') return new Date(now - 30 * 86400000).toISOString()
    if (period === '90d') return new Date(now - 90 * 86400000).toISOString()
    return new Date(now.getFullYear(), 0, 1).toISOString()
  }

  async function load() {
    setLoading(true)
    const start = periodStart()
    const cid = profile.company_id

    const [{ data: incidents }, { data: timesheets }, { data: employees }, { data: patrols }, { data: sites }] = await Promise.all([
      supabase.from('incident_report').select('id,incident_type,status,created_at,site_id').eq('company_id', cid).gte('created_at', start),
      supabase.from('timesheet').select('id,employee_id,site_id,clock_in,clock_out,date,status').eq('company_id', cid).gte('date', start.slice(0,10)),
      supabase.from('employee').select('id,first_name,last_name,role,status').eq('company_id', cid),
      supabase.from('patrol_log').select('id,employee_id,site_id,started_at,ended_at,status').eq('company_id', cid).gte('started_at', start),
      supabase.from('site').select('id,name').eq('company_id', cid),
    ])

    setData({ incidents: incidents||[], timesheets: timesheets||[], employees: employees||[], patrols: patrols||[], sites: sites||[] })
    setLoading(false)
  }

  const computed = useMemo(() => {
    if (!data) return null
    const { incidents, timesheets, employees, patrols, sites } = data

    // Incidents by type
    const incByType = {}
    for (const i of incidents) { incByType[i.incident_type] = (incByType[i.incident_type]||0)+1 }
    const incTypeChart = Object.entries(incByType).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value}))

    // Incidents by site
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name]))
    const incBySite = {}
    for (const i of incidents) { const n=siteMap[i.site_id]||'Unknown'; incBySite[n]=(incBySite[n]||0)+1 }
    const incSiteChart = Object.entries(incBySite).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,value])=>({label,value}))

    // Timesheet hours by employee
    const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.first_name} ${e.last_name}`]))
    const empHours = {}
    for (const ts of timesheets) {
      if (!ts.clock_out) continue
      const h = (new Date(ts.clock_out) - new Date(ts.clock_in)) / 3600000
      if (h > 0 && h < 24) { const n = empMap[ts.employee_id]||'Unknown'; empHours[n]=(empHours[n]||0)+h }
    }
    const topHours = Object.entries(empHours).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value:Math.round(value*10)/10}))

    // Hours by site
    const siteHours = {}
    for (const ts of timesheets) {
      if (!ts.clock_out) continue
      const h = (new Date(ts.clock_out) - new Date(ts.clock_in)) / 3600000
      if (h > 0 && h < 24) { const n=siteMap[ts.site_id]||'Unknown'; siteHours[n]=(siteHours[n]||0)+h }
    }
    const siteHoursChart = Object.entries(siteHours).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,value])=>({label,value:Math.round(value*10)/10}))

    // KPIs
    const totalHours = Object.values(empHours).reduce((a,b)=>a+b, 0)
    const approvedTS = timesheets.filter(t => t.status === 'approved').length
    const pendingTS  = timesheets.filter(t => t.status === 'pending').length
    const totalPatrolHours = patrols.filter(p=>p.ended_at).reduce((a,p) => a+(new Date(p.ended_at)-new Date(p.started_at))/3600000, 0)
    const activeEmployees = employees.filter(e=>e.status==='active').length

    // Incident status breakdown
    const incStatuses = {}
    for (const i of incidents) { incStatuses[i.status]=(incStatuses[i.status]||0)+1 }

    return { incTypeChart, incSiteChart, topHours, siteHoursChart, totalHours, approvedTS, pendingTS, totalPatrolHours, activeEmployees, incStatuses, incidents, timesheets, patrols }
  }, [data])

  function exportCSV() {
    if (!computed) return
    const rows = [['Type','Value']]
    computed.incTypeChart.forEach(d => rows.push([d.label, d.value]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`postcommand-report-${period}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function printPDF() {
    if (!computed) return
    const { incTypeChart, incSiteChart, topHours, siteHoursChart, totalHours, approvedTS, pendingTS, totalPatrolHours, activeEmployees, incidents, patrols, timesheets } = computed
    const pl = PERIODS.find(p=>p.id===period)?.label || period
    const tableRows = (data, c1='Item', c2='Value') =>
      `<table><thead><tr><th>${c1}</th><th style="text-align:right">${c2}</th></tr></thead><tbody>${data.map(d=>`<tr><td>${d.label}</td><td style="text-align:right"><strong>${d.value}</strong></td></tr>`).join('')}</tbody></table>`
    const w = window.open('', '_blank', 'width=900,height=1100')
    w.document.write(`<!DOCTYPE html><html><head><title>PostCommand Report — ${pl}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:48px;background:#fff}
      h1{font-size:32px;font-weight:900;letter-spacing:4px;color:#0d1f35;margin-bottom:4px}
      h1 span{color:#a8841e}.period{font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:32px}
      .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:32px}
      .kpi{background:#f8f8f8;border-radius:8px;padding:14px;border-left:3px solid #c8a84b}
      .kpi-val{font-size:24px;font-weight:900;color:#0d1f35;font-family:Georgia,serif}
      .kpi-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
      .sections{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
      h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#888;padding:6px 8px;border-bottom:1px solid #eee}
      td{padding:7px 8px;border-bottom:1px solid #f5f5f5}
      tr:last-child td{border-bottom:none}
      .footer{font-size:11px;color:#aaa;margin-top:32px;border-top:1px solid #eee;padding-top:14px}
      @media print{body{padding:24px}}
    </style></head><body>
    <h1>POST<span>COMMAND</span></h1>
    <div class="period">Operational Report · ${pl}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-val">${incidents.length}</div><div class="kpi-lbl">Incidents</div></div>
      <div class="kpi"><div class="kpi-val">${Math.round(totalHours)}h</div><div class="kpi-lbl">Hours Worked</div></div>
      <div class="kpi"><div class="kpi-val">${Math.round(totalPatrolHours)}h</div><div class="kpi-lbl">Patrol Hours</div></div>
      <div class="kpi"><div class="kpi-val">${approvedTS}</div><div class="kpi-lbl">Approved Timesheets</div></div>
      <div class="kpi"><div class="kpi-val">${activeEmployees}</div><div class="kpi-lbl">Active Officers</div></div>
    </div>
    <div class="sections">
      <div><h3>Incidents by Type</h3>${tableRows(incTypeChart,'Type','Count')}</div>
      <div><h3>Incidents by Site</h3>${tableRows(incSiteChart,'Site','Count')}</div>
      <div><h3>Top Officers by Hours</h3>${tableRows(topHours,'Officer','Hours')}</div>
      <div><h3>Hours by Site</h3>${tableRows(siteHoursChart,'Site','Hours')}</div>
    </div>
    <div class="footer">Generated by PostCommand · ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </body></html>`)
    w.document.close(); w.print()
  }

  if (loading || !computed) return <div style={{ padding:'24px' }}>{[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:'100px', borderRadius:'10px', marginBottom:'12px' }} />)}</div>

  const { incTypeChart, incSiteChart, topHours, siteHoursChart, totalHours, approvedTS, pendingTS, totalPatrolHours, activeEmployees, incStatuses, incidents, timesheets, patrols } = computed
  const periodLabel = PERIODS.find(p=>p.id===period)?.label

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>REPORTS & ANALYTICS</h2>
      <p style={s.sub}>Operational summary for your organization.</p>

      <div style={s.toolbar}>
        <div style={{ display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px' }}>
          {[['ops','Operations'],['financial','Financial'],['performance','Performance']].map(([v,l]) => (
            <button key={v} onClick={() => setMainSection(v)} style={{ padding:'0 14px', height:'34px', border:'none', borderRadius:'4px', background:mainSection===v?'var(--accent-bg)':'transparent', color:mainSection===v?'var(--accent)':'var(--text-muted)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:mainSection===v?700:400, letterSpacing:'1px' }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <select style={s.sel} value={period} onChange={e => setPeriod(e.target.value)}>
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button style={s.exportBtn} onClick={exportCSV}><Icon name="download" size={14} />CSV</button>
        <button style={s.exportBtn} onClick={() => exportReportPDF(computed, periodLabel)}><Icon name="download" size={14} />PDF</button>
        <button style={s.exportBtn} onClick={printPDF}><Icon name="printer" size={14} />PRINT</button>
        <SheetsBtn rows={computed ? [
          ['Type','Count'],
          ...computed.incTypeChart.map(d=>[d.label,d.value]),
          ['---','---'],
          ['Officer','Hours'],
          ...computed.topHours.map(d=>[d.label,d.value]),
        ] : []} title={`Ops Report ${periodLabel}`} type="Operations" />
      </div>

      {mainSection === 'financial'   && <FinancialTab companyId={profile?.company_id} period={period} />}
      {mainSection === 'performance' && <PerformanceTab companyId={profile?.company_id} period={period} />}
      {mainSection === 'ops' && <>


      {/* KPI row */}
      <div style={s.grid}>
        {[
          { label:'Total Incidents',   value: incidents.length,          color:'var(--color-danger)',  sub: periodLabel },
          { label:'Hours Worked',      value: `${Math.round(totalHours)}h`, color:'var(--accent)',      sub: `${timesheets.filter(t=>t.clock_out).length} shifts` },
          { label:'Patrol Hours',      value: `${Math.round(totalPatrolHours)}h`, color:'var(--color-info)',  sub: `${patrols.length} patrols` },
          { label:'Pending Timesheets',value: pendingTS,                  color: pendingTS > 0 ? 'var(--color-warning)' : 'var(--color-success)', sub: `${approvedTS} approved` },
          { label:'Active Headcount',  value: activeEmployees,            color:'var(--color-success)', sub: 'employees' },
        ].map(k => (
          <div key={k.label} style={s.kpiCard}>
            <div style={{ ...s.kpiVal, color:k.color }}>{k.value}</div>
            <div style={s.kpiLbl}>{k.label}</div>
            <div style={s.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={s.row2}>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Incidents by Type</div>
          <BarChart data={incTypeChart} color="var(--color-danger)" />
        </div>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Incidents by Site</div>
          <BarChart data={incSiteChart} color="var(--color-warning)" />
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={s.row2}>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Top Officers by Hours</div>
          <BarChart data={topHours} color="var(--accent)" />
        </div>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Hours by Site</div>
          <BarChart data={siteHoursChart} color="var(--color-info)" />
        </div>
      </div>

      {/* Incident status breakdown */}
      {Object.keys(incStatuses).length > 0 && (
        <div style={{ ...s.chartCard, marginBottom:'16px' }}>
          <div style={s.chartTitle}>Incident Status Breakdown</div>
          <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
            {Object.entries(incStatuses).map(([status, count]) => {
              const pct = Math.round((count / incidents.length) * 100)
              const colors = { draft:'var(--text-muted)', submitted:'var(--color-info)', reviewed:'var(--color-warning)', approved:'var(--color-success)', void:'var(--color-danger)' }
              const color = colors[status] || 'var(--text-muted)'
              return (
                <div key={status} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
                  <div style={{ position:'relative', width:'60px', height:'60px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <MiniDonut pct={pct} color={color} />
                    <div style={{ position:'absolute', fontFamily:'var(--font-display)', fontSize:'14px', color:'var(--text-primary)', letterSpacing:'0.5px' }}>{count}</div>
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' }}>{status}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timesheet approval table */}
      <div style={s.tableCard}>
        <div style={s.chartTitle}>Timesheet Summary</div>
        <table style={s.table}>
          <thead>
            <tr>{['Period','Total Shifts','Hours','Approved','Pending'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr style={s.tr}>
              <td style={s.td}>{periodLabel}</td>
              <td style={s.tdNum}>{timesheets.length}</td>
              <td style={s.tdNum}>{Math.round(totalHours)}h</td>
              <td style={{ ...s.tdNum, color:'var(--color-success)' }}>{approvedTS}</td>
              <td style={{ ...s.tdNum, color: pendingTS > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>{pendingTS}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </>}
    </div>
  )
}

// ── Financial Tab ─────────────────────────────────────────────────────────────

function fmtMoney(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0) }

function FinancialTab({ companyId, period }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => { if (companyId) load() }, [companyId, period])

  async function load() {
    setLoading(true)
    const now = new Date()
    let start = new Date(now - 30*86400000)
    if (period==='30d') start = new Date(now - 30*86400000)
    else if (period==='90d') start = new Date(now - 90*86400000)
    else if (period==='ytd') start = new Date(now.getFullYear(),0,1)
    const { data } = await supabase.from('invoice').select('id,invoice_number,client_name,total,status,issue_date,due_date').eq('company_id', companyId).order('issue_date', { ascending:false })
    setInvoices(data || [])
    setLoading(false)
  }

  const now = new Date()
  const aging = { current:[], d30:[], d60:[], d90:[], over90:[] }
  for (const inv of invoices.filter(i=>i.status==='sent'||i.status==='overdue')) {
    if (!inv.due_date) { aging.current.push(inv); continue }
    const days = Math.floor((now - new Date(inv.due_date+'T12:00:00')) / 86400000)
    if (days <= 0) aging.current.push(inv)
    else if (days <= 30) aging.d30.push(inv)
    else if (days <= 60) aging.d60.push(inv)
    else if (days <= 90) aging.d90.push(inv)
    else aging.over90.push(inv)
  }

  // Monthly totals for the year
  const monthlyData = Array.from({length:12},(_,i)=>({ month:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], sent:0, paid:0 }))
  for (const inv of invoices) {
    if (!inv.issue_date) continue
    const m = new Date(inv.issue_date+'T12:00:00').getMonth()
    if (inv.status==='paid') monthlyData[m].paid += (inv.total||0)
    else if (inv.status==='sent'||inv.status==='overdue') monthlyData[m].sent += (inv.total||0)
  }

  const totalPaid       = invoices.filter(i=>i.status==='paid').reduce((a,b)=>a+(b.total||0),0)
  const totalOutstanding= [...aging.current,...aging.d30,...aging.d60,...aging.d90,...aging.over90].reduce((a,b)=>a+(b.total||0),0)
  const totalVoid       = invoices.filter(i=>i.status==='void').reduce((a,b)=>a+(b.total||0),0)
  const maxMonthly      = Math.max(...monthlyData.map(m=>m.paid+m.sent), 1)

  const s2 = {
    stats:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'20px' },
    stat:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'16px' },
    card:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'16px' },
    title:  { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' },
    ageBucket:{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'14px' },
  }

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',fontSize:'12px'}}>LOADING...</div>

  return (
    <div>
      <div style={s2.stats}>
        {[
          { label:'Total Paid',        value:fmtMoney(totalPaid),        color:'var(--color-success)' },
          { label:'Outstanding',       value:fmtMoney(totalOutstanding), color: totalOutstanding>0?'var(--color-warning)':'var(--text-secondary)' },
          { label:'Overdue (>30d)',    value:fmtMoney([...aging.d30,...aging.d60,...aging.d90,...aging.over90].reduce((a,b)=>a+(b.total||0),0)), color:'var(--color-danger)' },
          { label:'Total Invoiced',    value:fmtMoney(invoices.reduce((a,b)=>a+(b.total||0),0)), color:'var(--text-primary)' },
        ].map(c=>(
          <div key={c.label} style={s2.stat}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>{c.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:c.value.length>9?'18px':'24px',letterSpacing:'1px',color:c.color,lineHeight:1}}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      <div style={s2.card}>
        <div style={s2.title}>Monthly Revenue</div>
        <div style={{ display:'flex', gap:'4px', alignItems:'flex-end', height:'100px' }}>
          {monthlyData.map((m,i)=>{
            const total = m.paid + m.sent
            const h = total > 0 ? Math.round((total/maxMonthly)*90) : 2
            return (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ width:'100%', borderRadius:'3px 3px 0 0', background: m.paid>0?'var(--color-success)':'var(--color-warning)', height:`${h}px`, minHeight:'2px', transition:'height 400ms ease' }} title={`${m.month}: ${fmtMoney(total)}`}/>
                <div style={{ fontSize:'9px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase' }}>{m.month}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:'16px', marginTop:'10px', fontSize:'11px', color:'var(--text-muted)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><span style={{ width:'10px', height:'10px', borderRadius:'2px', background:'var(--color-success)', display:'inline-block' }}/> Paid</span>
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}><span style={{ width:'10px', height:'10px', borderRadius:'2px', background:'var(--color-warning)', display:'inline-block' }}/> Outstanding</span>
        </div>
      </div>

      {/* Aging report */}
      <div style={s2.card}>
        <div style={s2.title}>Invoice Aging — Outstanding</div>
        {[
          { label:'Current (not yet due)', items:aging.current, color:'var(--color-success)' },
          { label:'1 – 30 days overdue',   items:aging.d30,    color:'var(--color-warning)' },
          { label:'31 – 60 days overdue',  items:aging.d60,    color:'var(--color-danger)' },
          { label:'61 – 90 days overdue',  items:aging.d90,    color:'var(--color-danger)' },
          { label:'Over 90 days overdue',  items:aging.over90, color:'#e05555' },
        ].map((bucket,i)=>(
          <div key={i} style={{ ...s2.ageBucket, borderBottom: i<4?'1px solid var(--border)':'none' }}>
            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:bucket.color, flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:'13px', color:'var(--text-primary)' }}>{bucket.label}</div>
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>{bucket.items.length} invoice{bucket.items.length!==1?'s':''}</div>
            <div style={{ fontSize:'14px', fontFamily:'var(--font-condensed)', fontWeight:700, color:bucket.color, minWidth:'90px', textAlign:'right' }}>{fmtMoney(bucket.items.reduce((a,b)=>a+(b.total||0),0))}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Officer Performance Tab ───────────────────────────────────────────────────

function PerformanceTab({ companyId, period }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort]     = useState('hours')
  const [dir, setDir]       = useState(-1)

  useEffect(() => { if (companyId) load() }, [companyId, period])

  function periodStart() {
    const now = new Date()
    if (period==='7d')  return new Date(now-7*86400000).toISOString()
    if (period==='30d') return new Date(now-30*86400000).toISOString()
    if (period==='90d') return new Date(now-90*86400000).toISOString()
    return new Date(now.getFullYear(),0,1).toISOString()
  }

  async function load() {
    setLoading(true)
    const start = periodStart()
    const today = new Date().toISOString().slice(0,10)
    const [{ data: employees }, { data: timesheets }, { data: shifts }, { data: incidents },
           { data: patrols }, { data: checkpoints }, { data: violations }, { data: trainAssign }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', companyId).eq('status','active'),
      supabase.from('timesheet').select('id,employee_id,clock_in,clock_out,total_hours,status,date').eq('company_id', companyId).gte('date', start.slice(0,10)),
      supabase.from('shift').select('id,employee_id,start_time').eq('company_id', companyId).gte('start_time', start).not('status','eq','cancelled'),
      supabase.from('incident_report').select('id,employee_id').eq('company_id', companyId).gte('created_at', start),
      supabase.from('patrol_log').select('id,employee_id,started_at,ended_at,status').eq('company_id', companyId).gte('started_at', start),
      supabase.from('patrol_checkpoint').select('id,patrol_log_id').eq('company_id', companyId),
      supabase.from('clockin_violation').select('id,employee_id,overridden').eq('company_id', companyId).gte('created_at', start),
      supabase.from('training_assignment').select('id,employee_id,status').eq('company_id', companyId),
    ])

    const cpMap = {} // patrol_log_id → count
    for (const cp of (checkpoints||[])) { cpMap[cp.patrol_log_id] = (cpMap[cp.patrol_log_id]||0)+1 }

    const stats = (employees||[]).map(emp => {
      const empTs     = (timesheets||[]).filter(t=>t.employee_id===emp.id)
      const empShifts = (shifts||[]).filter(s=>s.employee_id===emp.id)
      const hours     = empTs.filter(t=>t.status==='approved').reduce((a,t)=>a+(Number(t.total_hours)||0),0)
      const empPatrols = (patrols||[]).filter(p=>p.employee_id===emp.id&&p.status==='completed'&&p.ended_at)
      const patrolHours = empPatrols.reduce((a,p)=>a+(new Date(p.ended_at)-new Date(p.started_at))/3600000,0)
      const cps       = empPatrols.reduce((a,p)=>a+(cpMap[p.id]||0),0)
      const empInc    = (incidents||[]).filter(i=>i.employee_id===emp.id).length
      const empViol   = (violations||[]).filter(v=>v.employee_id===emp.id)
      const empTrain  = (trainAssign||[]).filter(a=>a.employee_id===emp.id)
      const trainPct  = empTrain.length>0 ? Math.round((empTrain.filter(a=>a.status==='completed').length/empTrain.length)*100) : null

      // Punctuality: clock_in vs shift start_time (minutes late)
      let lateMinutes = 0, lateCount = 0
      for (const ts of empTs) {
        const sh = empShifts.find(s=>s.start_time?.slice(0,10)===ts.date)
        if (sh && ts.clock_in) {
          const diff = (new Date(ts.clock_in)-new Date(sh.start_time))/60000
          if (diff>5) { lateMinutes+=diff; lateCount++ }
        }
      }
      const avgLate = lateCount>0 ? Math.round(lateMinutes/lateCount) : 0

      return { ...emp, hours:Math.round(hours*10)/10, shifts:empTs.length, incidents:empInc, patrols:empPatrols.length, patrolHours:Math.round(patrolHours*10)/10, checkpoints:cps, violations:empViol.length, overrides:empViol.filter(v=>v.overridden).length, lateCount, avgLate, trainPct }
    })

    setData(stats); setLoading(false)
  }

  const sorted = data ? [...data].sort((a,b)=>(b[sort]-a[sort])*dir).slice(0,50) : []

  function TH({ col, label }) {
    return (
      <th style={{ textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}
        onClick={()=>{ if(sort===col) setDir(d=>-d); else { setSort(col); setDir(-1) } }}>
        {label}{sort===col?(dir===-1?' ↓':' ↑'):''}
      </th>
    )
  }

  function exportCSV() {
    if (!sorted.length) return
    const rows = [['Name','Role','Hours','Shifts','Incidents','Patrols','Patrol Hrs','Checkpoints','Violations','Overrides','Late Count','Avg Late (min)','Training %']]
    sorted.forEach(r=>rows.push([`${r.first_name} ${r.last_name}`,r.role,r.hours,r.shifts,r.incidents,r.patrols,r.patrolHours,r.checkpoints,r.violations,r.overrides,r.lateCount,r.avgLate,r.trainPct??'—']))
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`officer-performance-${period}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding:'20px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontSize:'12px' }}>LOADING...</div>

  const td  = { padding:'10px 12px', fontSize:'12px', color:'var(--text-secondary)', verticalAlign:'middle', borderBottom:'1px solid var(--border)' }
  const tdn = { padding:'10px 12px', fontSize:'12px', color:'var(--text-primary)', fontWeight:600, verticalAlign:'middle', borderBottom:'1px solid var(--border)' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{sorted.length} active officers · click columns to sort</div>
        <button style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer' }} onClick={exportCSV}>
          <Icon name="download" size={13}/>EXPORT CSV
        </button>
      </div>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'900px' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>Officer</th>
              <TH col="hours"       label="Hours" />
              <TH col="shifts"      label="Shifts" />
              <TH col="incidents"   label="Incidents" />
              <TH col="patrols"     label="Patrols" />
              <TH col="patrolHours" label="Patrol Hrs" />
              <TH col="checkpoints" label="Checkpoints" />
              <TH col="violations"  label="Violations" />
              <TH col="lateCount"   label="Late" />
              <TH col="trainPct"    label="Training %" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={tdn}>
                  {r.first_name} {r.last_name}
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:400, marginTop:'1px' }}>{r.position_title||r.role}</div>
                </td>
                <td style={{ ...td, color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700 }}>{r.hours}h</td>
                <td style={td}>{r.shifts}</td>
                <td style={td}>{r.incidents || '—'}</td>
                <td style={td}>{r.patrols || '—'}</td>
                <td style={td}>{r.patrolHours > 0 ? `${r.patrolHours}h` : '—'}</td>
                <td style={td}>{r.checkpoints || '—'}</td>
                <td style={{ ...td, color: r.violations>0 ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: r.violations>0 ? 600 : 400 }}>{r.violations || '—'}</td>
                <td style={{ ...td, color: r.lateCount>2 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                  {r.lateCount > 0 ? `${r.lateCount}× (avg ${r.avgLate}m)` : '—'}
                </td>
                <td style={td}>
                  {r.trainPct !== null ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ width:'50px', height:'5px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:'3px', background:r.trainPct===100?'var(--color-success)':r.trainPct>=50?'var(--accent)':'var(--color-warning)', width:`${r.trainPct}%` }}/>
                      </div>
                      <span style={{ fontSize:'11px' }}>{r.trainPct}%</span>
                    </div>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ── Google Sheets button ──────────────────────────────────────────────────────

function SheetsBtn({ rows, title, type }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState(null)

  async function go() {
    setLoading(true); setErr(null)
    try { await exportToSheets(title, type, rows) }
    catch(e) { setErr('Google Sheets not configured yet — add GOOGLE_SERVICE_ACCOUNT_JSON to edge function secrets.') }
    setLoading(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <button style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer', letterSpacing:'1px', opacity:loading?0.6:1 }} onClick={go} disabled={loading}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        {loading ? 'EXPORTING...' : 'SHEETS'}
      </button>
      {err && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'11px', color:'var(--color-warning)', maxWidth:'320px', zIndex:10, boxShadow:'var(--shadow-card)' }}>
          {err}
        </div>
      )}
    </div>
  )
}
