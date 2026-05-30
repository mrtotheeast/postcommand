import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

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

export default function Timesheets() {
  const { profile } = useAuth()
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

  const canReview = atLeast(profile?.role, 'sergeant')
  const canExport = atLeast(profile?.role, 'lieutenant')
  const isOfficer = ['officer', 'corporal'].includes(profile?.role)

  useEffect(() => { loadAll() }, [profile])

  async function loadAll() {
    if (!profile?.company_id) return
    setLoading(true)
    const [tsRes, empRes, siteRes] = await Promise.all([
      supabase.from('timesheet').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }).order('clock_in', { ascending: false }),
      supabase.from('employee').select('id,first_name,last_name,position_title').eq('company_id', profile.company_id),
      supabase.from('site').select('id,name').eq('company_id', profile.company_id),
    ])
    let data = tsRes.data || []
    if (isOfficer) {
      const myEmp = (empRes.data || []).find(e => e.id === profile.employee_id)
      if (myEmp) data = data.filter(t => t.employee_id === myEmp.id)
    }
    setSheets(data); setEmployees(empRes.data || []); setSites(siteRes.data || [])
    setLoading(false)
  }

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
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const selStyle = { padding:'0 10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'12px', height:'40px', cursor:'pointer' }

  return (
    <div style={{padding:'24px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>TIMESHEETS</h2>
          <p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>{filtered.length} records · {stats.totalHours.toFixed(2)} approved hours</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {[['list','List'],['summary','Summary']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'0 12px',height:'32px',border:'none',borderRadius:'4px',background:view===v?'var(--accent-bg)':'transparent',color:view===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>
            ))}
          </div>
          {canExport&&<button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 14px',height:'40px',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}><Icon name="download" size={14}/>EXPORT CSV</button>}
        </div>
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
      ) : view==='summary' ? (
        <SummaryView summary={summary} empName={empName}/>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 24px',color:'var(--text-muted)'}}><Icon name="clock" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px',fontSize:'15px'}}>No timesheets found</div></div>
      ) : (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
          {filtered.map((t,i)=><TimesheetRow key={t.id} ts={t} isLast={i===filtered.length-1} empName={empName} siteName={siteName} onClick={()=>setSelected(t)}/>)}
        </div>
      )}

      {selected&&<TimesheetDetail ts={selected} empName={empName} siteName={siteName} canReview={canReview} onClose={()=>setSelected(null)} onUpdated={()=>{setSelected(null);loadAll()}} profile={profile}/>}
    </div>
  )
}

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
  const ss=STATUS_STYLES[ts.status]||STATUS_STYLES.pending
  const [rejReason,setRejReason]=useState('')
  const [showReject,setShowReject]=useState(false)
  const [saving,setSaving]=useState(false)
  const [photoView,setPhotoView]=useState(null)

  async function approve() {
    setSaving(true)
    const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
    await supabase.from('timesheet').update({status:'approved',reviewed_by:empData?.id,reviewed_at:new Date().toISOString()}).eq('id',ts.id)
    setSaving(false);onUpdated()
  }

  async function reject() {
    if(!rejReason.trim()) return
    setSaving(true)
    const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
    await supabase.from('timesheet').update({status:'rejected',rejection_reason:rejReason,reviewed_by:empData?.id,reviewed_at:new Date().toISOString()}).eq('id',ts.id)
    setSaving(false);onUpdated()
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
          {ts.reviewed_at&&<DSec title="Reviewed"><DR l="At" v={new Date(ts.reviewed_at).toLocaleString()}/></DSec>}
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