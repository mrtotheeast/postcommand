import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
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
  const isMobile = window.innerWidth < 640
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

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
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
    } catch(e) {
    } finally {
      setLoading(false)
    }
  }, { setLoading })

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
    <div style={{...s.page, padding:isMobile?'12px':'24px'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>REPORTS & ANALYTICS</h2>
      <p style={s.sub}>Operational summary for your organization.</p>

      <div style={s.toolbar}>
        <div style={{ display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px', flexWrap:'wrap' }}>
          {[['ops','Operations'],['financial','Financial'],['performance','Performance'],['ai','AI Summary'],['automation','Automation'],['site','Site Reports'],['audit','Audit Report']].map(([v,l]) => (
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
      {mainSection === 'ai'          && <AIReportTab companyId={profile?.company_id} computed={computed} period={period} periodLabel={periodLabel} />}
      {mainSection === 'automation'  && <ReportAutomationTab companyId={profile?.company_id} />}
      {mainSection === 'site'        && <SiteReportsTab companyId={profile?.company_id} />}
      {mainSection === 'audit'       && <AuditReportTab companyId={profile?.company_id} />}
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
      <div style={{...s.row2, gridTemplateColumns:isMobile?'1fr':'1fr 1fr'}}>
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
      <div style={{...s.row2, gridTemplateColumns:isMobile?'1fr':'1fr 1fr'}}>
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
      <div style={{...s.tableCard, overflowX:isMobile?'auto':'visible'}}>
        <div style={s.chartTitle}>Timesheet Summary</div>
        <table style={{...s.table, minWidth:isMobile?'380px':'auto'}}>
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
    try {
      const now = new Date()
      let start = new Date(now - 30*86400000)
      if (period==='30d') start = new Date(now - 30*86400000)
      else if (period==='90d') start = new Date(now - 90*86400000)
      else if (period==='ytd') start = new Date(now.getFullYear(),0,1)
      const { data } = await supabase.from('invoice').select('id,invoice_number,client_name,total,status,issue_date,due_date').eq('company_id', companyId).order('issue_date', { ascending:false })
      setInvoices(data || [])
    } catch(e) {
    } finally {
      setLoading(false)
    }
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
    try {
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

      setData(stats)
    } catch(e) {
    } finally {
      setLoading(false)
    }
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

// ── AI Report Tab ─────────────────────────────────────────────────────────────

function AIReportTab({ companyId, computed, period, periodLabel }) {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function generate() {
    if (!computed) return
    setLoading(true); setError(null)
    try {
      const { incidents, timesheets, patrols, totalHours, activeEmployees, incTypeChart, topHours } = computed
      const prompt = `You are a security operations analyst. Generate an executive summary report for ${periodLabel} with this data:
- Total incidents: ${incidents.length}
- Top incident types: ${incTypeChart.slice(0,3).map(d=>d.label+' ('+d.value+')').join(', ')}
- Total hours worked: ${Math.round(totalHours)}h across ${timesheets.filter(t=>t.clock_out).length} shifts
- Total patrols: ${patrols.length}
- Active officers: ${activeEmployees}
- Top officers by hours: ${topHours.slice(0,3).map(d=>d.label+' ('+d.value+'h)').join(', ')}

Provide a structured executive report with sections:
1. Executive Summary (2-3 sentences)
2. Key Metrics highlights
3. Incident Analysis (trends and concerns)
4. Staffing & Operations
5. Recommendations (3 specific, actionable items)

Return as JSON: {"summary":"...","metrics":"...","incidents":"...","staffing":"...","recommendations":["...","...","..."]}`

      const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role:'user', content: prompt }], model:'claude-sonnet-4-6' }
      })
      if (fnErr) throw new Error(fnErr.message)
      const text = data?.content?.[0]?.text || data?.text || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Unexpected response format')
      setReport(JSON.parse(match[0]))
    } catch(e) {
      setError(`${e.message} — deploy the ai-assistant edge function to enable this.`)
    }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)' }}>AI EXECUTIVE SUMMARY</div>
          <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{periodLabel} · Powered by Claude</div>
        </div>
        <button onClick={generate} disabled={loading||!computed}
          style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:(loading||!computed)?0.6:1 }}>
          <Icon name="zap" size={15}/>{loading?'GENERATING...':'GENERATE AI REPORT'}
        </button>
      </div>
      {error && <div style={{ padding:'10px 14px', borderRadius:'var(--radius-sm)', marginBottom:'14px', fontSize:'12px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)' }}>{error}</div>}
      {!report && !loading && <div style={{ ...s.chartCard, color:'var(--text-muted)', fontSize:'13px', textAlign:'center', padding:'40px' }}>Click "Generate AI Report" to create an executive summary based on your {periodLabel} data.</div>}
      {report && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {[
            { title:'Executive Summary', content:report.summary },
            { title:'Key Metrics', content:report.metrics },
            { title:'Incident Analysis', content:report.incidents },
            { title:'Staffing & Operations', content:report.staffing },
          ].filter(s => s.content).map(section => (
            <div key={section.title} style={{ ...s.chartCard }}>
              <div style={s.chartTitle}>{section.title}</div>
              <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7 }}>{section.content}</div>
            </div>
          ))}
          {report.recommendations?.length > 0 && (
            <div style={{ ...s.chartCard }}>
              <div style={s.chartTitle}>Recommendations</div>
              <ol style={{ margin:0, paddingLeft:'20px', display:'flex', flexDirection:'column', gap:'8px' }}>
                {report.recommendations.map((r, i) => (
                  <li key={i} style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>{r}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Report Automation Tab ─────────────────────────────────────────────────────

function ReportAutomationTab({ companyId }) {
  const KEY = `pc-report-auto-${companyId}`
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState({ report_type:'Weekly Summary', recipients:'', schedule:'weekly_monday', format:'PDF', enabled:true })
  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}
  const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' }

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('report_automation').select('*').eq('company_id', companyId).order('created_at', {ascending:false})
      setAutomations(data||[])
    } catch(e) {
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!form.recipients.trim()) return
    setSaving(true)
    const { error } = await supabase.from('report_automation').insert({ company_id:companyId, ...form })
    setSaving(false)
    if (error) { alert(error.message); return }
    setShowAdd(false); setForm({ report_type:'Weekly Summary', recipients:'', schedule:'weekly_monday', format:'PDF', enabled:true }); load()
  }

  async function toggle(id, enabled) {
    await supabase.from('report_automation').update({ enabled }).eq('id', id).eq('company_id', companyId)
    load()
  }

  async function del(id) {
    if (!window.confirm('Delete this automation?')) return
    await supabase.from('report_automation').delete().eq('id', id).eq('company_id', companyId)
    load()
  }

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)' }}>REPORT AUTOMATION</div>
          <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>Schedule automatic report delivery</div>
        </div>
        <button onClick={()=>setShowAdd(true)} style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}>
          <Icon name="plus" size={13}/>ADD AUTOMATION
        </button>
      </div>

      {showAdd && (
        <div style={{ ...s.chartCard, marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>Report Type</div>
              <select style={{...inp,cursor:'pointer'}} value={form.report_type} onChange={e=>setForm(p=>({...p,report_type:e.target.value}))} onFocus={foc} onBlur={blr}>
                {['Weekly Summary','Monthly Summary','Incident Report','Payroll Summary'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>Schedule</div>
              <select style={{...inp,cursor:'pointer'}} value={form.schedule} onChange={e=>setForm(p=>({...p,schedule:e.target.value}))} onFocus={foc} onBlur={blr}>
                <option value="weekly_monday">Every Monday</option>
                <option value="weekly_friday">Every Friday</option>
                <option value="monthly_1">1st of Month</option>
                <option value="monthly_15">15th of Month</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>Recipients (emails, comma-separated)</div>
              <input style={inp} value={form.recipients} onChange={e=>setForm(p=>({...p,recipients:e.target.value}))} placeholder="admin@company.com, ops@company.com" onFocus={foc} onBlur={blr}/>
            </div>
            <div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>Format</div>
              <select style={{...inp,cursor:'pointer'}} value={form.format} onChange={e=>setForm(p=>({...p,format:e.target.value}))} onFocus={foc} onBlur={blr}>
                <option>PDF</option><option>CSV</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={save} disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:saving?0.6:1 }}><Icon name="save" size={13}/>{saving?'SAVING...':'SAVE'}</button>
            <button onClick={()=>setShowAdd(false)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', cursor:'pointer' }}>CANCEL</button>
          </div>
        </div>
      )}

      {automations.length === 0 ? (
        <div style={{ ...s.chartCard, textAlign:'center', color:'var(--text-muted)', fontSize:'13px', padding:'40px' }}>No automations configured. Add one above.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {automations.map(a => (
            <div key={a.id} style={{ ...s.chartCard, display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'2px' }}>{a.report_type}</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{a.schedule?.replace(/_/g,' ')} · {a.format} · {a.recipients}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:a.enabled?'var(--color-success-bg)':'var(--border)', color:a.enabled?'var(--color-success)':'var(--text-muted)', fontFamily:'var(--font-condensed)' }}>{a.enabled?'ACTIVE':'PAUSED'}</span>
                <button onClick={()=>toggle(a.id,!a.enabled)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', cursor:'pointer', padding:'0 10px', height:'30px', fontFamily:'var(--font-condensed)', fontSize:'11px' }}>{a.enabled?'PAUSE':'RESUME'}</button>
                <button onClick={()=>del(a.id)} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }}><Icon name="trash-2" size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Site Reports Tab ──────────────────────────────────────────────────────────

function SiteReportsTab({ companyId }) {
  const [sites, setSites]     = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [period, setPeriod]   = useState('7d')
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!companyId) return
    supabase.from('site').select('id,name').eq('company_id', companyId).then(({ data }) => setSites(data||[])).catch(() => {})
  }, [companyId])

  async function generate() {
    if (!selectedSite || !companyId) return
    setLoading(true)
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const since = new Date(Date.now() - days*86400000).toISOString()
      const [{ data:ts },{ data:inc },{ data:pat }] = await Promise.all([
        supabase.from('timesheet').select('id,employee_id,clock_in,clock_out').eq('company_id',companyId).eq('site_id',selectedSite).gte('clock_in',since),
        supabase.from('incident_report').select('id,incident_type,status,created_at').eq('company_id',companyId).eq('site_id',selectedSite).gte('created_at',since),
        supabase.from('patrol_log').select('id,status,started_at,ended_at').eq('company_id',companyId).eq('site_id',selectedSite).gte('started_at',since),
      ])
      const totalHours = (ts||[]).filter(t=>t.clock_out).reduce((a,t)=>a+(new Date(t.clock_out)-new Date(t.clock_in))/3600000,0)
      const completedPatrols = (pat||[]).filter(p=>p.status==='completed').length
      setReport({ timesheets:ts||[], incidents:inc||[], patrols:pat||[], totalHours, completedPatrols })
    } catch(e) {
    } finally {
      setLoading(false)
    }
  }

  const siteName = sites.find(s=>s.id===selectedSite)?.name || 'Site'

  return (
    <div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'4px' }}>WEEKLY SITE REPORTS</div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px' }}>Per-site activity summary</div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Site</div>
          <select style={s.sel} value={selectedSite} onChange={e=>setSelectedSite(e.target.value)}>
            <option value="">Select a site...</option>
            {sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Period</div>
          <select style={s.sel} value={period} onChange={e=>setPeriod(e.target.value)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
        <button onClick={generate} disabled={!selectedSite||loading}
          style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:(!selectedSite||loading)?0.6:1 }}>
          <Icon name="bar-chart-2" size={15}/>{loading?'LOADING...':'GENERATE REPORT'}
        </button>
      </div>

      {report && (
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'1px', color:'var(--accent)', marginBottom:'12px' }}>{siteName.toUpperCase()}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Officer Hours', value:`${Math.round(report.totalHours)}h`, color:'var(--accent)' },
              { label:'Shifts Worked', value:report.timesheets.length, color:'var(--text-primary)' },
              { label:'Incidents', value:report.incidents.length, color:report.incidents.length>0?'var(--color-danger)':'var(--text-secondary)' },
              { label:'Patrols Completed', value:report.completedPatrols, color:'var(--color-success)' },
            ].map(k=>(
              <div key={k.label} style={s.kpiCard}>
                <div style={s.kpiLbl}>{k.label}</div>
                <div style={{ ...s.kpiVal, fontSize:'26px', color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
          {report.incidents.length > 0 && (
            <div style={{ ...s.chartCard, marginBottom:'12px' }}>
              <div style={s.chartTitle}>Incidents at this site</div>
              {report.incidents.map((inc,i)=>(
                <div key={inc.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:i<report.incidents.length-1?'1px solid var(--border)':'none', fontSize:'12px' }}>
                  <span style={{ color:'var(--text-primary)', textTransform:'capitalize' }}>{inc.incident_type?.replace(/_/g,' ')}</span>
                  <span style={{ color:'var(--text-muted)' }}>{new Date(inc.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AI Audit Report Tab ───────────────────────────────────────────────────────

function AuditReportTab({ companyId }) {
  const [employees, setEmployees] = useState([])
  const [dateFrom, setDateFrom]   = useState(() => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,10) })
  const [dateTo, setDateTo]       = useState(() => new Date().toISOString().slice(0,10))
  const [filterEditor, setFilterEditor]   = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [changeTypes, setChangeTypes]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [report, setReport]       = useState(null)
  const [error, setError]         = useState(null)
  const [rawLogs, setRawLogs]     = useState([])

  const ALL_TYPES = ['field_update','status_change','pay_change','document_upload','training_assigned','invite_sent','note_added']

  useEffect(() => {
    if (!companyId) return
    supabase.from('employee').select('id,first_name,last_name').eq('company_id', companyId).eq('status','active').then(({data})=>setEmployees(data||[]))
  }, [companyId])

  async function generate() {
    setLoading(true); setError(null); setReport(null)
    try {
      let q = supabase.from('employee_change_log').select('*').eq('company_id', companyId)
        .gte('created_at', dateFrom+'T00:00:00').lte('created_at', dateTo+'T23:59:59')
        .order('created_at', {ascending:false}).limit(200)
      if (filterEditor) q = q.eq('changed_by_id', filterEditor)
      if (filterEmployee) q = q.eq('employee_id', filterEmployee)
      if (changeTypes.length) q = q.in('change_type', changeTypes)
      const { data: logs } = await q
      setRawLogs(logs||[])
      if (!logs?.length) { setError('No changes found for the selected filters.'); setLoading(false); return }

      const prompt = `You are an HR compliance auditor. Analyze this employee change log and generate a structured audit report.

Period: ${dateFrom} to ${dateTo}
Total changes: ${logs.length}
Change data: ${JSON.stringify(logs.slice(0,100))}

Generate a compliance audit report as JSON:
{
  "summary": "2-3 sentence executive overview",
  "byEditor": [{"name":"...","role":"...","count":N,"types":["..."]}],
  "topModified": [{"name":"...","changes":N,"mostCommon":"..."}],
  "payChanges": [{"employee":"...","from":"...","to":"...","by":"...","date":"..."}],
  "statusChanges": [{"employee":"...","from":"...","to":"...","by":"...","date":"...","reason":"..."}],
  "flags": ["Flag 1: ...", "Flag 2: ..."],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`

      const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role:'user', content: prompt }], model:'claude-sonnet-4-6' }
      })
      if (fnErr) throw new Error(fnErr.message)
      const text = data?.content?.[0]?.text || data?.text || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Could not parse AI response')
      setReport(JSON.parse(match[0]))
    } catch(e) {
      setError(`${e.message}. Make sure the ai-assistant edge function is deployed.`)
    }
    setLoading(false)
  }

  function exportPDF() {
    if (!report) return
    const w = window.open('', '_blank', 'width=900,height=1100')
    w.document.write(`<!DOCTYPE html><html><head><title>Audit Report ${dateFrom} to ${dateTo}</title>
    <style>body{font-family:sans-serif;padding:40px;color:#1a1a2e}h1{font-size:22px;letter-spacing:2px}h2{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:24px 0 8px}p{font-size:13px;line-height:1.7;color:#333}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:8px 10px;text-align:left;font-size:12px;border-bottom:1px solid #eee}th{color:#888;font-weight:600}li{font-size:13px;line-height:1.7;margin:3px 0}</style></head>
    <body><h1>EMPLOYEE AUDIT REPORT</h1><p style="color:#888;font-size:12px">${dateFrom} – ${dateTo} · Generated ${new Date().toLocaleString()}</p>
    <h2>Executive Summary</h2><p>${report.summary||''}</p>
    ${report.payChanges?.length?`<h2>Pay Rate Changes</h2><table><thead><tr><th>Employee</th><th>From</th><th>To</th><th>By</th><th>Date</th></tr></thead><tbody>${report.payChanges.map(r=>`<tr><td>${r.employee}</td><td>${r.from}</td><td>${r.to}</td><td>${r.by}</td><td>${r.date}</td></tr>`).join('')}</tbody></table>`:''}
    ${report.statusChanges?.length?`<h2>Status Changes</h2><table><thead><tr><th>Employee</th><th>From</th><th>To</th><th>By</th><th>Reason</th></tr></thead><tbody>${report.statusChanges.map(r=>`<tr><td>${r.employee}</td><td>${r.from}</td><td>${r.to}</td><td>${r.by}</td><td>${r.reason||'—'}</td></tr>`).join('')}</tbody></table>`:''}
    ${report.flags?.length?`<h2>Flags</h2><ul>${report.flags.map(f=>`<li>${f}</li>`).join('')}</ul>`:''}
    ${report.recommendations?.length?`<h2>Recommendations</h2><ul>${report.recommendations.map(r=>`<li>${r}</li>`).join('')}</ul>`:''}
    <p style="color:#aaa;font-size:11px;margin-top:40px">Generated by PostCommand AI Audit System</p></body></html>`)
    w.document.close(); setTimeout(()=>w.print(),400)
  }

  const selStyle = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' }

  return (
    <div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'4px' }}>AI AUDIT REPORT</div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px' }}>AI-powered compliance audit based on the employee change log</div>

      <div style={{ ...s.chartCard, marginBottom:'16px' }}>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'14px' }}>
          <div><div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>From</div><input type="date" style={selStyle} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
          <div><div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>To</div><input type="date" style={selStyle} value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
          <div><div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>Employee</div>
            <select style={selStyle} value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom:'14px' }}>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'6px' }}>Change Types (leave all unchecked = include all)</div>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
            {ALL_TYPES.map(t=>(
              <label key={t} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-secondary)',cursor:'pointer'}}>
                <input type="checkbox" checked={changeTypes.includes(t)} onChange={()=>setChangeTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])} style={{accentColor:'var(--accent)',width:'14px',height:'14px'}}/>
                {t.replace(/_/g,' ')}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={generate} disabled={loading} style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:loading?0.6:1 }}>
            <Icon name="zap" size={15}/>{loading?'GENERATING...':'GENERATE AUDIT REPORT'}
          </button>
          {report && <button onClick={exportPDF} style={{ ...s.exportBtn }}><Icon name="printer" size={14}/>PRINT PDF</button>}
        </div>
        {error && <div style={{ marginTop:'12px', fontSize:'12px', color:'var(--color-danger)', padding:'8px 12px', background:'var(--color-danger-bg)', borderRadius:'var(--radius-sm)', border:'1px solid rgba(192,57,43,0.3)' }}>{error}</div>}
      </div>

      {report && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={s.chartCard}>
            <div style={s.chartTitle}>Executive Summary</div>
            <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7 }}>{report.summary}</div>
            <div style={{ marginTop:'10px', fontSize:'12px', color:'var(--text-muted)' }}>{rawLogs.length} change events analyzed · {dateFrom} to {dateTo}</div>
          </div>

          {report.payChanges?.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Pay Rate Changes ({report.payChanges.length})</div>
              {report.payChanges.map((r,i)=>(
                <div key={i} style={{ display:'flex', gap:'12px', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'12px', flexWrap:'wrap' }}>
                  <span style={{ color:'var(--text-primary)', fontWeight:600, minWidth:'120px' }}>{r.employee}</span>
                  <span style={{ color:'var(--text-muted)' }}>{r.from} → <strong style={{color:'var(--accent)'}}>{r.to}</strong></span>
                  <span style={{ color:'var(--text-muted)', marginLeft:'auto' }}>by {r.by} · {r.date}</span>
                </div>
              ))}
            </div>
          )}

          {report.statusChanges?.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Status Changes ({report.statusChanges.length})</div>
              {report.statusChanges.map((r,i)=>(
                <div key={i} style={{ display:'flex', gap:'12px', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'12px', flexWrap:'wrap' }}>
                  <span style={{ color:'var(--text-primary)', fontWeight:600, minWidth:'120px' }}>{r.employee}</span>
                  <span style={{ color:'var(--text-muted)' }}>{r.from} → <strong style={{color:'var(--color-danger)'}}>{r.to}</strong></span>
                  {r.reason && <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>"{r.reason}"</span>}
                  <span style={{ color:'var(--text-muted)', marginLeft:'auto' }}>by {r.by}</span>
                </div>
              ))}
            </div>
          )}

          {report.flags?.length > 0 && (
            <div style={{ ...s.chartCard, border:'1px solid rgba(232,148,58,0.3)', background:'var(--color-warning-bg)' }}>
              <div style={{ ...s.chartTitle, color:'var(--color-warning)' }}>⚠ Compliance Flags ({report.flags.length})</div>
              {report.flags.map((f,i)=><div key={i} style={{ fontSize:'13px', color:'var(--color-warning)', padding:'4px 0', lineHeight:1.5 }}>{f}</div>)}
            </div>
          )}

          {report.recommendations?.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Recommendations</div>
              <ol style={{ margin:0, paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'6px' }}>
                {report.recommendations.map((r,i)=><li key={i} style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>{r}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
