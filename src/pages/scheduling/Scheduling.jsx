import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Published' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Cancelled' },
}

function isSameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function fmt12(ts){ if(!ts) return '—'; return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) }
function fmtDate(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }

function getWeekDates(base, offset=0){
  const d=new Date(base)
  d.setDate(d.getDate()-d.getDay()+(offset*7))
  return Array.from({length:7},(_,i)=>{ const day=new Date(d); day.setDate(d.getDate()+i); return day })
}

function getBiweekDates(base){
  return [...getWeekDates(base,0),...getWeekDates(base,1)]
}

function getMonthDates(base){
  const year=base.getFullYear(), month=base.getMonth()
  const first=new Date(year,month,1)
  const last=new Date(year,month+1,0)
  const startPad=first.getDay()
  const endPad=6-last.getDay()
  const dates=[]
  for(let i=startPad;i>0;i--){ const d=new Date(first); d.setDate(d.getDate()-i); dates.push({date:d,thisMonth:false}) }
  for(let i=1;i<=last.getDate();i++) dates.push({date:new Date(year,month,i),thisMonth:true})
  for(let i=1;i<=endPad;i++){ const d=new Date(last); d.setDate(d.getDate()+i); dates.push({date:d,thisMonth:false}) }
  return dates
}

export default function Scheduling() {
  const { profile } = useAuth()
  const [viewMode, setViewMode]   = useState('week') // week | biweek | month | year
  const [baseDate, setBaseDate]   = useState(new Date())
  const [shifts, setShifts]       = useState([])
  const [employees, setEmployees] = useState([])
  const [sites, setSites]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [filterSite, setFilterSite]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmp, setFilterEmp]       = useState('all')
  const [sortEmp, setSortEmp]           = useState('last') // first | last
  const [filterTitle, setFilterTitle]   = useState('all')
  const [mobileEmpIdx, setMobileEmpIdx] = useState(0)
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768)

  const canCreate  = atLeast(profile?.role,'sergeant')
  const canApprove = atLeast(profile?.role,'lieutenant')
  const canPublish = atLeast(profile?.role,'lieutenant')
  const isOfficer  = ['officer','corporal'].includes(profile?.role)

  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768)
    window.addEventListener('resize',handler)
    return ()=>window.removeEventListener('resize',handler)
  },[])

  // Date range for query based on view
  const dateRange = useMemo(()=>{
    const y=baseDate.getFullYear(), m=baseDate.getMonth()
    if(viewMode==='year'){
      return { start:new Date(y,0,1), end:new Date(y,11,31,23,59,59) }
    } else if(viewMode==='month'){
      return { start:new Date(y,m,1), end:new Date(y,m+1,0,23,59,59) }
    } else if(viewMode==='biweek'){
      const w1=getWeekDates(baseDate,0); const w2=getWeekDates(baseDate,1)
      const start=new Date(w1[0]); start.setHours(0,0,0,0)
      const end=new Date(w2[6]); end.setHours(23,59,59,999)
      return { start, end }
    } else {
      const week=getWeekDates(baseDate)
      const start=new Date(week[0]); start.setHours(0,0,0,0)
      const end=new Date(week[6]); end.setHours(23,59,59,999)
      return { start, end }
    }
  },[viewMode,baseDate])

  useEffect(()=>{ loadAll() },[profile,dateRange])

  async function loadAll(){
    if(!profile?.company_id) return
    setLoading(true)
    const [shiftsRes,empRes,siteRes] = await Promise.all([
      supabase.from('shift').select('*').eq('company_id',profile.company_id)
        .gte('start_time',dateRange.start.toISOString())
        .lte('start_time',dateRange.end.toISOString())
        .order('start_time'),
      supabase.from('employee').select('id,first_name,last_name,role,is_armed,position_title,status')
        .eq('company_id',profile.company_id).eq('status','active'),
      supabase.from('site').select('id,name,city,state').eq('company_id',profile.company_id),
    ])
    let shiftData=shiftsRes.data||[]
    if(isOfficer){ const myEmp=(empRes.data||[]).find(e=>e.id===profile.employee_id); if(myEmp) shiftData=shiftData.filter(s=>s.employee_id===myEmp.id) }
    setShifts(shiftData); setEmployees(empRes.data||[]); setSites(siteRes.data||[])
    setLoading(false)
  }

  const sortedEmployees = useMemo(()=>[...employees].sort((a,b)=>{
    const ka = sortEmp==='first' ? a.first_name : a.last_name
    const kb = sortEmp==='first' ? b.first_name : b.last_name
    return ka.localeCompare(kb)
  }),[employees,sortEmp])

  const positionTitles = useMemo(()=>[...new Set(employees.map(e=>e.position_title).filter(Boolean))].sort(),[employees])

  const filteredShifts = useMemo(()=>shifts.filter(s=>{
    const emp=employees.find(e=>e.id===s.employee_id)
    return (filterSite==='all'||s.site_id===filterSite)
      &&(filterStatus==='all'||s.status===filterStatus)
      &&(filterEmp==='all'||s.employee_id===filterEmp)
      &&(filterTitle==='all'||emp?.position_title===filterTitle)
  }),[shifts,filterSite,filterStatus,filterEmp,filterTitle,employees])

  function empName(id,mode='full'){
    const e=employees.find(e=>e.id===id)
    if(!e) return '—'
    return mode==='first'?e.first_name:mode==='last'?e.last_name:`${e.first_name} ${e.last_name}`
  }
  function siteName(id){ const s=sites.find(s=>s.id===id); return s?s.name:'—' }

  // Navigation
  function navigate(dir){
    const d=new Date(baseDate)
    if(viewMode==='week') d.setDate(d.getDate()+(dir*7))
    else if(viewMode==='biweek') d.setDate(d.getDate()+(dir*14))
    else if(viewMode==='month') d.setMonth(d.getMonth()+dir)
    else if(viewMode==='year') d.setFullYear(d.getFullYear()+dir)
    setBaseDate(d)
  }

  // Period label
  const periodLabel = useMemo(()=>{
    if(viewMode==='year') return String(baseDate.getFullYear())
    if(viewMode==='month') return `${MONTHS[baseDate.getMonth()]} ${baseDate.getFullYear()}`
    if(viewMode==='week'){
      const w=getWeekDates(baseDate)
      return `${fmtDate(w[0])} — ${fmtDate(w[6])}, ${w[0].getFullYear()}`
    }
    if(viewMode==='biweek'){
      const w=getBiweekDates(baseDate)
      return `${fmtDate(w[0])} — ${fmtDate(w[13])}, ${w[0].getFullYear()}`
    }
    return ''
  },[viewMode,baseDate])

  const today=new Date()

  // Mobile: filter to one employee at a time
  const mobileEmployee = isMobile ? sortedEmployees[mobileEmpIdx] : null

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .shift-chip:hover{opacity:0.85;transform:scale(1.01)}
        select option{background:#1a2b4a;color:#fff}
      `}</style>

      {/* ── Toolbar ── */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'}}>
        {/* Row 1: title + nav + view toggles */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1,margin:0}}>SCHEDULING</h2>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <button onClick={()=>navigate(-1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}}><Icon name="chevron-left" size={15}/></button>
              <button onClick={()=>setBaseDate(new Date())} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',padding:'0 10px',minHeight:'36px',fontSize:'11px',fontFamily:'var(--font-condensed)',letterSpacing:'1px',whiteSpace:'nowrap'}}>TODAY</button>
              <button onClick={()=>navigate(1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}}><Icon name="chevron-right" size={15}/></button>
              <span style={{fontSize:'12px',color:'var(--text-secondary)',marginLeft:'6px',whiteSpace:'nowrap'}}>{periodLabel}</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
            {/* View mode */}
            <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
              {['week','biweek','month','year'].map(v=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'0 10px',height:'28px',minHeight:'36px',border:'none',borderRadius:'4px',background:viewMode===v?'var(--accent-bg)':'transparent',color:viewMode===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'10px',fontFamily:'var(--font-condensed)',letterSpacing:'1px',transition:'all 120ms ease'}}>
                  {v==='biweek'?'2 WK':v.toUpperCase()}
                </button>
              ))}
            </div>
            {canCreate&&(
              <button onClick={()=>setShowCreate(true)} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',minHeight:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',whiteSpace:'nowrap'}}>
                <Icon name="plus" size={14}/>ADD SHIFT
              </button>
            )}
          </div>
        </div>

        {/* Row 2: filters — hidden on mobile for year view */}
        {!(isMobile&&viewMode==='year') && (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
            <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={selStyle}>
              <option value="all">All Sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!isMobile&&<>
              <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={selStyle}>
                <option value="all">All Employees</option>
                {sortedEmployees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
              <select value={filterTitle} onChange={e=>setFilterTitle(e.target.value)} style={selStyle}>
                <option value="all">All Positions</option>
                {positionTitles.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={sortEmp} onChange={e=>setSortEmp(e.target.value)} style={selStyle}>
                <option value="last">Sort: Last Name</option>
                <option value="first">Sort: First Name</option>
              </select>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
                <option value="all">All Status</option>
                {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </>}
            {isMobile&&viewMode!=='year'&&sortedEmployees.length>0&&(
              <div style={{display:'flex',alignItems:'center',gap:'6px',flex:1}}>
                <button onClick={()=>setMobileEmpIdx(i=>Math.max(0,i-1))} style={navBtnStyle} disabled={mobileEmpIdx===0}><Icon name="chevron-left" size={14}/></button>
                <span style={{flex:1,textAlign:'center',fontSize:'13px',color:'var(--text-primary)',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {sortedEmployees[mobileEmpIdx]?`${sortedEmployees[mobileEmpIdx].first_name} ${sortedEmployees[mobileEmpIdx].last_name}`:'All'}
                </span>
                <button onClick={()=>setMobileEmpIdx(i=>Math.min(sortedEmployees.length-1,i+1))} style={navBtnStyle} disabled={mobileEmpIdx===sortedEmployees.length-1}><Icon name="chevron-right" size={14}/></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode}/>
      ) : viewMode==='year' ? (
        <YearView baseDate={baseDate} shifts={filteredShifts} today={today} onMonthClick={(m)=>{ const d=new Date(baseDate); d.setMonth(m); setBaseDate(d); setViewMode('month') }}/>
      ) : viewMode==='month' ? (
        <MonthView baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      ) : viewMode==='biweek' ? (
        <MultiWeekView weeks={2} baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      ) : (
        <MultiWeekView weeks={1} baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      )}

      {selected&&(
        <ShiftDetail shift={selected} empName={empName} siteName={siteName} canApprove={canApprove} canPublish={canPublish} canCreate={canCreate}
          onClose={()=>setSelected(null)}
          onStatusChange={async(id,status)=>{ await supabase.from('shift').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id); setSelected(null); loadAll() }}
          onDelete={async(id)=>{ await supabase.from('shift').delete().eq('id',id); setSelected(null); loadAll() }}
        />
      )}

      {showCreate&&(
        <CreateShiftModal employees={sortedEmployees} sites={sites} companyId={profile.company_id} createdBy={profile.id}
          onClose={()=>setShowCreate(false)} onSaved={()=>{ setShowCreate(false); loadAll() }}/>
      )}
    </div>
  )
}

const selStyle={padding:'0 10px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'12px',minHeight:'36px',cursor:'pointer'}
const navBtnStyle={background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}

// ─── Multi-Week View (week + biweek) ──────────────────────
function MultiWeekView({weeks,baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const allDates=useMemo(()=>{
    const result=[]
    for(let w=0;w<weeks;w++){
      getWeekDates(baseDate,w).forEach(d=>result.push(d))
    }
    return result
  },[baseDate,weeks])

  function shiftsForDay(date){
    let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date))
    if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId)
    return s
  }

  const cols=isMobile?3:7
  const visibleDates=isMobile?allDates.slice(0,7*weeks):allDates

  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      {weeks===2&&!isMobile&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px'}}>
          {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${isMobile?7:7},1fr)`,gap:'6px'}}>
        {!isMobile&&DAYS_SHORT.map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>
        ))}
        {visibleDates.map((date,i)=>{
          const isToday=isSameDay(date,today)
          const dayShifts=shiftsForDay(date)
          return (
            <div key={i} style={{background:'var(--bg-card)',border:`1px solid ${isToday?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',minHeight:isMobile?'80px':'140px',overflow:'hidden'}}>
              <div style={{padding:'6px 8px',borderBottom:'1px solid var(--border)',background:isToday?'var(--accent-bg)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  {!isMobile&&<div style={{fontSize:'9px',color:isToday?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{DAYS_SHORT[date.getDay()]}</div>}
                  <div style={{fontSize:isMobile?'13px':'16px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)',lineHeight:1}}>{date.getDate()}</div>
                </div>
                {dayShifts.length>0&&<span style={{fontSize:'9px',background:'var(--border)',color:'var(--text-muted)',borderRadius:'10px',padding:'1px 5px'}}>{dayShifts.length}</span>}
              </div>
              <div style={{padding:'4px',display:'flex',flexDirection:'column',gap:'3px'}}>
                {dayShifts.slice(0,isMobile?2:999).map(shift=>(
                  <ShiftChip key={shift.id} shift={shift} empName={empName} siteName={siteName} onClick={()=>onSelect(shift)} compact={isMobile}/>
                ))}
                {isMobile&&dayShifts.length>2&&<div style={{fontSize:'10px',color:'var(--text-muted)',textAlign:'center'}}>+{dayShifts.length-2}</div>}
                {dayShifts.length===0&&!isMobile&&<div style={{padding:'8px 4px',textAlign:'center',fontSize:'10px',color:'var(--text-muted)'}}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────
function MonthView({baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const dates=useMemo(()=>getMonthDates(baseDate),[baseDate])
  function shiftsForDay(date){
    let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date))
    if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId)
    return s
  }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px',marginBottom:'6px'}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
        {dates.map(({date,thisMonth},i)=>{
          const isToday=isSameDay(date,today)
          const dayShifts=shiftsForDay(date)
          return (
            <div key={i} style={{background:thisMonth?'var(--bg-card)':'rgba(0,0,0,0.15)',border:`1px solid ${isToday?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-sm)',minHeight:isMobile?'60px':'100px',overflow:'hidden',opacity:thisMonth?1:0.5}}>
              <div style={{padding:'4px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',background:isToday?'var(--accent-bg)':'transparent'}}>
                <span style={{fontSize:isMobile?'11px':'13px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)'}}>{date.getDate()}</span>
                {dayShifts.length>0&&<span style={{fontSize:'9px',background:isToday?'var(--accent)':'var(--border)',color:isToday?'var(--text-inverse)':'var(--text-muted)',borderRadius:'10px',padding:'0 4px'}}>{dayShifts.length}</span>}
              </div>
              <div style={{padding:'2px 4px',display:'flex',flexDirection:'column',gap:'2px'}}>
                {dayShifts.slice(0,isMobile?1:3).map(shift=>(
                  <ShiftChip key={shift.id} shift={shift} empName={empName} siteName={siteName} onClick={()=>onSelect(shift)} compact={true}/>
                ))}
                {dayShifts.length>(isMobile?1:3)&&<div style={{fontSize:'9px',color:'var(--text-muted)',paddingLeft:'4px'}}>+{dayShifts.length-(isMobile?1:3)} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Year View (12 mini-month calendars) ─────────────────
function YearView({baseDate,shifts,today,onMonthClick}){
  const year=baseDate.getFullYear()
  function shiftsInMonth(month){
    return shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===month })
  }
  function shiftsOnDay(year,month,day){
    return shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day }).length
  }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
        {MONTHS.map((monthName,m)=>{
          const dates=getMonthDates(new Date(year,m,1))
          const monthShifts=shiftsInMonth(m)
          const isCurrentMonth=today.getFullYear()===year&&today.getMonth()===m
          return (
            <button key={m} onClick={()=>onMonthClick(m)}
              style={{background:'var(--bg-card)',border:`1px solid ${isCurrentMonth?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'12px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-border)';e.currentTarget.style.background='var(--bg-card-hover)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=isCurrentMonth?'var(--accent-border)':'var(--border-subtle)';e.currentTarget.style.background='var(--bg-card)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,color:isCurrentMonth?'var(--accent)':'var(--text-primary)',letterSpacing:'0.5px'}}>{monthName}</span>
                {monthShifts.length>0&&<span style={{fontSize:'10px',background:'var(--accent-bg)',color:'var(--accent)',borderRadius:'10px',padding:'1px 6px',fontWeight:600}}>{monthShifts.length}</span>}
              </div>
              {/* Mini calendar grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px'}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'8px',color:'var(--text-muted)',padding:'1px 0'}}>{d[0]}</div>)}
                {dates.map(({date,thisMonth},i)=>{
                  const isToday=isSameDay(date,today)
                  const count=thisMonth?shiftsOnDay(year,m,date.getDate()):0
                  const hasShift=count>0
                  return (
                    <div key={i} style={{textAlign:'center',fontSize:'9px',padding:'2px 1px',borderRadius:'3px',background:isToday?'var(--accent)':hasShift?'var(--accent-bg)':'transparent',color:isToday?'var(--text-inverse)':hasShift?'var(--accent)':thisMonth?'var(--text-secondary)':'var(--text-muted)',fontWeight:hasShift?700:400,opacity:thisMonth?1:0.4}}>
                      {date.getDate()}
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shift Chip ───────────────────────────────────────────
function ShiftChip({shift,empName,siteName,onClick,compact}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  return (
    <button onClick={e=>{e.stopPropagation();onClick()}} className="shift-chip"
      style={{background:ss.bg,border:'1px solid transparent',borderRadius:'4px',padding:compact?'3px 5px':'5px 7px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 120ms ease'}}>
      {!compact&&<div style={{fontSize:'10px',fontWeight:600,color:ss.color,marginBottom:'1px'}}>{fmt12(shift.start_time)}</div>}
      <div style={{fontSize:compact?'9px':'10px',color:'var(--text-primary)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{empName(shift.employee_id,'last')}</div>
      {!compact&&<div style={{fontSize:'9px',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{siteName(shift.site_id)}</div>}
    </button>
  )
}

// ─── Shift Detail Panel ───────────────────────────────────
function ShiftDetail({shift,empName,siteName,canApprove,canPublish,canCreate,onClose,onStatusChange,onDelete}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  const [confirming,setConfirming]=useState(false)
  const dur=shift.start_time&&shift.end_time?`${((new Date(shift.end_time)-new Date(shift.start_time))/3600000).toFixed(1)}h`:'—'
  return (
    <>
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
          <DSec title="Assignment">
            <DR label="Employee" value={empName(shift.employee_id)}/>
            <DR label="Site" value={siteName(shift.site_id)}/>
            <DR label="Role" value={ROLE_LABELS[shift.role]||shift.role||'—'}/>
          </DSec>
          <DSec title="Schedule">
            <DR label="Date" value={new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}/>
            <DR label="Start" value={fmt12(shift.start_time)}/>
            <DR label="End" value={fmt12(shift.end_time)}/>
            <DR label="Duration" value={dur}/>
          </DSec>
          {shift.notes&&<DSec title="Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{shift.notes}</p></DSec>}
          {shift.published_at&&<DSec title="Published"><DR label="At" value={new Date(shift.published_at).toLocaleString()}/></DSec>}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
          {shift.status==='draft'&&canApprove&&(
            <button onClick={()=>onStatusChange(shift.id,'approved')} style={{height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="check" size={15}/>APPROVE SHIFT
            </button>
          )}
          {shift.status==='approved'&&canPublish&&(
            <button onClick={()=>onStatusChange(shift.id,'published')} style={{height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="eye" size={15}/>PUBLISH TO OFFICERS
            </button>
          )}
          {canCreate&&shift.status!=='cancelled'&&(confirming?(
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setConfirming(false)} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>BACK</button>
              <button onClick={()=>onDelete(shift.id)} style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>DELETE</button>
            </div>
          ):(
            <button onClick={()=>setConfirming(true)} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="trash" size={15}/>DELETE SHIFT
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Create Shift Modal ───────────────────────────────────
function CreateShiftModal({employees,sites,companyId,createdBy,onClose,onSaved}){
  const today=new Date().toISOString().split('T')[0]
  const [form,setForm]=useState({employee_id:'',site_id:'',date:today,start_hour:'08',start_min:'00',end_hour:'16',end_min:'00',role:'officer',is_armed:false,notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function save(){
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
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>CREATE SHIFT</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
          {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}
          <div><label style={lbl}>Employee *</label>
            <select value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} style={inp}>
              <option value="">Select employee...</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.last_name}, {e.first_name}{e.position_title?` — ${e.position_title}`:''}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Site *</label>
            <select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}>
              <option value="">Select site...</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={inp}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div><label style={lbl}>Start Time</label>
              <div style={{display:'flex',gap:'6px'}}>
                <select value={form.start_hour} onChange={e=>set('start_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select>
                <select value={form.start_min} onChange={e=>set('start_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select>
              </div>
            </div>
            <div><label style={lbl}>End Time</label>
              <div style={{display:'flex',gap:'6px'}}>
                <select value={form.end_hour} onChange={e=>set('end_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select>
                <select value={form.end_min} onChange={e=>set('end_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select>
              </div>
            </div>
          </div>
          <div><label style={lbl}>Role for this shift</label>
            <select value={form.role} onChange={e=>set('role',e.target.value)} style={inp}>
              {['officer','corporal','sergeant','lieutenant'].map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)'}}>
            <input type="checkbox" id="is_armed" checked={form.is_armed} onChange={e=>set('is_armed',e.target.checked)} style={{width:'18px',height:'18px',cursor:'pointer',accentColor:'var(--accent)'}}/>
            <label htmlFor="is_armed" style={{fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}><Icon name="shield" size={16} color="var(--accent)"/>Armed post</label>
          </div>
          <div><label style={lbl}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} placeholder="Special instructions, post orders..." style={{...inp,height:'auto',resize:'vertical',padding:'10px 12px',lineHeight:1.5}}/>
          </div>
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
          <button onClick={save} disabled={saving} style={{flex:2,height:'44px',background:saving?'var(--accent-dark)':'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:saving?'not-allowed':'pointer'}}>{saving?'SAVING...':'SAVE SHIFT'}</button>
        </div>
      </div>
    </>
  )
}

function DSec({title,children}){return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>}
function DR({label,value}){if(!value)return null;return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{label}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'65%'}}>{value}</span></div>}
function LoadingSkeleton({viewMode}){return <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:viewMode==='year'?'repeat(auto-fill,minmax(200px,1fr))':'repeat(7,1fr)',gap:'8px'}}>{[...Array(viewMode==='year'?12:7)].map((_,i)=><div key={i} style={{height:viewMode==='year'?'200px':'180px',borderRadius:'8px'}} className="skeleton"/>)}</div>}
ENDOFFILEcat > ~/Downloads/postcommand/src/pages/scheduling/Scheduling.jsx << 'ENDOFFILE'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Published' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Cancelled' },
}

function isSameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function fmt12(ts){ if(!ts) return '—'; return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) }
function fmtDate(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }

function getWeekDates(base, offset=0){
  const d=new Date(base)
  d.setDate(d.getDate()-d.getDay()+(offset*7))
  return Array.from({length:7},(_,i)=>{ const day=new Date(d); day.setDate(d.getDate()+i); return day })
}

function getBiweekDates(base){
  return [...getWeekDates(base,0),...getWeekDates(base,1)]
}

function getMonthDates(base){
  const year=base.getFullYear(), month=base.getMonth()
  const first=new Date(year,month,1)
  const last=new Date(year,month+1,0)
  const startPad=first.getDay()
  const endPad=6-last.getDay()
  const dates=[]
  for(let i=startPad;i>0;i--){ const d=new Date(first); d.setDate(d.getDate()-i); dates.push({date:d,thisMonth:false}) }
  for(let i=1;i<=last.getDate();i++) dates.push({date:new Date(year,month,i),thisMonth:true})
  for(let i=1;i<=endPad;i++){ const d=new Date(last); d.setDate(d.getDate()+i); dates.push({date:d,thisMonth:false}) }
  return dates
}

export default function Scheduling() {
  const { profile } = useAuth()
  const [viewMode, setViewMode]   = useState('week') // week | biweek | month | year
  const [baseDate, setBaseDate]   = useState(new Date())
  const [shifts, setShifts]       = useState([])
  const [employees, setEmployees] = useState([])
  const [sites, setSites]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]   = useState(null)
  const [filterSite, setFilterSite]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmp, setFilterEmp]       = useState('all')
  const [sortEmp, setSortEmp]           = useState('last') // first | last
  const [filterTitle, setFilterTitle]   = useState('all')
  const [mobileEmpIdx, setMobileEmpIdx] = useState(0)
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768)

  const canCreate  = atLeast(profile?.role,'sergeant')
  const canApprove = atLeast(profile?.role,'lieutenant')
  const canPublish = atLeast(profile?.role,'lieutenant')
  const isOfficer  = ['officer','corporal'].includes(profile?.role)

  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768)
    window.addEventListener('resize',handler)
    return ()=>window.removeEventListener('resize',handler)
  },[])

  // Date range for query based on view
  const dateRange = useMemo(()=>{
    const y=baseDate.getFullYear(), m=baseDate.getMonth()
    if(viewMode==='year'){
      return { start:new Date(y,0,1), end:new Date(y,11,31,23,59,59) }
    } else if(viewMode==='month'){
      return { start:new Date(y,m,1), end:new Date(y,m+1,0,23,59,59) }
    } else if(viewMode==='biweek'){
      const w1=getWeekDates(baseDate,0); const w2=getWeekDates(baseDate,1)
      const start=new Date(w1[0]); start.setHours(0,0,0,0)
      const end=new Date(w2[6]); end.setHours(23,59,59,999)
      return { start, end }
    } else {
      const week=getWeekDates(baseDate)
      const start=new Date(week[0]); start.setHours(0,0,0,0)
      const end=new Date(week[6]); end.setHours(23,59,59,999)
      return { start, end }
    }
  },[viewMode,baseDate])

  useEffect(()=>{ loadAll() },[profile,dateRange])

  async function loadAll(){
    if(!profile?.company_id) return
    setLoading(true)
    const [shiftsRes,empRes,siteRes] = await Promise.all([
      supabase.from('shift').select('*').eq('company_id',profile.company_id)
        .gte('start_time',dateRange.start.toISOString())
        .lte('start_time',dateRange.end.toISOString())
        .order('start_time'),
      supabase.from('employee').select('id,first_name,last_name,role,is_armed,position_title,status')
        .eq('company_id',profile.company_id).eq('status','active'),
      supabase.from('site').select('id,name,city,state').eq('company_id',profile.company_id),
    ])
    let shiftData=shiftsRes.data||[]
    if(isOfficer){ const myEmp=(empRes.data||[]).find(e=>e.id===profile.employee_id); if(myEmp) shiftData=shiftData.filter(s=>s.employee_id===myEmp.id) }
    setShifts(shiftData); setEmployees(empRes.data||[]); setSites(siteRes.data||[])
    setLoading(false)
  }

  const sortedEmployees = useMemo(()=>[...employees].sort((a,b)=>{
    const ka = sortEmp==='first' ? a.first_name : a.last_name
    const kb = sortEmp==='first' ? b.first_name : b.last_name
    return ka.localeCompare(kb)
  }),[employees,sortEmp])

  const positionTitles = useMemo(()=>[...new Set(employees.map(e=>e.position_title).filter(Boolean))].sort(),[employees])

  const filteredShifts = useMemo(()=>shifts.filter(s=>{
    const emp=employees.find(e=>e.id===s.employee_id)
    return (filterSite==='all'||s.site_id===filterSite)
      &&(filterStatus==='all'||s.status===filterStatus)
      &&(filterEmp==='all'||s.employee_id===filterEmp)
      &&(filterTitle==='all'||emp?.position_title===filterTitle)
  }),[shifts,filterSite,filterStatus,filterEmp,filterTitle,employees])

  function empName(id,mode='full'){
    const e=employees.find(e=>e.id===id)
    if(!e) return '—'
    return mode==='first'?e.first_name:mode==='last'?e.last_name:`${e.first_name} ${e.last_name}`
  }
  function siteName(id){ const s=sites.find(s=>s.id===id); return s?s.name:'—' }

  // Navigation
  function navigate(dir){
    const d=new Date(baseDate)
    if(viewMode==='week') d.setDate(d.getDate()+(dir*7))
    else if(viewMode==='biweek') d.setDate(d.getDate()+(dir*14))
    else if(viewMode==='month') d.setMonth(d.getMonth()+dir)
    else if(viewMode==='year') d.setFullYear(d.getFullYear()+dir)
    setBaseDate(d)
  }

  // Period label
  const periodLabel = useMemo(()=>{
    if(viewMode==='year') return String(baseDate.getFullYear())
    if(viewMode==='month') return `${MONTHS[baseDate.getMonth()]} ${baseDate.getFullYear()}`
    if(viewMode==='week'){
      const w=getWeekDates(baseDate)
      return `${fmtDate(w[0])} — ${fmtDate(w[6])}, ${w[0].getFullYear()}`
    }
    if(viewMode==='biweek'){
      const w=getBiweekDates(baseDate)
      return `${fmtDate(w[0])} — ${fmtDate(w[13])}, ${w[0].getFullYear()}`
    }
    return ''
  },[viewMode,baseDate])

  const today=new Date()

  // Mobile: filter to one employee at a time
  const mobileEmployee = isMobile ? sortedEmployees[mobileEmpIdx] : null

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .shift-chip:hover{opacity:0.85;transform:scale(1.01)}
        select option{background:#1a2b4a;color:#fff}
      `}</style>

      {/* ── Toolbar ── */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'}}>
        {/* Row 1: title + nav + view toggles */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1,margin:0}}>SCHEDULING</h2>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <button onClick={()=>navigate(-1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}}><Icon name="chevron-left" size={15}/></button>
              <button onClick={()=>setBaseDate(new Date())} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',padding:'0 10px',minHeight:'36px',fontSize:'11px',fontFamily:'var(--font-condensed)',letterSpacing:'1px',whiteSpace:'nowrap'}}>TODAY</button>
              <button onClick={()=>navigate(1)} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}}><Icon name="chevron-right" size={15}/></button>
              <span style={{fontSize:'12px',color:'var(--text-secondary)',marginLeft:'6px',whiteSpace:'nowrap'}}>{periodLabel}</span>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
            {/* View mode */}
            <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
              {['week','biweek','month','year'].map(v=>(
                <button key={v} onClick={()=>setViewMode(v)} style={{padding:'0 10px',height:'28px',minHeight:'36px',border:'none',borderRadius:'4px',background:viewMode===v?'var(--accent-bg)':'transparent',color:viewMode===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'10px',fontFamily:'var(--font-condensed)',letterSpacing:'1px',transition:'all 120ms ease'}}>
                  {v==='biweek'?'2 WK':v.toUpperCase()}
                </button>
              ))}
            </div>
            {canCreate&&(
              <button onClick={()=>setShowCreate(true)} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',minHeight:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',whiteSpace:'nowrap'}}>
                <Icon name="plus" size={14}/>ADD SHIFT
              </button>
            )}
          </div>
        </div>

        {/* Row 2: filters — hidden on mobile for year view */}
        {!(isMobile&&viewMode==='year') && (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
            <select value={filterSite} onChange={e=>setFilterSite(e.target.value)} style={selStyle}>
              <option value="all">All Sites</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!isMobile&&<>
              <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={selStyle}>
                <option value="all">All Employees</option>
                {sortedEmployees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
              <select value={filterTitle} onChange={e=>setFilterTitle(e.target.value)} style={selStyle}>
                <option value="all">All Positions</option>
                {positionTitles.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={sortEmp} onChange={e=>setSortEmp(e.target.value)} style={selStyle}>
                <option value="last">Sort: Last Name</option>
                <option value="first">Sort: First Name</option>
              </select>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
                <option value="all">All Status</option>
                {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </>}
            {isMobile&&viewMode!=='year'&&sortedEmployees.length>0&&(
              <div style={{display:'flex',alignItems:'center',gap:'6px',flex:1}}>
                <button onClick={()=>setMobileEmpIdx(i=>Math.max(0,i-1))} style={navBtnStyle} disabled={mobileEmpIdx===0}><Icon name="chevron-left" size={14}/></button>
                <span style={{flex:1,textAlign:'center',fontSize:'13px',color:'var(--text-primary)',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {sortedEmployees[mobileEmpIdx]?`${sortedEmployees[mobileEmpIdx].first_name} ${sortedEmployees[mobileEmpIdx].last_name}`:'All'}
                </span>
                <button onClick={()=>setMobileEmpIdx(i=>Math.min(sortedEmployees.length-1,i+1))} style={navBtnStyle} disabled={mobileEmpIdx===sortedEmployees.length-1}><Icon name="chevron-right" size={14}/></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode}/>
      ) : viewMode==='year' ? (
        <YearView baseDate={baseDate} shifts={filteredShifts} today={today} onMonthClick={(m)=>{ const d=new Date(baseDate); d.setMonth(m); setBaseDate(d); setViewMode('month') }}/>
      ) : viewMode==='month' ? (
        <MonthView baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      ) : viewMode==='biweek' ? (
        <MultiWeekView weeks={2} baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      ) : (
        <MultiWeekView weeks={1} baseDate={baseDate} today={today} shifts={filteredShifts} empName={empName} siteName={siteName} onSelect={setSelected} isMobile={isMobile} mobileEmpId={mobileEmployee?.id}/>
      )}

      {selected&&(
        <ShiftDetail shift={selected} empName={empName} siteName={siteName} canApprove={canApprove} canPublish={canPublish} canCreate={canCreate}
          onClose={()=>setSelected(null)}
          onStatusChange={async(id,status)=>{ await supabase.from('shift').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id); setSelected(null); loadAll() }}
          onDelete={async(id)=>{ await supabase.from('shift').delete().eq('id',id); setSelected(null); loadAll() }}
        />
      )}

      {showCreate&&(
        <CreateShiftModal employees={sortedEmployees} sites={sites} companyId={profile.company_id} createdBy={profile.id}
          onClose={()=>setShowCreate(false)} onSaved={()=>{ setShowCreate(false); loadAll() }}/>
      )}
    </div>
  )
}

const selStyle={padding:'0 10px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'12px',minHeight:'36px',cursor:'pointer'}
const navBtnStyle={background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'36px',minWidth:'36px',width:'36px',height:'36px'}

// ─── Multi-Week View (week + biweek) ──────────────────────
function MultiWeekView({weeks,baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const allDates=useMemo(()=>{
    const result=[]
    for(let w=0;w<weeks;w++){
      getWeekDates(baseDate,w).forEach(d=>result.push(d))
    }
    return result
  },[baseDate,weeks])

  function shiftsForDay(date){
    let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date))
    if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId)
    return s
  }

  const cols=isMobile?3:7
  const visibleDates=isMobile?allDates.slice(0,7*weeks):allDates

  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      {weeks===2&&!isMobile&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px'}}>
          {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:`repeat(${isMobile?7:7},1fr)`,gap:'6px'}}>
        {!isMobile&&DAYS_SHORT.map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>
        ))}
        {visibleDates.map((date,i)=>{
          const isToday=isSameDay(date,today)
          const dayShifts=shiftsForDay(date)
          return (
            <div key={i} style={{background:'var(--bg-card)',border:`1px solid ${isToday?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',minHeight:isMobile?'80px':'140px',overflow:'hidden'}}>
              <div style={{padding:'6px 8px',borderBottom:'1px solid var(--border)',background:isToday?'var(--accent-bg)':'transparent',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  {!isMobile&&<div style={{fontSize:'9px',color:isToday?'var(--accent)':'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{DAYS_SHORT[date.getDay()]}</div>}
                  <div style={{fontSize:isMobile?'13px':'16px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)',lineHeight:1}}>{date.getDate()}</div>
                </div>
                {dayShifts.length>0&&<span style={{fontSize:'9px',background:'var(--border)',color:'var(--text-muted)',borderRadius:'10px',padding:'1px 5px'}}>{dayShifts.length}</span>}
              </div>
              <div style={{padding:'4px',display:'flex',flexDirection:'column',gap:'3px'}}>
                {dayShifts.slice(0,isMobile?2:999).map(shift=>(
                  <ShiftChip key={shift.id} shift={shift} empName={empName} siteName={siteName} onClick={()=>onSelect(shift)} compact={isMobile}/>
                ))}
                {isMobile&&dayShifts.length>2&&<div style={{fontSize:'10px',color:'var(--text-muted)',textAlign:'center'}}>+{dayShifts.length-2}</div>}
                {dayShifts.length===0&&!isMobile&&<div style={{padding:'8px 4px',textAlign:'center',fontSize:'10px',color:'var(--text-muted)'}}>—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────
function MonthView({baseDate,today,shifts,empName,siteName,onSelect,isMobile,mobileEmpId}){
  const dates=useMemo(()=>getMonthDates(baseDate),[baseDate])
  function shiftsForDay(date){
    let s=shifts.filter(s=>isSameDay(new Date(s.start_time),date))
    if(isMobile&&mobileEmpId) s=s.filter(s=>s.employee_id===mobileEmpId)
    return s
  }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px',marginBottom:'6px'}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
        {dates.map(({date,thisMonth},i)=>{
          const isToday=isSameDay(date,today)
          const dayShifts=shiftsForDay(date)
          return (
            <div key={i} style={{background:thisMonth?'var(--bg-card)':'rgba(0,0,0,0.15)',border:`1px solid ${isToday?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-sm)',minHeight:isMobile?'60px':'100px',overflow:'hidden',opacity:thisMonth?1:0.5}}>
              <div style={{padding:'4px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',background:isToday?'var(--accent-bg)':'transparent'}}>
                <span style={{fontSize:isMobile?'11px':'13px',fontFamily:'var(--font-display)',color:isToday?'var(--accent)':'var(--text-primary)'}}>{date.getDate()}</span>
                {dayShifts.length>0&&<span style={{fontSize:'9px',background:isToday?'var(--accent)':'var(--border)',color:isToday?'var(--text-inverse)':'var(--text-muted)',borderRadius:'10px',padding:'0 4px'}}>{dayShifts.length}</span>}
              </div>
              <div style={{padding:'2px 4px',display:'flex',flexDirection:'column',gap:'2px'}}>
                {dayShifts.slice(0,isMobile?1:3).map(shift=>(
                  <ShiftChip key={shift.id} shift={shift} empName={empName} siteName={siteName} onClick={()=>onSelect(shift)} compact={true}/>
                ))}
                {dayShifts.length>(isMobile?1:3)&&<div style={{fontSize:'9px',color:'var(--text-muted)',paddingLeft:'4px'}}>+{dayShifts.length-(isMobile?1:3)} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Year View (12 mini-month calendars) ─────────────────
function YearView({baseDate,shifts,today,onMonthClick}){
  const year=baseDate.getFullYear()
  function shiftsInMonth(month){
    return shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===month })
  }
  function shiftsOnDay(year,month,day){
    return shifts.filter(s=>{ const d=new Date(s.start_time); return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day }).length
  }
  return (
    <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
        {MONTHS.map((monthName,m)=>{
          const dates=getMonthDates(new Date(year,m,1))
          const monthShifts=shiftsInMonth(m)
          const isCurrentMonth=today.getFullYear()===year&&today.getMonth()===m
          return (
            <button key={m} onClick={()=>onMonthClick(m)}
              style={{background:'var(--bg-card)',border:`1px solid ${isCurrentMonth?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'12px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-border)';e.currentTarget.style.background='var(--bg-card-hover)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=isCurrentMonth?'var(--accent-border)':'var(--border-subtle)';e.currentTarget.style.background='var(--bg-card)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,color:isCurrentMonth?'var(--accent)':'var(--text-primary)',letterSpacing:'0.5px'}}>{monthName}</span>
                {monthShifts.length>0&&<span style={{fontSize:'10px',background:'var(--accent-bg)',color:'var(--accent)',borderRadius:'10px',padding:'1px 6px',fontWeight:600}}>{monthShifts.length}</span>}
              </div>
              {/* Mini calendar grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px'}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:'8px',color:'var(--text-muted)',padding:'1px 0'}}>{d[0]}</div>)}
                {dates.map(({date,thisMonth},i)=>{
                  const isToday=isSameDay(date,today)
                  const count=thisMonth?shiftsOnDay(year,m,date.getDate()):0
                  const hasShift=count>0
                  return (
                    <div key={i} style={{textAlign:'center',fontSize:'9px',padding:'2px 1px',borderRadius:'3px',background:isToday?'var(--accent)':hasShift?'var(--accent-bg)':'transparent',color:isToday?'var(--text-inverse)':hasShift?'var(--accent)':thisMonth?'var(--text-secondary)':'var(--text-muted)',fontWeight:hasShift?700:400,opacity:thisMonth?1:0.4}}>
                      {date.getDate()}
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shift Chip ───────────────────────────────────────────
function ShiftChip({shift,empName,siteName,onClick,compact}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  return (
    <button onClick={e=>{e.stopPropagation();onClick()}} className="shift-chip"
      style={{background:ss.bg,border:'1px solid transparent',borderRadius:'4px',padding:compact?'3px 5px':'5px 7px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 120ms ease'}}>
      {!compact&&<div style={{fontSize:'10px',fontWeight:600,color:ss.color,marginBottom:'1px'}}>{fmt12(shift.start_time)}</div>}
      <div style={{fontSize:compact?'9px':'10px',color:'var(--text-primary)',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{empName(shift.employee_id,'last')}</div>
      {!compact&&<div style={{fontSize:'9px',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{siteName(shift.site_id)}</div>}
    </button>
  )
}

// ─── Shift Detail Panel ───────────────────────────────────
function ShiftDetail({shift,empName,siteName,canApprove,canPublish,canCreate,onClose,onStatusChange,onDelete}){
  const ss=STATUS_STYLES[shift.status]||STATUS_STYLES.draft
  const [confirming,setConfirming]=useState(false)
  const dur=shift.start_time&&shift.end_time?`${((new Date(shift.end_time)-new Date(shift.start_time))/3600000).toFixed(1)}h`:'—'
  return (
    <>
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
          <DSec title="Assignment">
            <DR label="Employee" value={empName(shift.employee_id)}/>
            <DR label="Site" value={siteName(shift.site_id)}/>
            <DR label="Role" value={ROLE_LABELS[shift.role]||shift.role||'—'}/>
          </DSec>
          <DSec title="Schedule">
            <DR label="Date" value={new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}/>
            <DR label="Start" value={fmt12(shift.start_time)}/>
            <DR label="End" value={fmt12(shift.end_time)}/>
            <DR label="Duration" value={dur}/>
          </DSec>
          {shift.notes&&<DSec title="Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{shift.notes}</p></DSec>}
          {shift.published_at&&<DSec title="Published"><DR label="At" value={new Date(shift.published_at).toLocaleString()}/></DSec>}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
          {shift.status==='draft'&&canApprove&&(
            <button onClick={()=>onStatusChange(shift.id,'approved')} style={{height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="check" size={15}/>APPROVE SHIFT
            </button>
          )}
          {shift.status==='approved'&&canPublish&&(
            <button onClick={()=>onStatusChange(shift.id,'published')} style={{height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="eye" size={15}/>PUBLISH TO OFFICERS
            </button>
          )}
          {canCreate&&shift.status!=='cancelled'&&(confirming?(
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setConfirming(false)} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>BACK</button>
              <button onClick={()=>onDelete(shift.id)} style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700}}>DELETE</button>
            </div>
          ):(
            <button onClick={()=>setConfirming(true)} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              <Icon name="trash" size={15}/>DELETE SHIFT
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Create Shift Modal ───────────────────────────────────
function CreateShiftModal({employees,sites,companyId,createdBy,onClose,onSaved}){
  const today=new Date().toISOString().split('T')[0]
  const [form,setForm]=useState({employee_id:'',site_id:'',date:today,start_hour:'08',start_min:'00',end_hour:'16',end_min:'00',role:'officer',is_armed:false,notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function save(){
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
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>CREATE SHIFT</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
          {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}
          <div><label style={lbl}>Employee *</label>
            <select value={form.employee_id} onChange={e=>set('employee_id',e.target.value)} style={inp}>
              <option value="">Select employee...</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.last_name}, {e.first_name}{e.position_title?` — ${e.position_title}`:''}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Site *</label>
            <select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}>
              <option value="">Select site...</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={inp}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <div><label style={lbl}>Start Time</label>
              <div style={{display:'flex',gap:'6px'}}>
                <select value={form.start_hour} onChange={e=>set('start_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select>
                <select value={form.start_min} onChange={e=>set('start_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select>
              </div>
            </div>
            <div><label style={lbl}>End Time</label>
              <div style={{display:'flex',gap:'6px'}}>
                <select value={form.end_hour} onChange={e=>set('end_hour',e.target.value)} style={{...inp,flex:1}}>{hours.map(h=><option key={h} value={h}>{h}</option>)}</select>
                <select value={form.end_min} onChange={e=>set('end_min',e.target.value)} style={{...inp,flex:1}}>{mins.map(m=><option key={m} value={m}>{m}</option>)}</select>
              </div>
            </div>
          </div>
          <div><label style={lbl}>Role for this shift</label>
            <select value={form.role} onChange={e=>set('role',e.target.value)} style={inp}>
              {['officer','corporal','sergeant','lieutenant'].map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)'}}>
            <input type="checkbox" id="is_armed" checked={form.is_armed} onChange={e=>set('is_armed',e.target.checked)} style={{width:'18px',height:'18px',cursor:'pointer',accentColor:'var(--accent)'}}/>
            <label htmlFor="is_armed" style={{fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px'}}><Icon name="shield" size={16} color="var(--accent)"/>Armed post</label>
          </div>
          <div><label style={lbl}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3} placeholder="Special instructions, post orders..." style={{...inp,height:'auto',resize:'vertical',padding:'10px 12px',lineHeight:1.5}}/>
          </div>
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
          <button onClick={save} disabled={saving} style={{flex:2,height:'44px',background:saving?'var(--accent-dark)':'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:saving?'not-allowed':'pointer'}}>{saving?'SAVING...':'SAVE SHIFT'}</button>
        </div>
      </div>
    </>
  )
}

function DSec({title,children}){return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>}
function DR({label,value}){if(!value)return null;return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{label}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'65%'}}>{value}</span></div>}
function LoadingSkeleton({viewMode}){return <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:viewMode==='year'?'repeat(auto-fill,minmax(200px,1fr))':'repeat(7,1fr)',gap:'8px'}}>{[...Array(viewMode==='year'?12:7)].map((_,i)=><div key={i} style={{height:viewMode==='year'?'200px':'180px',borderRadius:'8px'}} className="skeleton"/>)}</div>}
