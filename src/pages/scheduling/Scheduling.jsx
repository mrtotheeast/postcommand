import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Published' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Cancelled' },
}
function getWeekDates(base) {
  const d = new Date(base); d.setDate(d.getDate()-d.getDay())
  return Array.from({length:7},(_,i)=>{ const day=new Date(d); day.setDate(d.getDate()+i); return day })
}
function fmt12(ts) {
  if(!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})
}
function fmtDate(d) { return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }
function isSameDay(a,b) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }

export default function Scheduling() {
  const { profile } = useAuth()
  const [weekBase,setWeekBase] = useState(new Date())
  const [shifts,setShifts]     = useState([])
  const [employees,setEmployees] = useState([])
  const [sites,setSites]       = useState([])
  const [loading,setLoading]   = useState(true)
  const [showCreate,setShowCreate] = useState(false)
  const [selected,setSelected] = useState(null)
  const [filterSite,setFilterSite] = useState('all')
  const [filterStatus,setFilterStatus] = useState('all')
  const [view,setView]         = useState('week')
  const canCreate  = atLeast(profile?.role,'sergeant')
  const canApprove = atLeast(profile?.role,'lieutenant')
  const canPublish = atLeast(profile?.role,'lieutenant')
  const isOfficer  = ['officer','corporal'].includes(profile?.role)
  const weekDates  = useMemo(()=>getWeekDates(weekBase),[weekBase])

  useEffect(()=>{ loadAll() },[profile,weekBase])

  async function loadAll() {
    if(!profile?.company_id) return
    setLoading(true)
    const weekStart=new Date(weekDates[0]); weekStart.setHours(0,0,0,0)
    const weekEnd=new Date(weekDates[6]);   weekEnd.setHours(23,59,59,999)
    const [shiftsRes,empRes,siteRes] = await Promise.all([
      supabase.from('shift').select('*').eq('company_id',profile.company_id).gte('start_time',weekStart.toISOString()).lte('start_time',weekEnd.toISOString()).order('start_time'),
      supabase.from('employee').select('id,first_name,last_name,role,is_armed,position_title').eq('company_id',profile.company_id).eq('status','active'),
      supabase.from('site').select('id,name,city,state,timezone').eq('company_id',profile.company_id),
    ])
    let shiftData=shiftsRes.data||[]
    if(isOfficer){ const myEmp=(empRes.data||[]).find(e=>e.id===profile.employee_id); if(myEmp) shiftData=shiftData.filter(s=>s.employee_id===myEmp.id) }
    setShifts(shiftData); setEmployees(empRes.data||[]); setSites(siteRes.data||[]); setLoading(false)
  }

  const filtered = useMemo(()=>shifts.filter(s=>(filterSite==='all'||s.site_id===filterSite)&&(filterStatus==='all'||s.status===filterStatus)),[shifts,filterSite,filterStatus])
  function shiftsForDay(date) { return filtered.filter(s=>isSameDay(new Date(s.start_time),date)) }
  function empName(id) { const e=employees.find(e=>e.id===id); return e?`${e.first_name} ${e.last_name}`:'—' }
  function siteName(id) { const s=sites.find(s=>s.id===id); return s?s.name:'—' }
  function prevWeek() { const d=new Date(weekBase); d.setDate(d.getDate()-7); setWeekBase(d) }
  function nextWeek() { const d=new Date(weekBase); d.setDate(d.getDate()+7); setWeekBase(d) }
  const today=new Date()
  const weekLabel=`${fmtDate(weekDates[0])} — ${fmtDate(weekDates[6])}, ${weekDates[0].getFullYear()}`

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'22px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>SCHEDULING</h2>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <button onClick={prevWeek} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="chevron-left" size={16}/></button>
            <button onClick={()=>setWeekBase(new Date())} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',padding:'0 12px',minHeight:'44px',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>TODAY</button>
            <button onClick={nextWeek} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="chevron-right" size={16}/></button>
            <span style={{fontSize:'13px',color:'var(--text-secondary)',marginLeft:'4px'}}>{weekLabel}</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={{padding:'0 10px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'12px',minHeight:'44px',cursor:'pointer'}}>
            <option value="all">All Sites</option>
            {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:'0 10px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'12px',minHeight:'44px',cursor:'pointer'}}>
            <option value="all">All Status</option>
            {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {['week','list'].map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'0 10px',minHeight:'44px',border:'none',borderRadius:'4px',background:view===v?'var(--accent-bg)':'transparent',color:view===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>{v.toUpperCase()}</button>
            ))}
          </div>
          {canCreate&&<button onClick={()=>setShowCreate(true)} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 16px',minHeight:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={15}/>ADD SHIFT</button>}
        </div>
      </div>

      {loading ? (
        <div style={{padding:'24px',display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px'}}>{[...Array(7)].map((_,i)=><div key={i} style={{height:'200px',borderRadius:'8px'}} className="skeleton"/>)}</div>
      ) : view==='week' ? (
        <WeekView weekDates={weekDates} today={today} shiftsForDay={shiftsForDay} empName={empName} siteName={siteName} onSelect={setSelected}/>
      ) : (
        <ListView shifts={filtered} empName={empName} siteName={siteName} onSelect={setSelected}/>
      )}

      {selected&&<ShiftDetail shift={selected} empName={empName} siteName={siteName} canApprove={canApprove} canPublish={canPublish} canCreate={canCreate} onClose={()=>setSelected(null)}
        onStatusChange={async(id,status)=>{ await supabase.from('shift').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id); setSelected(null); loadAll() }}
        onDelete={async(id)=>{ await supabase.from('shift').delete().eq('id',id); setSelected(null); loadAll() }}/>}

      {showCreate&&<CreateShiftModal employees={employees} sites={sites} companyId={profile.company_id} createdBy={profile.id} onClose={()=>setShowCreate(false)} onSaved={()=>{setShowCreate(false);loadAll()}}/>}
    </div>
  )
}

function WeekView({weekDates,today,shiftsForDay,empName,siteName,onSelect}) {
  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'8px',minWidth:'700px'}}>
        {weekDates.map((date,i)=>{
          const isToday=isSameDay(date,today); const dayShifts=shiftsForDay(date)
          return (
            <div key={i} style={{background:'var(--bg-card)',border:`1px solid ${isToday?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',minHeight:'160px',overflow:'hidden'}}>
              <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',background:isToday?'var(--accent-bg)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:'10px',color:isToday?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{DAYS[date.getDay()]}</div>
                  <div style={{fontSize:'18px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)',lineHeight:1}}>{date.getDate()}</div>
                </div>
                {dayShifts.length>0&&<span style={{fontSize:'10px',background:'var(--border)',color:'var(--text-muted)',borderRadius:'10px',padding:'1px 6px'}}>{dayShifts.length}</span>}
              </div>
              <div style={{padding:'6px',display:'flex',flexDirection:'column',gap:'4px'}}>
                {dayShifts.map(shift=><ShiftChip key={shift.id} shift={shift} empName={empName} siteName={siteName} onClick={()=>onSelect(shift)}/>)}
                {dayShifts.length===0&&<div style={{padding:'12px 6px',textAlign:'center',fontSize:'11px',color:'var(--text-muted)'}}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ShiftChip({shift,empName,siteName,onClick}) {
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  const [hover,setHover]=useState(false)
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{background:hover?'var(--bg-card-hover)':ss.bg,border:`1px solid ${hover?ss.color:'transparent'}`,borderRadius:'6px',padding:'6px 8px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 120ms ease'}}>
      <div style={{fontSize:'11px',fontWeight:600,color:ss.color,marginBottom:'2px'}}>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</div>
      <div style={{fontSize:'11px',color:'var(--text-primary)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{empName(shift.employee_id)}</div>
      <div style={{fontSize:'10px',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{siteName(shift.site_id)}</div>
      {shift.is_armed&&<div style={{fontSize:'9px',color:'var(--accent)',marginTop:'2px'}}>● Armed</div>}
    </button>
  )
}

function ListView({shifts,empName,siteName,onSelect}) {
  if(shifts.length===0) return <div style={{padding:'60px 24px',textAlign:'center',color:'var(--text-muted)'}}><Icon name="calendar" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px',fontSize:'15px'}}>No shifts this week</div></div>
  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.5fr 1fr 100px',padding:'10px 16px',borderBottom:'1px solid var(--border)',fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>
          <span>Employee</span><span>Site</span><span>Time</span><span>Role</span><span>Status</span>
        </div>
        {shifts.map((shift,i)=>{
          const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
          const [hover,setHover]=useState(false)
          return (
            <button key={shift.id} onClick={()=>onSelect(shift)} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
              style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.5fr 1fr 100px',padding:'12px 16px',borderBottom:i===shifts.length-1?'none':'1px solid var(--border)',background:hover?'var(--bg-card-hover)':'transparent',border:'none',width:'100%',cursor:'pointer',textAlign:'left',alignItems:'center',gap:'8px'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{empName(shift.employee_id)}</div>
              <div style={{fontSize:'13px',color:'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{siteName(shift.site_id)}</div>
              <div><div style={{fontSize:'12px',color:'var(--text-primary)'}}>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</div><div style={{fontSize:'11px',color:'var(--text-muted)'}}>{new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div></div>
              <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>{ROLE_LABELS[shift.role]||shift.role||'—'}</div>
              <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:ss.bg,color:ss.color,display:'inline-block'}}>{ss.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ShiftDetail({shift,empName,siteName,canApprove,canPublish,canCreate,onClose,onStatusChange,onDelete}) {
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  const [confirming,setConfirming]=useState(false)
  function duration() {
    if(!shift.start_time||!shift.end_time) return '—'
    return `${((new Date(shift.end_time)-new Date(shift.start_time))/3600000).toFixed(1)}h`
  }
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(380px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:101,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>SHIFT DETAIL</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
            <span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:ss.bg,color:ss.color,letterSpacing:'0.5px'}}>{ss.label.toUpperCase()}</span>
            {shift.is_armed&&<span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>ARMED</span>}
          </div>
          <Sec title="Assignment"><R label="Employee" value={empName(shift.employee_id)}/><R label="Site" value={siteName(shift.site_id)}/><R label="Role" value={ROLE_LABELS[shift.role]||shift.role||'—'}/></Sec>
          <Sec title="Schedule">
            <R label="Date" value={new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}/>
            <R label="Start" value={fmt12(shift.start_time)}/><R label="End" value={fmt12(shift.end_time)}/><R label="Duration" value={duration()}/>
          </Sec>
          {shift.notes&&<Sec title="Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{shift.notes}</p></Sec>}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
          {shift.status==='draft'&&canApprove&&<button onClick={()=>onStatusChange(shift.id,'approved')} style={{height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="check" size={15}/>APPROVE SHIFT</button>}
          {shift.status==='approved'&&canPublish&&<button onClick={()=>onStatusChange(shift.id,'published')} style={{height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="eye" size={15}/>PUBLISH TO OFFICERS</button>}
          {canCreate&&shift.status!=='cancelled'&&(confirming?(
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setConfirming(false)} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>CANCEL</button>
              <button onClick={()=>onDelete(shift.id)} style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>CONFIRM DELETE</button>
            </div>
          ):(
            <button onClick={()=>setConfirming(true)} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="trash" size={15}/>DELETE SHIFT</button>
          ))}
        </div>
      </div>
    </>
  )
}

function CreateShiftModal({employees,sites,companyId,createdBy,onClose,onSaved}) {
  const today=new Date().toISOString().split('T')[0]
  const [form,setForm]=useState({employee_id:'',site_id:'',date:today,start_hour:'08',start_min:'00',end_hour:'16',end_min:'00',role:'officer',is_armed:false,notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  function set(k,v){setForm(f=>({...f,[k]:v}))}
  async function save() {
    if(!form.employee_id||!form.site_id||!form.date){setError('Employee, site, and date are required.');return}
    setSaving(true);setError(null)
    const start=new Date(`${form.date}T${form.start_hour}:${form.start_min}:00`)
    const end=new Date(`${form.date}T${form.end_hour}:${form.end_min}:00`)
    if(end<=start){setError('End time must be after start time.');setSaving(false);return}
    const {error}=await supabase.from('shift').insert({company_id:companyId,employee_id:form.employee_id,site_id:form.site_id,start_time:start.toISOString(),end_time:end.toISOString(),role:form.role,is_armed:form.is_armed,notes:form.notes||null,status:'draft',created_by:createdBy})
    if(error){setError(error.message);setSaving(false);return}
    onSaved()
  }
  const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))
  const mins=['00','15','30','45']
  const inp={width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',height:'44px'}
  const lbl={fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'block',marginBottom:'6px'}
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(480px,95vw)',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',zIndex:201,display:'flex',flexDirection:'column',maxHeight:'90vh',boxShadow:'var(--shadow-modal)'}}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>CREATE SHIFT</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'16px'}}>
          {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}
          <div><label style={lbl}>Employee *</label><select value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} style={inp}><option value="">Select employee...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {ROLE_LABELS[e.role]||e.role}</option>)}</select></div>
          <div><label style={lbl}>Site *</label><select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}><option value="">Select site...</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={inp}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div><label style={lbl}>Start Time</label><div style={{display:'flex',gap:'6px'}}><select value={form.start_hour} onChange={e=>set('start_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select><select value={form.start_min} onChange={e=>set('start_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select></div></div>
            <div><label style={lbl}>End Time</label><div style={{display:'flex',gap:'6px'}}><select value={form.end_hour} onChange={e=>set('end_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select><select value={form.end_min} onChange={e=>set('end_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select></div></div>
          </div>
          <div><label style={lbl}>Role for this shift</label><select value={form.role} onChange={e=>set('role',e.target.value)} style={inp}>{['officer','corporal','sergeant','lieutenant'].map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)'}}>
            <input type="checkbox" id="is_armed" checked={form.is_armed} onChange={e=>set('is_armed',e.target.checked)} style={{width:'18px',height:'18px',cursor:'pointer',accentColor:'var(--accent)'}}/>
            <label htmlFor="is_armed" style={{fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}><Icon name="shield" size={16} color="var(--accent)"/>Armed post</label>
          </div>
          <div><label style={lbl}>Notes (optional)</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} placeholder="Special instructions, post orders..." style={{...inp,height:'auto',resize:'vertical',padding:'10px 12px',lineHeight:1.5}}/></div>
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
          <button onClick={save} disabled={saving} style={{flex:2,height:'44px',background:saving?'var(--accent-dark)':'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:saving?'not-allowed':'pointer'}}>{saving?'SAVING...':'SAVE SHIFT'}</button>
        </div>
      </div>
    </>
  )
}

function Sec({title,children}) {
  return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>
}
function R({label,value}) {
  if(!value) return null
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{label}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'65%'}}>{value}</span></div>
}
