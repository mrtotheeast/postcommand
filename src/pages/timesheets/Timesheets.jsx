import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { atLeast } from '../../config/roles'
import { scopeToOwnEmployee } from '../../lib/scoping'
import Icon from '../../components/ui/Icon'
import { exportTimesheetPDF } from '../../lib/pdfExport'
import { emailTimesheetApproved, emailTimesheetRejected, emailPTOApproved, emailPTODenied } from '../../lib/email'
import { exportToSheets } from '../../lib/googleSheets'
import { useToast } from '../../components/ui/Toast'

const STATUS_STYLES = {
  pending:  { bg:'rgba(232,148,58,0.15)',  color:'#e8943a', label:'Pending' },
  approved: { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  rejected: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Rejected' },
}

function fmt12(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtHours(h) {
  if (h == null) return '—'
  return `${Number(h).toFixed(2)}h`
}

function getCurrentPayPeriod() {
  const now = new Date()
  const day = now.getDay() // 0=Sun,1=Mon,...
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23,59,59,999)
  return { start: monday, end: sunday,
    label: `${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${sunday.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` }
}

export default function Timesheets() {
  const { profile } = useAuth()
  const isMobile = window.innerWidth < 640
  const [sheets, setSheets]       = useState([])
  const [employees, setEmployees] = useState([])
  const [sites, setSites]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmp, setFilterEmp]       = useState('all')
  const [filterSite, setFilterSite]     = useState('all')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [view, setView]                 = useState('list')
  const [closingPeriod, setClosingPeriod] = useState(false)
  const [noShowing, setNoShowing]         = useState(false)
  const [periodMsg, setPeriodMsg]         = useState(null)
  const payPeriod = getCurrentPayPeriod()

  const canReview = atLeast(profile?.role, 'sergeant')
  const canExport = atLeast(profile?.role, 'lieutenant')
  const isOfficer = profile?.role === 'officer'

  useEffect(() => { loadAll() }, [profile])

  const loadAll = withLoadTimeout(async function loadAll() {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [tsRes, empRes, siteRes] = await Promise.all([
        scopeToOwnEmployee(supabase.from('timesheet').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }).order('clock_in', { ascending: false }), profile),
        supabase.from('employee').select('id,first_name,last_name,position_title').eq('company_id', profile.company_id).or('invitation_status.eq.accepted,has_app_access.eq.true'),
        supabase.from('site').select('id,name').eq('company_id', profile.company_id),
      ])
      setSheets(tsRes.data || []); setEmployees(empRes.data || []); setSites(siteRes.data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  function empName(id) { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : '—' }
  function siteName(id) { const s = sites.find(s => s.id === id); return s ? s.name : '—' }

  const filtered = useMemo(() => sheets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchEmp    = filterEmp === 'all' || t.employee_id === filterEmp
    const matchSite   = filterSite === 'all' || t.site_id === filterSite
    const matchFrom   = !dateFrom || t.date >= dateFrom
    const matchTo     = !dateTo   || t.date <= dateTo
    return matchStatus && matchEmp && matchSite && matchFrom && matchTo
  }), [sheets, filterStatus, filterEmp, filterSite, dateFrom, dateTo])

  const stats = useMemo(() => ({
    total:      filtered.length,
    pending:    filtered.filter(t => t.status === 'pending').length,
    approved:   filtered.filter(t => t.status === 'approved').length,
    totalHours: filtered.filter(t => t.status === 'approved').reduce((sum, t) => sum + (Number(t.total_hours) || 0), 0),
  }), [filtered])

  const summary = useMemo(() => {
    const map = {}
    filtered.filter(t => t.status === 'approved').forEach(t => {
      if (!map[t.employee_id]) map[t.employee_id] = { employee_id: t.employee_id, hours: 0, shifts: 0 }
      map[t.employee_id].hours  += Number(t.total_hours) || 0
      map[t.employee_id].shifts += 1
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [filtered])

  function exportCSV() {
    const rows = [
      ['Date','Employee','Site','Clock In','Clock Out','Hours','Status','Notes'],
      ...filtered.map(t => [t.date, empName(t.employee_id), siteName(t.site_id), fmt12(t.clock_in), fmt12(t.clock_out), fmtHours(t.total_hours), t.status, t.notes || ''])
    ]
    downloadCSV(rows, `timesheets-${new Date().toISOString().split('T')[0]}.csv`)
  }

  function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
    URL.revokeObjectURL(url)
  }

  const periodSheets = sheets.filter(t => {
    const d = new Date(t.date)
    return d >= payPeriod.start && d <= payPeriod.end
  })
  const periodHours = periodSheets.filter(t=>t.status==='approved').reduce((a,t)=>a+(Number(t.total_hours)||0),0)
  const periodClosed = periodSheets.length > 0 && periodSheets.every(t => t.status === 'closed' || t.status === 'approved')

  async function closePeriod() {
    setClosingPeriod(true); setPeriodMsg(null)
    const ids = periodSheets.filter(t=>t.status==='approved').map(t=>t.id)
    if (ids.length === 0) { setClosingPeriod(false); setPeriodMsg({ ok:false, text:'No approved timesheets to close.' }); return }
    try {
      await Promise.all(ids.map(id => supabase.from('timesheet').update({ status:'closed' }).eq('id',id).eq('company_id',profile.company_id)))
      setPeriodMsg({ ok:true, text:`${ids.length} timesheets closed.` }); loadAll()
      setTimeout(()=>setPeriodMsg(null), 3000)
    } catch(e) {
      setPeriodMsg({ ok:false, text:'Failed to close period.' })
    } finally {
      setClosingPeriod(false)
    }
  }

  async function noShowAll() {
    setNoShowing(true); setPeriodMsg(null)
    const presentEmpIds = new Set(periodSheets.map(t=>t.employee_id))
    const absent = employees.filter(e => !presentEmpIds.has(e.id))
    if (absent.length === 0) { setNoShowing(false); setPeriodMsg({ ok:false, text:'All employees have timesheets this period.' }); return }
    const periodStart = payPeriod.start.toISOString().split('T')[0]
    try {
      await Promise.all(absent.map(e => supabase.from('timesheet').insert({
        company_id: profile.company_id, employee_id: e.id,
        date: periodStart, status: 'no_show', notes: 'Auto-marked no show for pay period close'
      })))
      setPeriodMsg({ ok:true, text:`${absent.length} employees marked no show.` }); loadAll()
      setTimeout(()=>setPeriodMsg(null), 3000)
    } catch(e) {
      setPeriodMsg({ ok:false, text:'Failed to mark no shows.' })
    } finally {
      setNoShowing(false)
    }
  }

  // selStyle moved to module scope below

  return (
    <div style={{padding:isMobile?'12px':'24px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>TIMESHEETS</h2>
          <p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>{filtered.length} records · {stats.totalHours.toFixed(2)} approved hours</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {[['list','List'],['summary','Summary'],['pto','PTO'],['taxforms','Tax Forms']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'0 12px',height:'32px',border:'none',borderRadius:'4px',background:view===v?'var(--accent-bg)':'transparent',color:view===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>
            ))}
          </div>
          {canExport&&<button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 14px',height:'40px',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}><Icon name="download" size={14}/>CSV</button>}
          {canExport&&<button onClick={()=>exportTimesheetPDF(filtered,employees,sites,'All timesheets')} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 14px',height:'40px',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}><Icon name="file-text" size={14}/>PDF</button>}
          {canExport&&<button onClick={()=>exportToSheets('Timesheets','timesheets',[['Date','Employee','Site','Clock In','Clock Out','Hours','Status'],...filtered.map(t=>[t.date,empName(t.employee_id),siteName(t.site_id),fmt12(t.clock_in),fmt12(t.clock_out),fmtHours(t.total_hours),t.status])]).catch(()=>{})} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 14px',height:'40px',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}} title="Export to Google Sheets"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>SHEETS</button>}
        </div>
      </div>

      {/* Pay Period Banner */}
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 18px',marginBottom:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'3px'}}>Current Pay Period (Weekly)</div>
          <div style={{fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.5px'}}>{payPeriod.label}</div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{periodSheets.length} shifts · {periodHours.toFixed(1)}h approved</div>
        </div>
        {periodMsg && <div style={{fontSize:'12px',padding:'6px 12px',borderRadius:'var(--radius-sm)',background:periodMsg.ok?'var(--color-success-bg)':'var(--color-danger-bg)',color:periodMsg.ok?'var(--color-success)':'var(--color-danger)',border:`1px solid ${periodMsg.ok?'rgba(58,170,106,0.3)':'rgba(192,57,43,0.3)'}`}}>{periodMsg.text}</div>}
        {canReview && (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button onClick={closePeriod} disabled={closingPeriod||periodSheets.filter(t=>t.status==='approved').length===0}
              style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 14px',height:'36px',opacity:periodSheets.filter(t=>t.status==='approved').length===0?0.5:1}}>
              <Icon name="check-circle" size={13}/>{closingPeriod?'CLOSING...':'CLOSE PERIOD'}
            </button>
            <button onClick={noShowAll} disabled={noShowing||!periodClosed}
              style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-sm)',color:'var(--color-warning)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 14px',height:'36px',opacity:!periodClosed?0.5:1}}>
              <Icon name="alert-circle" size={13}/>{noShowing?'MARKING...':'NO SHOW ALL'}
            </button>
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'10px',marginBottom:'20px'}}>
        {[{label:'Total',value:stats.total,color:'var(--text-primary)'},{label:'Pending',value:stats.pending,color:'var(--color-warning)'},{label:'Approved',value:stats.approved,color:'var(--color-success)'},{label:'Hours',value:stats.totalHours.toFixed(1),color:'var(--accent)'}].map(s=>(
          <div key={s.label} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 16px'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>{s.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'26px',letterSpacing:'1px',color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
          <option value="all">All Status</option>
          {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {!isOfficer&&<select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={selStyle}>
          <option value="all">All Employees</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>}
        <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={selStyle}>
          <option value="all">All Sites</option>
          {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={selStyle} title="From"/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={selStyle} title="To"/>
        {(filterStatus!=='all'||filterEmp!=='all'||filterSite!=='all'||dateFrom||dateTo)&&<button onClick={()=>{setFilterStatus('all');setFilterEmp('all');setFilterSite('all');setDateFrom('');setDateTo('')}} style={{height:'40px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',cursor:'pointer',padding:'0 12px',fontSize:'12px',fontFamily:'var(--font-condensed)'}}>CLEAR</button>}
      </div>

      {loading ? (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{[...Array(5)].map((_,i)=><div key={i} style={{height:'64px',borderRadius:'10px'}} className="skeleton"/>)}</div>
      ) : view==='taxforms' ? (
        <TaxFormsPanel companyId={profile.company_id} employees={employees} sheets={sheets} />
      ) : view==='pto' ? (
        <PTOPanel companyId={profile.company_id} profile={profile} employees={employees} canReview={canReview} />
      ) : view==='summary' ? (
        <SummaryView summary={summary} empName={empName}/>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 24px',color:'var(--text-muted)'}}><Icon name="clock" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px',fontSize:'15px'}}>No timesheets found</div></div>
      ) : (
        <div style={{overflowX:isMobile?'auto':'visible'}}>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden',minWidth:isMobile?'600px':'auto'}}>
          {filtered.map((t,i)=><TimesheetRow key={t.id} ts={t} isLast={i===filtered.length-1} empName={empName} siteName={siteName} onClick={()=>setSelected(t)}/>)}
        </div>
        </div>
      )}

      {selected&&<TimesheetDetail ts={selected} empName={empName} siteName={siteName} canReview={canReview} onClose={()=>setSelected(null)} onUpdated={()=>{setSelected(null);loadAll()}} profile={profile}/>}
    </div>
  )
}

const selStyle = { padding:'0 10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'12px', height:'40px', cursor:'pointer' }

function TimesheetRow({ts,isLast,empName,siteName,onClick}) {
  const ss=STATUS_STYLES[ts.status]||STATUS_STYLES.pending
  const [hover,setHover]=useState(false)
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'grid',gridTemplateColumns:'120px 1fr 1fr 80px 90px 36px',padding:'12px 16px',borderBottom:isLast?'none':'1px solid var(--border)',background:hover?'var(--bg-card-hover)':'transparent',border:'none',width:'100%',cursor:'pointer',textAlign:'left',alignItems:'center',gap:'12px'}}>
      <div>
        <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-primary)'}}>{fmtDate(ts.date)}</div>
      </div>
      <div>
        <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{empName(ts.employee_id)}</div>
        <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{siteName(ts.site_id)}</div>
        {ts.reviewed_by && <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'2px'}}>Edited by {empName(ts.reviewed_by)}{ts.reviewed_at ? ' · '+new Date(ts.reviewed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}</div>}
      </div>
      <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>
        <div>{fmt12(ts.clock_in)} → {fmt12(ts.clock_out)}</div>
        {(ts.clock_in_photo_url||ts.clock_out_photo_url)&&<div style={{fontSize:'10px',color:'var(--accent)',marginTop:'2px',display:'flex',alignItems:'center',gap:'4px'}}><Icon name="eye" size={11} color="var(--accent)"/>photos</div>}
      </div>
      <div style={{fontFamily:'var(--font-display)',fontSize:'16px',color:'var(--accent)',letterSpacing:'1px'}}>{fmtHours(ts.total_hours)}</div>
      <span style={{fontSize:'11px',fontWeight:700,padding:'3px 8px',borderRadius:'10px',background:ss.bg,color:ss.color,display:'inline-block',whiteSpace:'nowrap'}}>{ss.label}</span>
      <Icon name="chevron-right" size={14} color="var(--text-muted)"/>
    </button>
  )
}

function SummaryView({summary,empName}) {
  if(summary.length===0) return <div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}><Icon name="bar-chart" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px'}}>No approved timesheets in selected range</div></div>
  const maxHours=Math.max(...summary.map(s=>s.hours))
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'1fr 80px 80px 180px',gap:'12px',fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>
        <div>Employee</div><div>Shifts</div><div>Hours</div><div>Distribution</div>
      </div>
      {summary.map((s,i)=>(
        <div key={s.employee_id} style={{display:'grid',gridTemplateColumns:'1fr 80px 80px 180px',padding:'12px 16px',borderBottom:i===summary.length-1?'none':'1px solid var(--border)',gap:'12px',alignItems:'center'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{empName(s.employee_id)}</div>
          <div style={{fontSize:'13px',color:'var(--text-secondary)'}}>{s.shifts}</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',color:'var(--accent)',letterSpacing:'1px'}}>{s.hours.toFixed(1)}</div>
          <div style={{background:'var(--border)',borderRadius:'4px',height:'8px',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:'4px',background:'var(--accent)',width:`${(s.hours/maxHours)*100}%`,transition:'width 500ms ease'}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function TimesheetDetail({ts,empName,siteName,canReview,onClose,onUpdated,profile}) {
  const toast = useToast()
  const ss=STATUS_STYLES[ts.status]||STATUS_STYLES.pending
  const [rejReason,setRejReason]=useState('')
  const [showReject,setShowReject]=useState(false)
  const [saving,setSaving]=useState(false)
  const [photoView,setPhotoView]=useState(null)

  async function approve() {
    setSaving(true)
    try {
      const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
      const {error}=await supabase.from('timesheet').update({status:'approved',reviewed_by:empData?.id,reviewed_at:new Date().toISOString()}).eq('id',ts.id).eq('company_id',profile.company_id)
      if(error) throw error
      // Fire-and-forget PTO accrual
      ;(async () => {
        try {
          const hours = Number(ts.total_hours) || 0
          if (!hours) return
          const { data: banks } = await supabase.from('pto_bank_config').select('bank_type,accrual_rate_hours,accrual_per_hours_worked').eq('company_id', profile.company_id).eq('enabled', true)
          for (const bank of (banks || [])) {
            if (!bank.accrual_rate_hours || !bank.accrual_per_hours_worked) continue
            const earned = hours * (bank.accrual_rate_hours / bank.accrual_per_hours_worked)
            const { data: existing } = await supabase.from('pto_balance').select('balance_hours').eq('company_id', profile.company_id).eq('employee_id', ts.employee_id).eq('bank_type', bank.bank_type).maybeSingle()
            if (existing) {
              await supabase.from('pto_balance').update({ balance_hours: (existing.balance_hours || 0) + earned, last_accrual_at: new Date().toISOString() }).eq('company_id', profile.company_id).eq('employee_id', ts.employee_id).eq('bank_type', bank.bank_type)
            } else {
              await supabase.from('pto_balance').insert({ company_id: profile.company_id, employee_id: ts.employee_id, bank_type: bank.bank_type, balance_hours: earned, used_hours: 0, pending_hours: 0, last_accrual_at: new Date().toISOString() })
            }
          }
        } catch {}
      })()
      // Email the officer
      const {data:officer}=await supabase.from('employee').select('first_name,email').eq('id',ts.employee_id).single()
      if(officer?.email) emailTimesheetApproved({ to:officer.email, firstName:officer.first_name, date:ts.date, hours:fmtHours(ts.total_hours), siteName:siteName(ts.site_id) })
      toast('Timesheet approved')
      onUpdated()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    if(!rejReason.trim()) return
    setSaving(true)
    try {
      const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
      const {error}=await supabase.from('timesheet').update({status:'rejected',rejection_reason:rejReason,reviewed_by:empData?.id,reviewed_at:new Date().toISOString()}).eq('id',ts.id).eq('company_id',profile.company_id)
      if(error) throw error
      // Email the officer
      const {data:officer}=await supabase.from('employee').select('first_name,email').eq('id',ts.employee_id).single()
      if(officer?.email) emailTimesheetRejected({ to:officer.email, firstName:officer.first_name, date:ts.date, reason:rejReason })
      toast('Timesheet rejected', 'info')
      onUpdated()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  const dur=ts.clock_in&&ts.clock_out?(()=>{const ms=new Date(ts.clock_out)-new Date(ts.clock_in);const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);return `${h}h ${m}m`})():'—'

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(460px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:101,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>TIMESHEET</div>
            <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{fmtDate(ts.date)}</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
          <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
            <span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:ss.bg,color:ss.color}}>{ss.label.toUpperCase()}</span>
          </div>
          <DSec title="Assignment"><DR l="Employee" v={empName(ts.employee_id)}/><DR l="Site" v={siteName(ts.site_id)}/></DSec>
          <DSec title="Time">
            <DR l="Date" v={fmtDate(ts.date)}/>
            <DR l="Clock In" v={fmt12(ts.clock_in)}/>
            <DR l="Clock Out" v={fmt12(ts.clock_out)}/>
            <DR l="Duration" v={dur}/>
            <DR l="Total Hours" v={fmtHours(ts.total_hours)} bold/>
          </DSec>
          {(ts.clock_in_photo_url||ts.clock_out_photo_url)&&<DSec title="Verification Photos">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {ts.clock_in_photo_url&&<div><div style={{fontSize:'10px',color:'var(--text-muted)',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'1px'}}>Clock In</div><img src={ts.clock_in_photo_url} alt="" onClick={()=>setPhotoView('in')} style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:'var(--radius-md)',cursor:'pointer',border:'1px solid var(--border-subtle)'}}/></div>}
              {ts.clock_out_photo_url&&<div><div style={{fontSize:'10px',color:'var(--text-muted)',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'1px'}}>Clock Out</div><img src={ts.clock_out_photo_url} alt="" onClick={()=>setPhotoView('out')} style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:'var(--radius-md)',cursor:'pointer',border:'1px solid var(--border-subtle)'}}/></div>}
            </div>
          </DSec>}
          {(ts.clock_in_location?.lat||ts.clock_out_location?.lat)&&<DSec title="GPS Location">
            {ts.clock_in_location?.lat&&<DR l="Clock In" v={`${Number(ts.clock_in_location.lat).toFixed(5)}, ${Number(ts.clock_in_location.lng).toFixed(5)}`}/>}
            {ts.clock_out_location?.lat&&<DR l="Clock Out" v={`${Number(ts.clock_out_location.lat).toFixed(5)}, ${Number(ts.clock_out_location.lng).toFixed(5)}`}/>}
          </DSec>}
          {ts.notes&&<DSec title="Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{ts.notes}</p></DSec>}
          {ts.rejection_reason&&<DSec title="Rejection Reason"><p style={{fontSize:'13px',color:'var(--color-danger)',lineHeight:1.5,margin:0}}>{ts.rejection_reason}</p></DSec>}
          {ts.reviewed_at&&<DSec title="Reviewed">{ts.reviewed_by&&<DR l="By" v={empName(ts.reviewed_by)}/>}<DR l="At" v={new Date(ts.reviewed_at).toLocaleString()}/></DSec>}
          {showReject&&<DSec title="Rejection Reason">
            <textarea value={rejReason} onChange={e=>setRejReason(e.target.value)} rows={3} placeholder="Explain why this timesheet is being rejected..." style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',outline:'none'}}/>
            <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
              <button onClick={()=>setShowReject(false)} style={{flex:1,height:'40px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700}}>CANCEL</button>
              <button onClick={reject} disabled={saving||!rejReason.trim()} style={{flex:1,height:'40px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700}}>CONFIRM REJECT</button>
            </div>
          </DSec>}
        </div>
        {canReview&&ts.status==='pending'&&!showReject&&(
          <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0}}>
            <button onClick={()=>setShowReject(true)} style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="x" size={15}/>REJECT</button>
            <button onClick={approve} disabled={saving} style={{flex:2,height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="check" size={15}/>{saving?'SAVING...':'APPROVE'}</button>
          </div>
        )}
      </div>
      {photoView&&<div onClick={()=>setPhotoView(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <img src={photoView==='in'?ts.clock_in_photo_url:ts.clock_out_photo_url} alt="" style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:'var(--radius-md)'}}/>
        <button onClick={()=>setPhotoView(null)} style={{position:'absolute',top:'20px',right:'20px',background:'rgba(255,255,255,0.1)',border:'none',color:'white',cursor:'pointer',borderRadius:'50%',width:'44px',height:'44px',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={20}/></button>
      </div>}
    </>
  )
}

function DSec({title,children}) {
  return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>
}
function DR({l,v,bold}) {
  if(!v) return null
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px',gap:'12px'}}><span style={{color:'var(--text-muted)',flexShrink:0}}>{l}</span><span style={{color:bold?'var(--accent)':'var(--text-primary)',fontWeight:bold?700:500,textAlign:'right'}}>{v}</span></div>
}

// ── PTO Panel ──────────────────────────────────────────────────────────────────

const PTO_TYPES    = ['Vacation','Sick','Personal','Unpaid','Bereavement','Holiday']
const PTO_STATUSES = { pending:{bg:'var(--color-warning-bg)',color:'var(--color-warning)',label:'Pending'}, approved:{bg:'var(--color-success-bg)',color:'var(--color-success)',label:'Approved'}, denied:{bg:'var(--color-danger-bg)',color:'var(--color-danger)',label:'Denied'} }

function PTOPanel({ companyId, profile, employees, canReview }) {
  const toast = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [employee, setEmployee] = useState(null)
  const [filter, setFilter]     = useState('all')
  const [ptoView, setPtoView]   = useState('list') // list | calendar

  useEffect(() => { load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const [{ data: empData }, { data: ptoData }] = await Promise.all([
        supabase.from('employee').select('id').eq('user_id', profile.id).single(),
        supabase.from('pto_request').select('*').eq('company_id', companyId).order('created_at', { ascending:false }),
      ])
      setEmployee(empData)
      setRequests(ptoData || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function updateStatus(id, status) {
    try {
      const { data: myEmp } = await supabase.from('employee').select('id').eq('user_id', profile.id).single()
      const { error } = await supabase.from('pto_request').update({ status, reviewed_by:myEmp?.id, reviewed_at:new Date().toISOString() }).eq('id', id).eq('company_id', companyId)
      if (error) throw error
      // Email the requesting employee
      const req = requests.find(r=>r.id===id)
      if (req) {
        const { data: reqEmp } = await supabase.from('employee').select('first_name,email').eq('id', req.employee_id).single()
        const days = calcDays(req.start_date, req.end_date)
        if (reqEmp?.email) {
          if (status === 'approved') emailPTOApproved({ to:reqEmp.email, firstName:reqEmp.first_name, ptoType:req.pto_type, startDate:req.start_date, endDate:req.end_date, days })
          if (status === 'denied')   emailPTODenied({ to:reqEmp.email, firstName:reqEmp.first_name, ptoType:req.pto_type, startDate:req.start_date, endDate:req.end_date })
        }
      }
      load()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    }
  }

  const empMap   = Object.fromEntries(employees.map(e => [e.id, `${e.first_name} ${e.last_name}`]))
  const isOfficer = ['officer','corporal'].includes(profile?.role)
  const visible   = requests.filter(r => {
    if (isOfficer && employee && r.employee_id !== employee.id) return false
    if (filter !== 'all' && r.status !== filter) return false
    return true
  })

  const pill = (status) => ({ display:'inline-flex', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', ...(PTO_STATUSES[status] || PTO_STATUSES.pending) })
  const btnStyle = (variant='accent') => ({ display:'inline-flex', alignItems:'center', gap:'6px', background: variant==='accent'?'var(--accent)':variant==='success'?'var(--color-success-bg)':'var(--color-danger-bg)', color: variant==='accent'?'var(--text-inverse)':variant==='success'?'var(--color-success)':'var(--color-danger)', border: variant==='accent'?'none':variant==='success'?'1px solid rgba(58,170,106,0.3)':'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' })

  function calcDays(start, end) {
    if (!start || !end) return '—'
    const d = Math.round((new Date(end+'T12:00:00') - new Date(start+'T12:00:00')) / 86400000) + 1
    return `${d} day${d!==1?'s':''}`
  }

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',fontSize:'12px'}}>LOADING...</div>

  return (
    <div>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px' }}>
          {[['list','List'],['calendar','Calendar']].map(([v,l])=>(
            <button key={v} onClick={()=>setPtoView(v)} style={{ padding:'0 12px', height:'32px', border:'none', borderRadius:'4px', background:ptoView===v?'var(--accent-bg)':'transparent', color:ptoView===v?'var(--accent)':'var(--text-muted)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:600 }}>{l}</button>
          ))}
        </div>
        {ptoView === 'list' && (
          <select style={selStyle} value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All Status</option>
            {Object.entries(PTO_STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        <button style={{...btnStyle(),height:'40px',padding:'0 16px',fontSize:'12px'}} onClick={()=>setShowNew(true)}>+ REQUEST PTO</button>
      </div>

      {ptoView === 'calendar' && <PTOCalendar requests={requests.filter(r=>r.status==='approved')} empMap={Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))} />}

      {ptoView === 'list' && (
        <>
          {visible.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:'13px'}}>No PTO requests found.</div>
          ) : (
            <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
              {visible.map((r,i) => {
                const st = PTO_STATUSES[r.status] || PTO_STATUSES.pending
                return (
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',borderBottom:i<visible.length-1?'1px solid var(--border)':'none'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{empMap[r.employee_id]||'—'}</div>
                      <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>
                        {r.pto_type} · {r.start_date} → {r.end_date} · {calcDays(r.start_date,r.end_date)}
                        {r.notes ? ` · "${r.notes}"` : ''}
                      </div>
                    </div>
                    <span style={pill(r.status)}>{st.label}</span>
                    {canReview && r.status==='pending' && (
                      <div style={{display:'flex',gap:'6px'}}>
                        <button style={btnStyle('success')} onClick={()=>updateStatus(r.id,'approved')}><Icon name="check" size={11}/>APPROVE</button>
                        <button style={btnStyle('deny')}    onClick={()=>updateStatus(r.id,'denied')}><Icon name="x" size={11}/>DENY</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {showNew && <PTORequestModal companyId={companyId} employeeId={employee?.id} onClose={()=>setShowNew(false)} onSaved={()=>{setShowNew(false);load()}} />}
        </>
      )}
    </div>
  )
}

function PTORequestModal({ companyId, employeeId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ pto_type:'Vacation', start_date:'', end_date:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const inpStyle = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const foc = e => { e.target.style.borderColor='var(--border-focus)' }
  const blr = e => { e.target.style.borderColor='var(--border)' }

  async function save() {
    if (!form.start_date || !form.end_date || !employeeId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('pto_request').insert({ company_id:companyId, employee_id:employeeId, pto_type:form.pto_type, start_date:form.start_date, end_date:form.end_date, notes:form.notes||null, status:'pending' })
      if (error) throw error
      onSaved()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }
  const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }
  const modal  = { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'var(--shadow-modal)' }
  const btn    = { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' }
  const gho    = { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' }

  return (
    <div style={overlay} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={modal}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'1.5px',color:'var(--text-primary)'}}>REQUEST PTO</div>
          <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div style={{marginBottom:'12px'}}><div style={lbl}>Type</div>
          <select style={{...inpStyle,cursor:'pointer'}} value={form.pto_type} onChange={e=>setForm(p=>({...p,pto_type:e.target.value}))}>
            {PTO_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
          <div><div style={lbl}>Start Date *</div><input style={inpStyle} type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
          <div><div style={lbl}>End Date *</div><input style={inpStyle} type="date" value={form.end_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
        </div>
        <div style={{marginBottom:'20px'}}><div style={lbl}>Notes</div><input style={inpStyle} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="Optional reason..."/></div>
        <div style={{display:'flex',gap:'10px'}}>
          <button style={{...btn,opacity:(!form.start_date||!form.end_date||saving)?0.6:1}} onClick={save} disabled={!form.start_date||!form.end_date||saving}>{saving?'SUBMITTING...':'SUBMIT REQUEST'}</button>
          <button style={gho} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── PTO Calendar ──────────────────────────────────────────────────────────────

function PTOCalendar({ requests, empMap }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const year  = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const PTO_COLORS = ['#5b9fe0','#3aaa6a','#c8a84b','#a07ae0','#e8943a','#e05555','#28a0a0']

  // Map employee → color index
  const empIds = [...new Set(requests.map(r=>r.employee_id))]
  const empColor = Object.fromEntries(empIds.map((id,i)=>[id, PTO_COLORS[i % PTO_COLORS.length]]))

  function getRequestsForDay(day) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return requests.filter(r => r.start_date <= dateStr && r.end_date >= dateStr)
  }

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={()=>setBaseDate(new Date(year,month-1,1))} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px' }}>‹</button>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', color:'var(--text-primary)' }}>{MONTHS[month].toUpperCase()} {year}</div>
        <button onClick={()=>setBaseDate(new Date(year,month+1,1))} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px' }}>›</button>
      </div>
      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--bg-surface)' }}>
        {DAYS.map(d=><div key={d} style={{ padding:'8px 4px', textAlign:'center', fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1px' }}>{d}</div>)}
      </div>
      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px', background:'var(--border)' }}>
        {[...Array(firstDay)].map((_,i)=><div key={`pad-${i}`} style={{ background:'var(--bg-surface)', minHeight:'70px' }}/>)}
        {[...Array(daysInMonth)].map((_,i)=>{
          const day = i + 1
          const dayReqs = getRequestsForDay(day)
          const isToday = new Date().getDate()===day && new Date().getMonth()===month && new Date().getFullYear()===year
          return (
            <div key={day} style={{ background:'var(--bg-card)', minHeight:'70px', padding:'6px', position:'relative' }}>
              <div style={{ fontSize:'12px', color:isToday?'var(--accent)':'var(--text-secondary)', fontWeight:isToday?700:400, marginBottom:'4px', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', background:isToday?'var(--accent-bg)':'transparent', borderRadius:'50%' }}>{day}</div>
              {dayReqs.map(r=>(
                <div key={r.id} style={{ fontSize:'10px', fontFamily:'var(--font-condensed)', padding:'2px 5px', borderRadius:'3px', marginBottom:'2px', background:`${empColor[r.employee_id]}22`, color:empColor[r.employee_id], borderLeft:`2px solid ${empColor[r.employee_id]}`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={`${empMap[r.employee_id]||'?'} · ${r.pto_type}`}>
                  {(empMap[r.employee_id]||'?').split(' ')[0]}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      {empIds.length > 0 && (
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', padding:'12px 18px', borderTop:'1px solid var(--border)' }}>
          {empIds.map(id=>(
            <div key={id} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'var(--text-secondary)' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:empColor[id], flexShrink:0 }}/>
              {empMap[id]||id.slice(0,8)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ── Tax Forms Panel ───────────────────────────────────────────────────────────

function TaxFormsPanel({ companyId, employees, sheets }) {
  const [positions, setPositions] = useState({}) // empId → { pay_rate, pay_type }
  const [year, setYear] = useState(new Date().getFullYear())
  useEffect(() => {
    supabase.from('position').select('*').eq('company_id',companyId).then(({data})=>{
      const m={}; for(const p of (data||[])) m[p.id]=p; setPositions(m)
    })
  }, [companyId])

  const empMap = Object.fromEntries(employees.map(e=>[e.id,e]))
  const yearSheets = sheets.filter(ts=>{
    if (ts.status!=='approved') return false
    const d = new Date(ts.date||ts.clock_in)
    return d.getFullYear()===year
  })

  const empEarnings = employees.map(emp=>{
    const empTs = yearSheets.filter(ts=>ts.employee_id===emp.id)
    const totalHours = empTs.reduce((a,ts)=>a+(Number(ts.total_hours)||0),0)
    const payRate = 0 // Would come from position table — show N/A if not set
    const grossPay = payRate > 0 ? totalHours * payRate : null
    return { ...emp, totalHours:Math.round(totalHours*100)/100, grossPay, payRate }
  }).filter(e=>e.totalHours>0)

  function generatePDF(emp, formType) {
    const w = window.open('','_blank','width=700,height=900')
    const isW2 = formType==='W2'
    w.document.write(`<!DOCTYPE html><html><head><title>${formType} — ${emp.first_name} ${emp.last_name}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:32px}
h1{font-size:20px;font-weight:900;color:#0d1f35;margin-bottom:4px}
.form-box{border:2px solid #0d1f35;border-radius:4px;padding:20px;margin:16px 0}
.field{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:11px}
.field-label{color:#666}
.disclaimer{background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin-top:20px;font-size:10px;color:#856404;line-height:1.5}
@media print{body{padding:16px}}
</style></head><body>
<h1>PostCommand — ${formType} Reference Form</h1>
<div style="font-size:11px;color:#888;margin-bottom:4px">Tax Year ${year} — FOR REFERENCE ONLY</div>
<div class="form-box">
  <div style="font-size:13px;font-weight:bold;margin-bottom:12px">${isW2?'W-2 Wage and Tax Statement':'Form 1099 — Nonemployee Compensation'}</div>
  <div class="field"><span class="field-label">Employee Name</span><span>${emp.first_name} ${emp.last_name}</span></div>
  <div class="field"><span class="field-label">Employment Type</span><span>${emp.employment_type||'N/A'}</span></div>
  <div class="field"><span class="field-label">Employer</span><span>See payroll records</span></div>
  <div class="field"><span class="field-label">Tax Year</span><span>${year}</span></div>
  <div class="field"><span class="field-label">Hours Worked</span><span>${emp.totalHours}h</span></div>
  <div class="field"><span class="field-label">Gross Wages / Compensation</span><span>${emp.grossPay ? '$'+emp.grossPay.toLocaleString() : 'See payroll records'}</span></div>
  <div class="field"><span class="field-label">Federal Tax Withheld</span><span>See payroll records</span></div>
  <div class="field"><span class="field-label">State Tax Withheld</span><span>See payroll records</span></div>
</div>
<div class="disclaimer">
  <strong>⚠ FOR REFERENCE ONLY</strong><br/>
  This document is generated for administrative reference purposes only and is NOT a valid tax form for IRS filing. Consult a licensed payroll provider to generate official W-2 and 1099 forms with proper tax calculations, withholding amounts, and IRS-required formatting. PostCommand is not responsible for tax filing decisions made based on this document.
</div>
</body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px'}}>
        <select style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',cursor:'pointer',fontFamily:'var(--font-body)'}} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[2026,2025,2024,2023].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{empEarnings.length} employees with approved hours in {year}</div>
      </div>
      <div style={{background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-md)',padding:'12px 16px',marginBottom:'16px',fontSize:'12px',color:'var(--color-warning)',lineHeight:1.6}}>
        <strong>For reference only.</strong> These are administrative summaries based on approved timesheets. Consult a licensed payroll provider for official W-2 and 1099 filing.
      </div>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>
            {['Employee','Type','Hours','Actions'].map(h=><th key={h} style={{textAlign:'left',fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',padding:'8px 14px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {empEarnings.map((emp,i)=>(
              <tr key={emp.id} style={{borderBottom:i<empEarnings.length-1?'1px solid var(--border)':'none'}}>
                <td style={{padding:'12px 14px',fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{emp.first_name} {emp.last_name}</td>
                <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-secondary)'}}>{emp.employment_type==='1099'?'1099 (Contractor)':'W-2 (Employee)'}</td>
                <td style={{padding:'12px 14px',fontSize:'13px',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontWeight:700}}>{emp.totalHours}h</td>
                <td style={{padding:'12px 14px'}}>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid rgba(91,159,224,0.3)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'32px',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer'}} onClick={()=>generatePDF(emp,'W2')}>W-2</button>
                    {emp.employment_type==='1099'&&<button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--color-warning-bg)',color:'var(--color-warning)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'32px',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer'}} onClick={()=>generatePDF(emp,'1099')}>1099</button>}
                  </div>
                </td>
              </tr>
            ))}
            {empEarnings.length===0&&<tr><td colSpan={4} style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>No approved timesheets for {year}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
