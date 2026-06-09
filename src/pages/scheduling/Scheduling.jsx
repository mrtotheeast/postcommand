import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { emailSchedulePublished } from '../../lib/email'
import { useToast } from '../../components/ui/Toast'

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Published' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Cancelled' },
}
const selStyle={padding:'0 10px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'12px',minHeight:'36px',cursor:'pointer'}

function isSameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function fmt12(ts){ if(!ts) return '—'; return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) }
function fmtDate(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }
function getWeekDates(base,offset=0){ const d=new Date(base); d.setDate(d.getDate()-d.getDay()+(offset*7)); return Array.from({length:7},(_,i)=>{ const day=new Date(d); day.setDate(d.getDate()+i); return day }) }
function getMonthDates(base){ const year=base.getFullYear(),month=base.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),startPad=first.getDay(),endPad=6-last.getDay(),dates=[]; for(let i=startPad;i>0;i--){ const d=new Date(first); d.setDate(d.getDate()-i); dates.push({date:d,thisMonth:false}) } for(let i=1;i<=last.getDate();i++) dates.push({date:new Date(year,month,i),thisMonth:true}); for(let i=1;i<=endPad;i++){ const d=new Date(last); d.setDate(d.getDate()+i); dates.push({date:d,thisMonth:false}) } return dates }

export default function Scheduling() {
  const { profile } = useAuth()
  const toast = useToast()
  const [viewMode,setViewMode] = useState('week')
  const [baseDate,setBaseDate] = useState(new Date())
  const [shifts,setShifts]     = useState([])
  const [employees,setEmployees] = useState([])
  const [sites,setSites]       = useState([])
  const [loading,setLoading]   = useState(true)
  const [showCreate,setShowCreate]   = useState(null)
  const [showAutoAssign,setShowAutoAssign] = useState(false)
  const [selected,setSelected] = useState(null)
  const [filterSite,setFilterSite] = useState('all')
  const [filterStatus,setFilterStatus] = useState('all')
  const [filterEmp,setFilterEmp] = useState('all')
  const [sortEmp,setSortEmp]   = useState('last')
  const [filterTitle,setFilterTitle] = useState('all')
  const [mobileEmpIdx,setMobileEmpIdx] = useState(0)
  const [isMobile,setIsMobile] = useState(window.innerWidth<768)
  const [mainTab,setMainTab] = useState('schedule')
  const [creatorEmpId,setCreatorEmpId] = useState(null)
  const canBid = atLeast(profile?.role,'officer')
  const canCreate  = atLeast(profile?.role,'sergeant')
  const canApprove = atLeast(profile?.role,'lieutenant')
  const canPublish = atLeast(profile?.role,'lieutenant')
  const isOfficer  = ['officer','corporal'].includes(profile?.role)

  function getShiftsForEmployeeDay(empId, date) {
    return filteredShifts.filter(s => {
      if (s.employee_id !== empId) return false
      const sd = new Date(s.start_time)
      return sd.getFullYear()===date.getFullYear() && sd.getMonth()===date.getMonth() && sd.getDate()===date.getDate()
    })
  }
  function getEmployeeWeekHours(empId) {
    return filteredShifts.filter(s=>s.employee_id===empId).reduce((acc,s)=>{
      if(!s.start_time||!s.end_time) return acc
      return acc + (new Date(s.end_time)-new Date(s.start_time))/3600000
    },0).toFixed(1)
  }
  function getDayTotalHours(date) {
    return filteredShifts.filter(s=>{
      const sd=new Date(s.start_time)
      return sd.getFullYear()===date.getFullYear()&&sd.getMonth()===date.getMonth()&&sd.getDate()===date.getDate()
    }).reduce((acc,s)=>{
      if(!s.start_time||!s.end_time) return acc
      return acc+(new Date(s.end_time)-new Date(s.start_time))/3600000
    },0).toFixed(1)
  }
  function formatShiftTime(isoStr) {
    if(!isoStr) return ''
    return new Date(isoStr).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})
  }

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener('resize',h); return ()=>window.removeEventListener('resize',h) },[])

  const dateRange = useMemo(()=>{
    const y=baseDate.getFullYear(),m=baseDate.getMonth()
    if(viewMode==='year') return {start:new Date(y,0,1),end:new Date(y,11,31,23,59,59)}
    if(viewMode==='month') return {start:new Date(y,m,1),end:new Date(y,m+1,0,23,59,59)}
    if(viewMode==='biweek'){ const w1=getWeekDates(baseDate,0),w2=getWeekDates(baseDate,1),start=new Date(w1[0]),end=new Date(w2[6]); start.setHours(0,0,0,0); end.setHours(23,59,59,999); return {start,end} }
    const week=getWeekDates(baseDate),start=new Date(week[0]),end=new Date(week[6]); start.setHours(0,0,0,0); end.setHours(23,59,59,999); return {start,end}
  },[viewMode,baseDate])

  useEffect(()=>{ loadAll() },[profile,dateRange])

  async function loadAll(){
    if(!profile?.company_id) return
    setLoading(true)
    const [sR,eR,siR,ceR]=await Promise.all([
      supabase.from('shift').select('*').eq('company_id',profile.company_id).gte('start_time',dateRange.start.toISOString()).lte('start_time',dateRange.end.toISOString()).order('start_time'),
      supabase.from('employee').select('id,first_name,last_name,role,is_armed,position_title,status').eq('company_id',profile.company_id).eq('status','active').or('invitation_status.eq.accepted,has_app_access.eq.true'),
      supabase.from('site').select('id,name,city,state').eq('company_id',profile.company_id),
      supabase.from('employee').select('id').eq('company_id',profile.company_id).eq('user_id',profile.id).maybeSingle(),
    ])
    let sd=sR.data||[]
    if(isOfficer){ const me=(eR.data||[]).find(e=>e.id===profile.employee_id); if(me) sd=sd.filter(s=>s.employee_id===me.id) }
    setCreatorEmpId(ceR.data?.id||null)
    setShifts(sd); setEmployees(eR.data||[]); setSites(siR.data||[]); setLoading(false)
  }

  const sortedEmployees=useMemo(()=>[...employees].sort((a,b)=>((sortEmp==='first'?a.first_name:a.last_name)||'').localeCompare((sortEmp==='first'?b.first_name:b.last_name)||'')),[employees,sortEmp])
  const positionTitles=useMemo(()=>[...new Set(employees.map(e=>e.position_title).filter(Boolean))].sort(),[employees])
  const filteredShifts=useMemo(()=>shifts.filter(s=>{ const emp=employees.find(e=>e.id===s.employee_id); return (filterSite==='all'||s.site_id===filterSite)&&(filterStatus==='all'||s.status===filterStatus)&&(filterEmp==='all'||s.employee_id===filterEmp)&&(filterTitle==='all'||emp?.position_title===filterTitle) }),[shifts,filterSite,filterStatus,filterEmp,filterTitle,employees])

  function empName(id,mode='full'){ const e=employees.find(e=>e.id===id); if(!e) return '—'; if(mode==='first') return e.first_name; if(mode==='last') return e.last_name; return e.first_name+' '+e.last_name }
  function siteName(id){ const s=sites.find(s=>s.id===id); return s?s.name:'—' }
  function navigate(dir){ const d=new Date(baseDate); if(viewMode==='week') d.setDate(d.getDate()+(dir*7)); else if(viewMode==='biweek') d.setDate(d.getDate()+(dir*14)); else if(viewMode==='month') d.setMonth(d.getMonth()+dir); else d.setFullYear(d.getFullYear()+dir); setBaseDate(d) }

  const periodLabel=useMemo(()=>{
    if(viewMode==='year') return String(baseDate.getFullYear())
    if(viewMode==='month') return MONTHS[baseDate.getMonth()]+' '+baseDate.getFullYear()
    if(viewMode==='week'){ const w=getWeekDates(baseDate); return fmtDate(w[0])+' — '+fmtDate(w[6])+', '+w[0].getFullYear() }
    const w1=getWeekDates(baseDate,0),w2=getWeekDates(baseDate,1); return fmtDate(w1[0])+' — '+fmtDate(w2[6])+', '+w1[0].getFullYear()
  },[viewMode,baseDate])

  const today=new Date()
  const mobileEmp=isMobile?sortedEmployees[mobileEmpIdx]:null

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <style>{`.sc:hover{opacity:0.85}`}</style>
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1,margin:0}}>SCHEDULING</h2>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <button onClick={()=>navigate(-1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px'}}><Icon name="chevron-left" size={15}/></button>
              <button onClick={()=>setBaseDate(new Date())} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',padding:'0 10px',minHeight:'36px',fontSize:'11px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>TODAY</button>
              <button onClick={()=>navigate(1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px'}}><Icon name="chevron-right" size={15}/></button>
              <span style={{fontSize:'12px',color:'var(--text-secondary)',marginLeft:'6px',whiteSpace:'nowrap'}}>{periodLabel}</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
              {[['schedule','Schedule'],['swaps','Swaps'],['availability','Availability'],['bids','Shift Bids']].map(([v,l])=>(
                <button key={v} onClick={()=>setMainTab(v)} style={{padding:'0 10px',minHeight:'36px',border:'none',borderRadius:'4px',background:mainTab===v?'var(--accent-bg)':'transparent',color:mainTab===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'10px',fontFamily:'var(--font-condensed)',letterSpacing:'1px',fontWeight:mainTab===v?700:400}}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {mainTab==='schedule'&&(<div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
              {['week','biweek','month','year','grid'].map(v=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'0 10px',minHeight:'36px',border:'none',borderRadius:'4px',background:viewMode===v?'var(--accent-bg)':'transparent',color:viewMode===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'10px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>
                  {v==='biweek'?'2 WK':v==='grid'?'GRID':v.toUpperCase()}
                </button>
              ))}
            </div>)}
            {canCreate&&mainTab==='schedule'&&<button onClick={()=>setShowAutoAssign(true)} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',color:'var(--text-secondary)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'0 14px',minHeight:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:600,letterSpacing:'1px',cursor:'pointer'}}><Icon name="cpu" size={14}/>AUTO-ASSIGN</button>}
            {canCreate&&mainTab==='schedule'&&<button onClick={()=>setShowCreate({})} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',minHeight:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={14}/>ADD SHIFT</button>}
          </div>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
          <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={selStyle}><option value="all">All Sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          {!isMobile&&<>
            <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={selStyle}><option value="all">All Employees</option>{sortedEmployees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select>
            <select value={filterTitle} onChange={e=>setFilterTitle(e.target.value)} style={selStyle}><option value="all">All Positions</option>{positionTitles.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <select value={sortEmp} onChange={e=>setSortEmp(e.target.value)} style={selStyle}><option value="last">Sort: Last Name</option><option value="first">Sort: First Name</option></select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}><option value="all">All Status</option>{Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          </>}
          {isMobile&&viewMode!=='year'&&sortedEmployees.length>0&&(
            <div style={{display:'flex',alignItems:'center',gap:'6px',flex:1}}>
              <button onClick={()=>setMobileEmpIdx(i=>Math.max(0,i-1))} disabled={mobileEmpIdx===0} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px'}}><Icon name="chevron-left" size={14}/></button>
              <span style={{flex:1,textAlign:'center',fontSize:'13px',color:'var(--text-primary)',fontWeight:600}}>{sortedEmployees[mobileEmpIdx]?sortedEmployees[mobileEmpIdx].first_name+' '+sortedEmployees[mobileEmpIdx].last_name:'All'}</span>
              <button onClick={()=>setMobileEmpIdx(i=>Math.min(sortedEmployees.length-1,i+1))} disabled={mobileEmpIdx===sortedEmployees.length-1} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px'}}><Icon name="chevron-right" size={14}/></button>
            </div>
          )}
        </div>
      </div>

      {mainTab==='swaps' && <SwapsPanel companyId={profile.company_id} profile={profile} employees={employees} shifts={shifts} canApprove={canApprove}/>}
      {mainTab==='availability' && <AvailabilityPanel companyId={profile.company_id} profile={profile} employees={employees} canEdit={canCreate}/>}
      {mainTab==='bids' && <ShiftBidsPanel companyId={profile.company_id} profile={profile} employees={employees} sites={sites} canPost={canCreate}/>}

      {mainTab==='schedule' && loading ? (
        <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:viewMode==='year'?'repeat(auto-fill,minmax(200px,1fr))':'repeat(7,1fr)',gap:'8px'}}>
          {[...Array(viewMode==='year'?12:7)].map((_,i)=><div key={i} style={{height:'180px',borderRadius:'8px'}} className="skeleton"/>)}
        </div>
      ) : mainTab==='schedule' && viewMode==='year' ? (
        <YearView baseDate={baseDate} shifts={filteredShifts} today={today} onMonthClick={(m)=>{ const d=new Date(baseDate); d.setMonth(m); setBaseDate(d); setViewMode('month') }}/>
      ) : mainTab==='schedule' && viewMode==='month' ? (
        <MonthView baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmp?.id}/>
      ) : mainTab==='schedule' && viewMode==='grid' ? (
        <GridView
          weekDays={getWeekDates(baseDate)}
          sortedEmployees={sortedEmployees}
          getShiftsForEmployeeDay={getShiftsForEmployeeDay}
          getEmployeeWeekHours={getEmployeeWeekHours}
          getDayTotalHours={getDayTotalHours}
          formatShiftTime={formatShiftTime}
          siteName={siteName}
          onSelect={setSelected}
          canCreate={canCreate}
          onCellClick={(emp, date) => {
            setShowCreate({ prefillEmp: emp.id, prefillDate: date })
          }}
        />
      ) : mainTab==='schedule' ? (
        <MultiWeekView weeks={viewMode==='biweek'?2:1} baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmp?.id}/>
      ) : null}

      {selected&&<ShiftDetail shift={selected} empName={empName} siteName={siteName} canApprove={canApprove} canPublish={canPublish} canCreate={canCreate} onClose={()=>setSelected(null)}
        onStatusChange={async(id,status)=>{
          await supabase.from('shift').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id)
          if(status==='published') {
            toast('Schedule published')
            const shift=shifts.find(s=>s.id===id)
            if(shift) {
              const {data:emp}=await supabase.from('employee').select('first_name,email').eq('id',shift.employee_id).single()
              if(emp?.email) emailSchedulePublished({ to:emp.email, firstName:emp.first_name, shiftCount:1, period:new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) })
            }
          }
          setSelected(null); loadAll()
        }}
        onDelete={async(id)=>{ await supabase.from('shift').delete().eq('id',id); toast('Shift deleted', 'info'); setSelected(null); loadAll() }}/>}
      {showCreate&&<CreateShiftModal employees={sortedEmployees} sites={sites} companyId={profile.company_id} createdBy={creatorEmpId} prefillEmpId={showCreate?.prefillEmp} prefillDate={showCreate?.prefillDate} onClose={()=>setShowCreate(null)} onSaved={()=>{setShowCreate(null);loadAll()}}/>}
      {showAutoAssign&&<AutoAssignModal employees={sortedEmployees} sites={sites} shifts={shifts} companyId={profile.company_id} createdBy={creatorEmpId} onClose={()=>setShowAutoAssign(false)} onSaved={()=>{setShowAutoAssign(false);loadAll()}}/>}
    </div>
  )
}

function MultiWeekView({weeks,baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const allDates=useMemo(()=>{ const r=[]; for(let w=0;w<weeks;w++) getWeekDates(baseDate,w).forEach(d=>r.push(d)); return r },[baseDate,weeks])
  function sfd(date){ let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date)); if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId); return s }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'6px'}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'6px'}}>
        {allDates.map((date,i)=>{
          const isToday=isSameDay(date,today),ds=sfd(date)
          return (
            <div key={i} style={{background:'var(--bg-card)',border:'1px solid '+(isToday?'var(--accent-border)':'var(--border-subtle)'),borderRadius:'var(--radius-md)',minHeight:isMobile?'80px':'140px',overflow:'hidden'}}>
              <div style={{padding:'6px 8px',borderBottom:'1px solid var(--border)',background:isToday?'var(--accent-bg)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  {!isMobile&&<div style={{fontSize:'9px',color:isToday?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{DAYS_SHORT[date.getDay()]}</div>}
                  <div style={{fontSize:isMobile?'13px':'16px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)',lineHeight:1}}>{date.getDate()}</div>
                </div>
                {ds.length>0&&<span style={{fontSize:'9px',background:'var(--border)',color:'var(--text-muted)',borderRadius:'10px',padding:'1px 5px'}}>{ds.length}</span>}
              </div>
              <div style={{padding:'4px',display:'flex',flexDirection:'column',gap:'3px'}}>
                {ds.slice(0,isMobile?2:999).map(s=><SC key={s.id} shift={s} empName={empName} siteName={siteName} onClick={()=>onSelect(s)} compact={isMobile}/>)}
                {isMobile&&ds.length>2&&<div style={{fontSize:'10px',color:'var(--text-muted)',textAlign:'center'}}>+{ds.length-2}</div>}
                {ds.length===0&&!isMobile&&<div style={{padding:'8px 4px',textAlign:'center',fontSize:'10px',color:'var(--text-muted)'}}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const dates=useMemo(()=>getMonthDates(baseDate),[baseDate])
  function sfd(date){ let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date)); if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId); return s }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px',marginBottom:'6px'}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
        {dates.map(({date,thisMonth},i)=>{
          const isToday=isSameDay(date,today),ds=sfd(date),lim=isMobile?1:3
          return (
            <div key={i} style={{background:thisMonth?'var(--bg-card)':'rgba(0,0,0,0.15)',border:'1px solid '+(isToday?'var(--accent-border)':'var(--border-subtle)'),borderRadius:'var(--radius-sm)',minHeight:isMobile?'60px':'100px',overflow:'hidden',opacity:thisMonth?1:0.5}}>
              <div style={{padding:'4px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',background:isToday?'var(--accent-bg)':'transparent'}}>
                <span style={{fontSize:isMobile?'11px':'13px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)'}}>{date.getDate()}</span>
                {ds.length>0&&<span style={{fontSize:'9px',background:isToday?'var(--accent)':'var(--border)',color:isToday?'var(--text-inverse)':'var(--text-muted)',borderRadius:'10px',padding:'0 4px'}}>{ds.length}</span>}
              </div>
              <div style={{padding:'2px 4px',display:'flex',flexDirection:'column',gap:'2px'}}>
                {ds.slice(0,lim).map(s=><SC key={s.id} shift={s} empName={empName} siteName={siteName} onClick={()=>onSelect(s)} compact={true}/>)}
                {ds.length>lim&&<div style={{fontSize:'9px',color:'var(--text-muted)',paddingLeft:'4px'}}>+{ds.length-lim} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function YearView({baseDate,shifts,today,onMonthClick}){
  const year=baseDate.getFullYear()
  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
        {MONTHS.map((name,m)=>{
          const dates=getMonthDates(new Date(year,m,1))
          const count=shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===m }).length
          const isCur=today.getFullYear()===year&&today.getMonth()===m
          return (
            <button key={m} onClick={()=>onMonthClick(m)} style={{background:'var(--bg-card)',border:'1px solid '+(isCur?'var(--accent-border)':'var(--border-subtle)'),borderRadius:'var(--radius-md)',padding:'12px',textAlign:'left',cursor:'pointer',width:'100%'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-border)';e.currentTarget.style.background='var(--bg-card-hover)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=isCur?'var(--accent-border)':'var(--border-subtle)';e.currentTarget.style.background='var(--bg-card)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,color:isCur?'var(--accent)':'var(--text-primary)'}}>{name}</span>
                {count>0&&<span style={{fontSize:'10px',background:'var(--accent-bg)',color:'var(--accent)',borderRadius:'10px',padding:'1px 6px',fontWeight:600}}>{count}</span>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px'}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'8px',color:'var(--text-muted)'}}>{d[0]}</div>)}
                {dates.map(({date,thisMonth},i)=>{
                  const isT=isSameDay(date,today)
                  const cnt=thisMonth?shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===m&&d.getDate()===date.getDate() }).length:0
                  return <div key={i} style={{textAlign:'center',fontSize:'9px',padding:'2px 1px',borderRadius:'3px',background:isT?'var(--accent)':cnt>0?'var(--accent-bg)':'transparent',color:isT?'var(--text-inverse)':cnt>0?'var(--accent)':thisMonth?'var(--text-secondary)':'var(--text-muted)',fontWeight:cnt>0?700:400,opacity:thisMonth?1:0.4}}>{date.getDate()}</div>
                })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SC({shift,empName,onClick,compact}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  return <button onClick={e=>{e.stopPropagation();onClick()}} className="sc" style={{background:ss.bg,border:'1px solid transparent',borderRadius:'4px',padding:compact?'3px 5px':'5px 7px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 120ms ease'}}><div style={{fontSize:compact?'9px':'10px',color:'var(--text-primary)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{empName(shift.employee_id,'last')}</div>{!compact&&<div style={{fontSize:'9px',color:ss.color}}>{fmt12(shift.start_time)}</div>}</button>
}

function ShiftDetail({shift,empName,siteName,canApprove,canPublish,canCreate,onClose,onStatusChange,onDelete}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  const [conf,setConf]=useState(false)
  const dur=shift.start_time&&shift.end_time?((new Date(shift.end_time)-new Date(shift.start_time))/3600000).toFixed(1)+'h':'—'
  return <>
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,backdropFilter:'blur(2px)'}}/>
    <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(380px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:101,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'18px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>SHIFT DETAIL</div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px'}}>
          <span style={{fontSize:'11px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:ss.bg,color:ss.color}}>{ss.label.toUpperCase()}</span>
          {shift.is_armed&&<span style={{fontSize:'11px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>ARMED</span>}
        </div>
        <SD title="Assignment"><SR l="Employee" v={empName(shift.employee_id)}/><SR l="Site" v={siteName(shift.site_id)}/><SR l="Role" v={ROLE_LABELS[shift.role]||shift.role||'—'}/></SD>
        <SD title="Schedule"><SR l="Date" v={new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}/><SR l="Start" v={fmt12(shift.start_time)}/><SR l="End" v={fmt12(shift.end_time)}/><SR l="Duration" v={dur}/></SD>
        {shift.notes&&<SD title="Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{shift.notes}</p></SD>}
      </div>
      <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
        {shift.status==='draft'&&canApprove&&<button onClick={()=>onStatusChange(shift.id,'approved')} style={{height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="check" size={15}/>APPROVE SHIFT</button>}
        {shift.status==='approved'&&canPublish&&<button onClick={()=>onStatusChange(shift.id,'published')} style={{height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="eye" size={15}/>PUBLISH TO OFFICERS</button>}
        {canCreate&&shift.status!=='cancelled'&&(conf?
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>setConf(false)} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>BACK</button>
            <button onClick={()=>onDelete(shift.id)} style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>DELETE</button>
          </div>:
          <button onClick={()=>setConf(true)} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="trash" size={15}/>DELETE SHIFT</button>
        )}
      </div>
    </div>
  </>
}

function CreateShiftModal({employees,sites,companyId,createdBy,prefillEmpId,prefillDate,onClose,onSaved}){
  const toast = useToast()
  const today=new Date().toISOString().split('T')[0]
  const prefillDateStr = prefillDate ? prefillDate.toISOString().split('T')[0] : today
  const [form,setForm]=useState({employee_id:prefillEmpId||'',site_id:'',date:prefillDateStr,sh:'08',sm:'00',eh:'16',em:'00',role:'officer',is_armed:false,notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [conflict,setConflict]=useState(null)  // null | { shiftId, startTime, endTime, siteName }
  const [checkingConflict,setCheckingConflict]=useState(false)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  // Check for conflicts whenever employee or time changes
  useEffect(()=>{
    if(!form.employee_id||!form.date) { setConflict(null); return }
    const start=new Date(form.date+'T'+form.sh+':'+form.sm+':00')
    const end=new Date(form.date+'T'+form.eh+':'+form.em+':00')
    if(end<=start) { setConflict(null); return }
    setCheckingConflict(true)
    // Look for overlapping shifts for this employee on this date
    supabase.from('shift')
      .select('id,start_time,end_time,site_id')
      .eq('company_id',companyId)
      .eq('employee_id',form.employee_id)
      .neq('status','cancelled')
      .gte('start_time', new Date(form.date+'T00:00:00').toISOString())
      .lte('start_time', new Date(form.date+'T23:59:59').toISOString())
      .then(({data})=>{
        const overlapping=(data||[]).find(s=>{
          const sStart=new Date(s.start_time), sEnd=new Date(s.end_time)
          return start < sEnd && end > sStart
        })
        if(overlapping){
          const site=sites.find(s=>s.id===overlapping.site_id)
          setConflict({ siteName:site?.name||'another site', startTime:new Date(overlapping.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), endTime:new Date(overlapping.end_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) })
        } else { setConflict(null) }
        setCheckingConflict(false)
      })
  },[form.employee_id,form.date,form.sh,form.sm,form.eh,form.em])

  async function save(){
    if(!form.employee_id||!form.site_id||!form.date){setError('Employee, site, and date are required.');return}
    setSaving(true);setError(null)
    const start=new Date(form.date+'T'+form.sh+':'+form.sm+':00')
    const end=new Date(form.date+'T'+form.eh+':'+form.em+':00')
    if(end<=start){setError('End time must be after start time.');setSaving(false);return}
    const {error}=await supabase.from('shift').insert({company_id:companyId,employee_id:form.employee_id,site_id:form.site_id,start_time:start.toISOString(),end_time:end.toISOString(),role:form.role,is_armed:form.is_armed,notes:form.notes||null,status:'draft',created_by:createdBy})
    if(error){setError(error.message);setSaving(false);return}
    toast('Shift saved')
    onSaved()
  }
  const hrs=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))
  const mins=['00','15','30','45']
  const inp={width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',height:'44px'}
  const lbl={fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'block',marginBottom:'6px'}
  return <>
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,backdropFilter:'blur(2px)'}}/>
    <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(480px,95vw)',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',zIndex:201,display:'flex',flexDirection:'column',maxHeight:'90vh',boxShadow:'var(--shadow-modal)'}}>
      <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>CREATE SHIFT</div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
        {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}
        {conflict&&<div style={{background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-warning)',display:'flex',alignItems:'flex-start',gap:'8px'}}>
          <Icon name="alert-triangle" size={15} color="var(--color-warning)"/>
          <div><strong>Scheduling conflict:</strong> This officer already has a shift at {conflict.siteName} from {conflict.startTime} – {conflict.endTime} on this date. You can still create this shift.</div>
        </div>}
        <div><label style={lbl}>Employee *</label><select value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} style={inp}><option value="">Select employee...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.last_name}, {e.first_name}{e.position_title?' — '+e.position_title:''}</option>)}</select></div>
        <div><label style={lbl}>Site *</label><select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}><option value="">Select site...</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={inp}/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
          <div><label style={lbl}>Start Time</label><div style={{display:'flex',gap:'6px'}}><select value={form.sh} onChange={e=>set('sh',e.target.value)} style={{...inp,flex:1}}>{hrs.map(h=><option key={h} value={h}>{h}</option>)}</select><select value={form.sm} onChange={e=>set('sm',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select></div></div>
          <div><label style={lbl}>End Time</label><div style={{display:'flex',gap:'6px'}}><select value={form.eh} onChange={e=>set('eh',e.target.value)} style={{...inp,flex:1}}>{hrs.map(h=><option key={h} value={h}>{h}</option>)}</select><select value={form.em} onChange={e=>set('em',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select></div></div>
        </div>
        <div><label style={lbl}>Role for this shift</label><select value={form.role} onChange={e=>set('role',e.target.value)} style={inp}>{['officer','corporal','sergeant','lieutenant'].map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
        <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)'}}>
          <input type="checkbox" id="armed" checked={form.is_armed} onChange={e=>set('is_armed',e.target.checked)} style={{width:'18px',height:'18px',accentColor:'var(--accent)'}}/>
          <label htmlFor="armed" style={{fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}><Icon name="shield" size={16} color="var(--accent)"/>Armed post</label>
        </div>
        <div><label style={lbl}>Notes (optional)</label><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} placeholder="Special instructions..." style={{...inp,height:'auto',resize:'vertical',lineHeight:1.5}}/></div>
      </div>
      <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
        <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
        <button onClick={save} disabled={saving} style={{flex:2,height:'44px',background:saving?'var(--accent-dark)':'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>{saving?'SAVING...':'SAVE SHIFT'}</button>
      </div>
    </div>
  </>
}

function SD({title,children}){return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>}

// ── Swaps Panel ───────────────────────────────────────────────────────────────

const SWAP_STATUS = { pending:{bg:'var(--color-warning-bg)',color:'var(--color-warning)',label:'Pending'}, approved:{bg:'var(--color-success-bg)',color:'var(--color-success)',label:'Approved'}, denied:{bg:'var(--color-danger-bg)',color:'var(--color-danger)',label:'Denied'} }

function SwapsPanel({ companyId, profile, employees, shifts, canApprove }) {
  const [swaps, setSwaps]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [employee, setEmployee] = useState(null)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { load() }, [companyId])
  async function load() {
    setLoading(true)
    const [{ data: myEmp }, { data: swapData }] = await Promise.all([
      supabase.from('employee').select('id').eq('user_id', profile.id).single(),
      supabase.from('shift_swap_request').select('*').eq('company_id', companyId).order('created_at',{ascending:false}),
    ])
    setEmployee(myEmp); setSwaps(swapData||[]); setLoading(false)
  }
  async function updateStatus(id, status) {
    await supabase.from('shift_swap_request').update({ status, reviewed_at:new Date().toISOString() }).eq('id', id); load()
  }

  const empMap  = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  const shiftMap = Object.fromEntries(shifts.map(s=>[s.id,s]))
  const visible = swaps.filter(s => filter==='all' || s.status===filter)

  const pill = (st) => { const m=SWAP_STATUS[st]||SWAP_STATUS.pending; return { display:'inline-flex',padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:700,fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',...m } }
  const btnS = (v='accent') => ({ display:'inline-flex',alignItems:'center',gap:'6px',background:v==='accent'?'var(--accent)':v==='ok'?'var(--color-success-bg)':'var(--color-danger-bg)',color:v==='accent'?'var(--text-inverse)':v==='ok'?'var(--color-success)':'var(--color-danger)',border:v==='accent'?'none':v==='ok'?'1px solid rgba(58,170,106,0.3)':'1px solid rgba(192,57,43,0.3)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer' })

  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
          {[['pending','Pending'],['all','All']].map(([v,l])=>(<button key={v} onClick={()=>setFilter(v)} style={{padding:'0 12px',height:'32px',border:'none',borderRadius:'4px',background:filter===v?'var(--accent-bg)':'transparent',color:filter===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>))}
        </div>
        <button style={{...btnS(),height:'40px',padding:'0 16px',fontSize:'12px'}} onClick={()=>setShowNew(true)}>+ REQUEST SWAP</button>
      </div>
      {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div> : visible.length===0 ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:'13px'}}>No swap requests found.</div>
      ) : (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
          {visible.map((sw,i)=>{
            const sh = shiftMap[sw.requester_shift_id]
            const shT = shiftMap[sw.target_shift_id]
            const st = SWAP_STATUS[sw.status]||SWAP_STATUS.pending
            return (
              <div key={sw.id} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',borderBottom:i<visible.length-1?'1px solid var(--border)':'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>
                    {empMap[sw.requester_employee_id]||'—'} → {empMap[sw.target_employee_id]||'Any'}
                  </div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>
                    {sh ? `${new Date(sh.start_time).toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${new Date(sh.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : 'My shift'}
                    {shT ? ` ↔ ${new Date(shT.start_time).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : ''}
                    {sw.notes ? ` · "${sw.notes}"` : ''}
                  </div>
                </div>
                <span style={pill(sw.status)}>{st.label}</span>
                {canApprove && sw.status==='pending' && (
                  <div style={{display:'flex',gap:'6px'}}>
                    <button style={btnS('ok')}   onClick={()=>updateStatus(sw.id,'approved')}><Icon name="check" size={11}/>APPROVE</button>
                    <button style={btnS('deny')} onClick={()=>updateStatus(sw.id,'denied')}><Icon name="x" size={11}/>DENY</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {showNew && <SwapRequestModal companyId={companyId} employee={employee} shifts={shifts.filter(s=>s.employee_id===employee?.id)} employees={employees} allShifts={shifts} onClose={()=>setShowNew(false)} onSaved={()=>{setShowNew(false);load()}}/>}
    </div>
  )
}

function SwapRequestModal({ companyId, employee, shifts, employees, allShifts, onClose, onSaved }) {
  const [form, setForm] = useState({ requester_shift_id:'', target_employee_id:'', target_shift_id:'', notes:'' })
  const [saving, setSaving] = useState(false)
  const inpS = { background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'10px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',fontFamily:'var(--font-body)',cursor:'pointer' }
  const lbl  = { fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'5px' }
  const targetShifts = form.target_employee_id ? allShifts.filter(s=>s.employee_id===form.target_employee_id) : []
  async function save() {
    if (!form.requester_shift_id || !employee?.id) return
    setSaving(true)
    await supabase.from('shift_swap_request').insert({ company_id:companyId, requester_employee_id:employee.id, requester_shift_id:form.requester_shift_id, target_employee_id:form.target_employee_id||null, target_shift_id:form.target_shift_id||null, notes:form.notes||null, status:'pending' })
    setSaving(false); onSaved()
  }
  const ov  = { position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }
  const mod = { background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'28px',width:'100%',maxWidth:'440px',boxShadow:'var(--shadow-modal)' }
  const btn = { display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 22px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer' }
  const gho = { display:'inline-flex',alignItems:'center',gap:'8px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 18px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',letterSpacing:'1px',cursor:'pointer' }
  return (
    <div style={ov} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={mod}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'1.5px',color:'var(--text-primary)'}}>REQUEST SWAP</div>
          <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div style={{marginBottom:'12px'}}><div style={lbl}>My Shift *</div>
          <select style={inpS} value={form.requester_shift_id} onChange={e=>setForm(p=>({...p,requester_shift_id:e.target.value}))}>
            <option value="">Select a shift...</option>
            {shifts.map(s=><option key={s.id} value={s.id}>{new Date(s.start_time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} {new Date(s.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</option>)}
          </select>
        </div>
        <div style={{marginBottom:'12px'}}><div style={lbl}>Swap With (optional)</div>
          <select style={inpS} value={form.target_employee_id} onChange={e=>setForm(p=>({...p,target_employee_id:e.target.value,target_shift_id:''}))}>
            <option value="">Any available officer</option>
            {employees.filter(e=>e.id!==employee?.id).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>
        {targetShifts.length>0&&<div style={{marginBottom:'12px'}}><div style={lbl}>Their Shift</div>
          <select style={inpS} value={form.target_shift_id} onChange={e=>setForm(p=>({...p,target_shift_id:e.target.value}))}>
            <option value="">Select...</option>
            {targetShifts.map(s=><option key={s.id} value={s.id}>{new Date(s.start_time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} {new Date(s.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</option>)}
          </select>
        </div>}
        <div style={{marginBottom:'20px'}}><div style={lbl}>Notes</div>
          <input style={{...inpS,cursor:'text'}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Reason for swap..." onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button style={{...btn,opacity:(!form.requester_shift_id||saving)?0.6:1}} onClick={save} disabled={!form.requester_shift_id||saving}>{saving?'SUBMITTING...':'SUBMIT REQUEST'}</button>
          <button style={gho} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Availability Panel ────────────────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function AvailabilityPanel({ companyId, profile, employees, canEdit }) {
  const [avail, setAvail]     = useState([])
  const [employee, setEmployee] = useState(null)
  const [viewEmpId, setViewEmpId] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [localAvail, setLocalAvail] = useState({})

  useEffect(() => { load() }, [companyId])
  async function load() {
    const [{ data: myEmp }, { data: availData }] = await Promise.all([
      supabase.from('employee').select('id').eq('user_id', profile.id).single(),
      supabase.from('employee_availability').select('*').eq('company_id', companyId),
    ])
    setEmployee(myEmp)
    if (!viewEmpId && myEmp) setViewEmpId(myEmp.id)
    setAvail(availData||[])
  }

  useEffect(() => {
    if (!viewEmpId) return
    const empAvail = avail.filter(a=>a.employee_id===viewEmpId)
    const m = {}
    for (const a of empAvail) { m[a.day_of_week] = { is_available:a.is_available, start_time:a.start_time||'06:00', end_time:a.end_time||'22:00' } }
    const full = {}
    for (let d=0;d<7;d++) { full[d] = m[d] ?? { is_available:true, start_time:'06:00', end_time:'22:00' } }
    setLocalAvail(full)
  }, [viewEmpId, avail])

  async function saveAvail() {
    if (!viewEmpId) return
    setSaving(true)
    await supabase.from('employee_availability').delete().eq('company_id', companyId).eq('employee_id', viewEmpId)
    await supabase.from('employee_availability').insert(
      Object.entries(localAvail).map(([day,val]) => ({ company_id:companyId, employee_id:viewEmpId, day_of_week:parseInt(day), is_available:val.is_available, start_time:val.start_time, end_time:val.end_time }))
    )
    setSaving(false); load()
  }

  function toggle(day) { setLocalAvail(p=>({...p,[day]:{...p[day],is_available:!p[day]?.is_available}})) }
  function setTime(day,field,val) { setLocalAvail(p=>({...p,[day]:{...p[day],[field]:val}})) }

  const canEditThis = canEdit || (employee && viewEmpId===employee.id)
  const empMap = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))

  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
      {canEdit && (
        <div style={{marginBottom:'16px'}}>
          <select style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'10px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',fontFamily:'var(--font-body)',cursor:'pointer'}} value={viewEmpId||''} onChange={e=>setViewEmpId(e.target.value)}>
            {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>
      )}
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden',marginBottom:'14px'}}>
        {DAYS.map((day,i)=>{
          const a = localAvail[i] || { is_available:true, start_time:'06:00', end_time:'22:00' }
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'14px',padding:'13px 18px',borderBottom:i<6?'1px solid var(--border)':'none',opacity:a.is_available?1:0.5}}>
              <div style={{width:'100px',fontSize:'13px',color:'var(--text-primary)',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px'}}>{day}</div>
              <div style={{position:'relative',width:'44px',height:'24px',cursor:canEditThis?'pointer':'default',flexShrink:0}} onClick={()=>canEditThis&&toggle(i)} role="switch" aria-checked={a.is_available}>
                <div style={{position:'absolute',inset:0,borderRadius:'12px',background:a.is_available?'var(--accent)':'var(--border)',transition:'background 200ms'}}/>
                <div style={{position:'absolute',top:'2px',left:a.is_available?'22px':'2px',width:'20px',height:'20px',borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',transition:'left 200ms'}}/>
              </div>
              {a.is_available ? (
                <>
                  <input type="time" value={a.start_time} onChange={e=>canEditThis&&setTime(i,'start_time',e.target.value)} disabled={!canEditThis} style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'6px 10px',fontSize:'12px',color:'var(--text-primary)',outline:'none',width:'110px',fontFamily:'var(--font-body)'}}/>
                  <span style={{fontSize:'12px',color:'var(--text-muted)'}}>to</span>
                  <input type="time" value={a.end_time} onChange={e=>canEditThis&&setTime(i,'end_time',e.target.value)} disabled={!canEditThis} style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'6px 10px',fontSize:'12px',color:'var(--text-primary)',outline:'none',width:'110px',fontFamily:'var(--font-body)'}}/>
                </>
              ) : (
                <span style={{fontSize:'12px',color:'var(--text-muted)'}}>Unavailable</span>
              )}
            </div>
          )
        })}
      </div>
      {canEditThis && (
        <button style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 22px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:saving?0.6:1}} onClick={saveAvail} disabled={saving}>
          <Icon name="save" size={14}/>{saving?'SAVING...':'SAVE AVAILABILITY'}
        </button>
      )}
    </div>
  )
}
function SR({l,v}){if(!v)return null;return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{l}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'65%'}}>{v}</span></div>}

// ── Auto-Assign Modal ─────────────────────────────────────────────────────────

function AutoAssignModal({ employees, sites, shifts, companyId, createdBy, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ site_id:'', date:today, sh:'08', sm:'00', eh:'16', em:'00', role:'officer', count:1 })
  const [preview, setPreview]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const hrs  = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))
  const mins = ['00','15','30','45']
  const inp  = { width:'100%', padding:'10px 12px', background:'var(--bg-input)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'13px', outline:'none', boxSizing:'border-box', height:'44px' }
  const lbl  = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', display:'block', marginBottom:'6px' }

  function findCandidates() {
    if (!form.site_id || !form.date) { setError('Select a site and date.'); return }
    setError(null)
    const start = new Date(form.date+'T'+form.sh+':'+form.sm+':00')
    const end   = new Date(form.date+'T'+form.eh+':'+form.em+':00')
    if (end<=start) { setError('End time must be after start.'); return }

    // Employees already scheduled that day (any site)
    const alreadyScheduled = new Set(
      shifts.filter(s => {
        const sDate = s.start_time?.slice(0,10)
        if (sDate !== form.date) return false
        // Overlap check
        const sStart=new Date(s.start_time), sEnd=new Date(s.end_time)
        return start<sEnd && end>sStart
      }).map(s=>s.employee_id)
    )

    // Filter by role and not already scheduled
    const candidates = employees.filter(e =>
      (form.role==='any' || e.role===form.role || e.position_title?.toLowerCase().includes(form.role)) &&
      !alreadyScheduled.has(e.id)
    ).slice(0, Number(form.count))

    setPreview({ candidates, start, end })
  }

  async function assign() {
    if (!preview?.candidates?.length) return
    setSaving(true)
    const rows = preview.candidates.map(e => ({
      company_id:companyId, employee_id:e.id, site_id:form.site_id,
      start_time:preview.start.toISOString(), end_time:preview.end.toISOString(),
      role:form.role==='any'?e.role:form.role, is_armed:false, status:'draft', created_by:createdBy
    }))
    const { error } = await supabase.from('shift').insert(rows)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); onSaved()
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(520px,95vw)',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',zIndex:201,display:'flex',flexDirection:'column',maxHeight:'90vh',boxShadow:'var(--shadow-modal)'}}>
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>AUTO-ASSIGN SHIFTS</div>
            <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>Fill open slots from available officers</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',minHeight:'44px',minWidth:'44px',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
          {error && <div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div><label style={lbl}>Site *</label><select style={inp} value={form.site_id} onChange={e=>set('site_id',e.target.value)}><option value="">Select site...</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={lbl}>Date *</label><input type="date" style={inp} value={form.date} onChange={e=>set('date',e.target.value)}/></div>
            <div><label style={lbl}>Start Time</label><div style={{display:'flex',gap:'6px'}}><select style={{...inp,flex:1}} value={form.sh} onChange={e=>set('sh',e.target.value)}>{hrs.map(h=><option key={h}>{h}</option>)}</select><select style={{...inp,flex:1}} value={form.sm} onChange={e=>set('sm',e.target.value)}>{mins.map(m=><option key={m}>{m}</option>)}</select></div></div>
            <div><label style={lbl}>End Time</label><div style={{display:'flex',gap:'6px'}}><select style={{...inp,flex:1}} value={form.eh} onChange={e=>set('eh',e.target.value)}>{hrs.map(h=><option key={h}>{h}</option>)}</select><select style={{...inp,flex:1}} value={form.em} onChange={e=>set('em',e.target.value)}>{mins.map(m=><option key={m}>{m}</option>)}</select></div></div>
            <div><label style={lbl}>Role</label><select style={inp} value={form.role} onChange={e=>set('role',e.target.value)}><option value="any">Any available</option>{['officer','corporal','sergeant','lieutenant'].map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
            <div><label style={lbl}>Officers Needed</label><input type="number" min="1" max="20" style={inp} value={form.count} onChange={e=>set('count',Math.max(1,Math.min(20,Number(e.target.value))))}/></div>
          </div>

          <button onClick={findCandidates} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 18px',height:'42px',fontFamily:'var(--font-condensed)',fontSize:'13px',color:'var(--text-secondary)',cursor:'pointer',letterSpacing:'1px'}}>
            <Icon name="search" size={14}/>FIND AVAILABLE OFFICERS
          </button>

          {preview && (
            <div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>
                {preview.candidates.length} officer{preview.candidates.length!==1?'s':''} available (not already scheduled)
              </div>
              {preview.candidates.length === 0 ? (
                <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px',background:'var(--bg-card)',borderRadius:'var(--radius-md)'}}>No available officers match your criteria for this time slot.</div>
              ) : (
                <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
                  {preview.candidates.map((e,i)=>(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'11px 16px',borderBottom:i<preview.candidates.length-1?'1px solid var(--border)':'none'}}>
                      <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,color:'var(--accent)',flexShrink:0}}>{e.first_name[0]}{e.last_name[0]}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{e.first_name} {e.last_name}</div>
                        <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{ROLE_LABELS[e.role]||e.role}{e.position_title?` · ${e.position_title}`:''}</div>
                      </div>
                      <Icon name="check-circle" size={16} color="var(--color-success)"/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
          <button onClick={assign} disabled={!preview?.candidates?.length||saving} style={{flex:1,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:(!preview?.candidates?.length||saving)?0.5:1}}>
            {saving?'ASSIGNING...':`CREATE ${preview?.candidates?.length||0} DRAFT SHIFT${(preview?.candidates?.length||0)!==1?'S':''}`}
          </button>
          <button onClick={onClose} style={{height:'44px',background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',cursor:'pointer',padding:'0 20px'}}>CANCEL</button>
        </div>
      </div>
    </>
  )
}
// ── Grid View ─────────────────────────────────────────────────────────────────

function GridView({ weekDays, sortedEmployees, getShiftsForEmployeeDay, getEmployeeWeekHours, getDayTotalHours, formatShiftTime, siteName, onSelect, onCellClick, canCreate }) {
  return (
    <div style={{flex:1,overflowX:'auto',overflowY:'auto',padding:'0'}}>
      <div style={{display:'grid',gridTemplateColumns:'200px repeat(7,minmax(120px,1fr))',minWidth:'1040px',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',overflow:'hidden',margin:'16px 20px'}}>
        {/* Header */}
        <div style={{background:'var(--bg-surface)',padding:'10px 14px',fontFamily:'var(--font-condensed)',fontSize:'10px',letterSpacing:'1.5px',color:'var(--text-muted)',borderRight:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>OFFICER</div>
        {weekDays.map((d,i) => {
          const isToday = isSameDay(d,new Date())
          return (
            <div key={i} style={{background:isToday?'var(--accent-bg)':'var(--bg-surface)',padding:'10px 14px',textAlign:'center',borderLeft:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontSize:'10px',color:isToday?'var(--accent)':'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{fontSize:'16px',fontWeight:700,color:isToday?'var(--accent)':'var(--text-primary)',lineHeight:1.2}}>{d.getDate()}</div>
            </div>
          )
        })}
        {/* Employee rows */}
        {sortedEmployees.map(emp => (
          <div key={emp.id} style={{display:'contents'}}>
            <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',borderRight:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'8px',background:'var(--bg-card)'}}>
              <div style={{width:'30px',height:'30px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'var(--text-inverse)',flexShrink:0}}>
                {(emp.first_name?.[0]||'')}{(emp.last_name?.[0]||'')}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.first_name} {emp.last_name}</div>
                <div style={{fontSize:'10px',color:'var(--accent)',fontFamily:'var(--font-condensed)'}}>{getEmployeeWeekHours(emp.id)}h</div>
              </div>
            </div>
            {weekDays.map((d,di) => {
              const dayShifts = getShiftsForEmployeeDay(emp.id, d)
              return (
                <div key={di} onClick={() => canCreate && onCellClick(emp, d)}
                  style={{borderTop:'1px solid var(--border)',borderLeft:'1px solid var(--border)',padding:'4px',minHeight:'64px',background:'var(--bg-card)',cursor:canCreate?'pointer':'default',transition:'background 100ms ease'}}
                  onMouseEnter={e=>{if(canCreate)e.currentTarget.style.background='var(--bg-card-hover)'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-card)'}}>
                  {dayShifts.length===0 && canCreate && (
                    <div style={{height:'100%',minHeight:'56px',display:'flex',alignItems:'center',justifyContent:'center',border:'1px dashed var(--border)',borderRadius:'4px',color:'var(--text-muted)',fontSize:'18px',opacity:0.3}}>+</div>
                  )}
                  {dayShifts.map(s => (
                    <div key={s.id} onClick={e=>{e.stopPropagation();onSelect(s)}}
                      style={{background:'var(--bg-surface)',border:'1px solid var(--accent-border)',borderRadius:'4px',padding:'3px 6px',marginBottom:'2px',fontSize:'11px',cursor:'pointer'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--accent-border)'}>
                      <div style={{color:'var(--accent)',fontWeight:700,fontFamily:'var(--font-condensed)'}}>{formatShiftTime(s.start_time)}</div>
                      <div style={{color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{siteName(s.site_id)?.slice(0,14)||'—'}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
        {/* Totals row */}
        <div style={{background:'var(--bg-surface)',padding:'10px 14px',borderTop:'1px solid var(--border)',borderRight:'1px solid var(--border)',fontFamily:'var(--font-condensed)',fontSize:'10px',color:'var(--accent)',fontWeight:700,letterSpacing:'1px'}}>TOTAL HRS</div>
        {weekDays.map((d,i) => (
          <div key={i} style={{background:'var(--bg-surface)',padding:'10px 14px',textAlign:'center',borderTop:'1px solid var(--border)',borderLeft:'1px solid var(--border)',fontFamily:'var(--font-display)',fontSize:'14px',color:'var(--accent)',fontWeight:700}}>
            {getDayTotalHours(d)}h
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shift Bids Panel ──────────────────────────────────────────────────────────

function ShiftBidsPanel({ companyId, profile, employees, sites, canPost }) {
  const [bids, setBids]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]     = useState({ site_id:'', date:'', sh:'08', sm:'00', eh:'16', em:'00', role:'officer', bonus:'' })
  const [saving, setSaving] = useState(false)
  const [myEmpId, setMyEmpId] = useState(null)
  const [applications, setApplications] = useState([])
  const empMap  = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  const siteMap = Object.fromEntries(sites.map(s=>[s.id,s.name]))
  const isOfficer = ['officer','corporal'].includes(profile?.role)
  useEffect(() => { if (!companyId) return; load(); supabase.from('employee').select('id').eq('user_id',profile.id).single().then(({data})=>setMyEmpId(data?.id)) }, [companyId])
  async function load() {
    setLoading(true)
    const [{ data:bidData }, { data:appData }] = await Promise.all([
      supabase.from('shift_bid').select('*').eq('company_id',companyId).eq('status','open').order('start_time'),
      supabase.from('shift_bid_application').select('*').eq('company_id',companyId),
    ])
    setBids(bidData||[]); setApplications(appData||[]); setLoading(false)
  }
  async function postBid() {
    if (!form.site_id||!form.date) return
    setSaving(true)
    const start = new Date(form.date+'T'+form.sh+':'+form.sm+':00')
    const end   = new Date(form.date+'T'+form.eh+':'+form.em+':00')
    await supabase.from('shift_bid').insert({ company_id:companyId, site_id:form.site_id, start_time:start.toISOString(), end_time:end.toISOString(), role:form.role, bonus:Number(form.bonus)||0, status:'open' })
    setSaving(false); setShowNew(false); load()
  }
  async function applyBid(bidId) {
    if (!myEmpId) return
    await supabase.from('shift_bid_application').insert({ shift_bid_id:bidId, employee_id:myEmpId, company_id:companyId, status:'pending' })
    load()
  }
  async function awardBid(bidId, empId) {
    await supabase.from('shift_bid').update({ status:'awarded' }).eq('id',bidId)
    await supabase.from('shift_bid_application').update({ status:'awarded' }).eq('shift_bid_id',bidId).eq('employee_id',empId)
    load()
  }
  const hrs=['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23']
  const mins=['00','15','30','45']
  const inp={width:'100%',padding:'9px 11px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'12px',outline:'none',height:'40px'}
  const lbl={fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'block',marginBottom:'5px'}
  const bidApps = (bidId) => applications.filter(a=>a.shift_bid_id===bidId)
  const hasApplied = (bidId) => applications.some(a=>a.shift_bid_id===bidId&&a.employee_id===myEmpId)
  return (
    <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',textTransform:'uppercase'}}>{bids.length} open bid{bids.length!==1?'s':''}</div>
        {canPost && <button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}} onClick={()=>setShowNew(s=>!s)}>+ POST OPEN SHIFT</button>}
      </div>
      {showNew && (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',marginBottom:'16px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><label style={lbl}>Site *</label><select style={inp} value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}><option value="">Select...</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label style={lbl}>Date *</label><input type="date" style={inp} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <div><label style={lbl}>Start</label><div style={{display:'flex',gap:'4px'}}><select style={{...inp,flex:1}} value={form.sh} onChange={e=>setForm(f=>({...f,sh:e.target.value}))}>{hrs.map(h=><option key={h}>{h}</option>)}</select><select style={{...inp,flex:1}} value={form.sm} onChange={e=>setForm(f=>({...f,sm:e.target.value}))}>{mins.map(m=><option key={m}>{m}</option>)}</select></div></div>
            <div><label style={lbl}>End</label><div style={{display:'flex',gap:'4px'}}><select style={{...inp,flex:1}} value={form.eh} onChange={e=>setForm(f=>({...f,eh:e.target.value}))}>{hrs.map(h=><option key={h}>{h}</option>)}</select><select style={{...inp,flex:1}} value={form.em} onChange={e=>setForm(f=>({...f,em:e.target.value}))}>{mins.map(m=><option key={m}>{m}</option>)}</select></div></div>
            <div><label style={lbl}>Role</label><select style={inp} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{['officer','corporal','sergeant'].map(r=><option key={r} value={r}>{r}</option>)}</select></div>
            <div><label style={lbl}>Bonus ($)</label><input type="number" min="0" style={inp} value={form.bonus} onChange={e=>setForm(f=>({...f,bonus:e.target.value}))} placeholder="0"/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:(!form.site_id||!form.date||saving)?0.6:1}} onClick={postBid} disabled={!form.site_id||!form.date||saving}>{saving?'POSTING...':'POST BID'}</button>
            <button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}} onClick={()=>setShowNew(false)}>CANCEL</button>
          </div>
        </div>
      )}
      {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>
        : bids.length===0 ? <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:'13px'}}>No open shift bids.</div>
        : bids.map(bid => {
          const apps = bidApps(bid.id)
          const applied = hasApplied(bid.id)
          return (
            <div key={bid.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{siteMap[bid.site_id]||'—'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{new Date(bid.start_time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {new Date(bid.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} – {new Date(bid.end_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} · {bid.role}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  {bid.bonus>0 && <div style={{fontSize:'13px',color:'var(--color-success)',fontWeight:700,fontFamily:'var(--font-condensed)'}}>+${bid.bonus} bonus</div>}
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{apps.length} bid{apps.length!==1?'s':''}</div>
                </div>
              </div>
              {isOfficer && !applied && <button style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent-bg)',color:'var(--accent)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'32px',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer'}} onClick={()=>applyBid(bid.id)}>BID FOR THIS SHIFT</button>}
              {isOfficer && applied && <span style={{fontSize:'11px',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontWeight:700}}>✓ YOUR BID SUBMITTED</span>}
              {canPost && apps.length>0 && (
                <div style={{marginTop:'10px',borderTop:'1px solid var(--border)',paddingTop:'8px'}}>
                  <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>Applicants</div>
                  {apps.map(app=>(
                    <div key={app.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                      <span style={{fontSize:'12px',color:'var(--text-primary)'}}>{empMap[app.employee_id]||'—'}</span>
                      {app.status==='pending' ? <button style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'var(--color-success-bg)',color:'var(--color-success)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-sm)',padding:'0 10px',height:'28px',fontFamily:'var(--font-condensed)',fontSize:'10px',fontWeight:700,cursor:'pointer'}} onClick={()=>awardBid(bid.id,app.employee_id)}>AWARD</button>
                        : <span style={{fontSize:'10px',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontWeight:700}}>AWARDED ✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      }
    </div>
  )
}
