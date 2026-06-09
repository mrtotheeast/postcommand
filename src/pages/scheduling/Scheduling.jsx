import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { emailSchedulePublished } from '../../lib/email'
import { useToast } from '../../components/ui/Toast'

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Published' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Cancelled' },
}
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function isSameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate() }
function fmt12(ts){
  if(!ts) return '—'
  const t = new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})
  return t.replace(' AM','a').replace(' PM','p')
}
function fmtDate(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) }

function getViewDates(baseDate, weeks) {
  const start = new Date(baseDate)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0,0,0,0)
  const dates = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    dates.push(d)
  }
  return dates
}

// ── Main Scheduling Component ─────────────────────────────────────────────────

export default function Scheduling() {
  const { profile } = useAuth()
  const toast = useToast()
  const [viewWeeks, setViewWeeks]       = useState(2)
  const [baseDate, setBaseDate]         = useState(new Date())
  const [shifts, setShifts]             = useState([])
  const [employees, setEmployees]       = useState([])
  const [sites, setSites]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [showCreate, setShowCreate]     = useState(null)
  const [showAutoAssign, setShowAutoAssign] = useState(false)
  const [selected, setSelected]         = useState(null)
  const [mainTab, setMainTab]           = useState('schedule')
  const [creatorEmpId, setCreatorEmpId] = useState(null)
  const [isMobile, setIsMobile]         = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [selPositions, setSelPositions] = useState(new Set())
  const [selSites, setSelSites]         = useState(new Set())

  const canCreate  = atLeast(profile?.role, 'sergeant')
  const canApprove = atLeast(profile?.role, 'lieutenant')
  const canPublish = atLeast(profile?.role, 'lieutenant')
  const isOfficer  = ['officer','corporal'].includes(profile?.role)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const viewDates = useMemo(() => getViewDates(baseDate, viewWeeks), [baseDate, viewWeeks])

  const dateRange = useMemo(() => {
    if (!viewDates.length) return { start: new Date(), end: new Date() }
    const start = new Date(viewDates[0])
    const end   = new Date(viewDates[viewDates.length - 1])
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [viewDates])

  useEffect(() => { loadAll() }, [profile, dateRange])

  async function loadAll() {
    if (!profile?.company_id) return
    setLoading(true)
    const [sR, eR, siR, ceR] = await Promise.all([
      supabase.from('shift').select('*')
        .eq('company_id', profile.company_id)
        .gte('start_time', dateRange.start.toISOString())
        .lte('start_time', dateRange.end.toISOString())
        .order('start_time'),
      supabase.from('employee')
        .select('id,first_name,last_name,position_title,role,profile_photo_url,status,is_armed')
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .or('invitation_status.eq.accepted,has_app_access.eq.true')
        .order('last_name'),
      supabase.from('site').select('id,name,city,state').eq('company_id', profile.company_id),
      supabase.from('employee').select('id').eq('company_id', profile.company_id).eq('user_id', profile.id).maybeSingle(),
    ])
    let sd = sR.data || []
    if (isOfficer) {
      const me = (eR.data || []).find(e => e.id === profile.employee_id)
      if (me) sd = sd.filter(s => s.employee_id === me.id)
    }
    setCreatorEmpId(ceR.data?.id || null)
    setShifts(sd)
    setEmployees(eR.data || [])
    setSites(siR.data || [])
    setLoading(false)
  }

  function navigate(dir) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + dir * viewWeeks * 7)
    setBaseDate(d)
  }

  const periodLabel = useMemo(() => {
    if (!viewDates.length) return ''
    const first = viewDates[0], last = viewDates[viewDates.length - 1]
    return `${fmtDate(first)} – ${fmtDate(last)}, ${last.getFullYear()}`
  }, [viewDates])

  const positionTitles = useMemo(
    () => [...new Set(employees.map(e => e.position_title).filter(Boolean))].sort(),
    [employees]
  )

  const activeSiteIds = useMemo(() => new Set(shifts.map(s => s.site_id).filter(Boolean)), [shifts])

  const filteredEmployees = useMemo(() => {
    let emps = employees
    if (selPositions.size > 0) emps = emps.filter(e => selPositions.has(e.position_title || ''))
    if (selSites.size > 0) {
      const empIdsWithSite = new Set(shifts.filter(s => selSites.has(s.site_id)).map(s => s.employee_id))
      emps = emps.filter(e => empIdsWithSite.has(e.id))
    }
    return emps
  }, [employees, shifts, selPositions, selSites])

  function empName(id, mode = 'full') {
    const e = employees.find(e => e.id === id)
    if (!e) return '—'
    if (mode === 'first') return e.first_name
    if (mode === 'last') return e.last_name
    return e.first_name + ' ' + e.last_name
  }
  function siteName(id) { const s = sites.find(s => s.id === id); return s ? s.name : '—' }

  const today = new Date()

  const btnBase = { border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', overflow:'hidden'}}>
      {/* ── Top Bar ── */}
      <div style={{padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', flexShrink:0, display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>
        {/* Sidebar toggle */}
        {!isMobile && mainTab === 'schedule' && (
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{...btnBase, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', minHeight:'34px', minWidth:'34px', flexShrink:0}}>
            <Icon name="sidebar" size={15}/>
          </button>
        )}

        {/* Title */}
        <h2 style={{fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, margin:0, flexShrink:0}}>SCHEDULING</h2>

        {/* Date navigation */}
        <div style={{display:'flex', alignItems:'center', gap:'3px'}}>
          <button onClick={() => navigate(-1)} style={{...btnBase, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', minHeight:'34px', minWidth:'34px'}}><Icon name="chevron-left" size={14}/></button>
          <button onClick={() => setBaseDate(new Date())} style={{...btnBase, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', padding:'0 10px', minHeight:'34px', fontSize:'10px', letterSpacing:'1px'}}>TODAY</button>
          <button onClick={() => navigate(1)}  style={{...btnBase, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', minHeight:'34px', minWidth:'34px'}}><Icon name="chevron-right" size={14}/></button>
        </div>
        <span style={{fontSize:'12px', color:'var(--text-secondary)', whiteSpace:'nowrap', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', flex:1}}>{periodLabel}</span>

        {/* Main tab selector */}
        <div style={{display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px', flexShrink:0}}>
          {[['schedule','Schedule'],['swaps','Swaps'],['availability','Avail.'],['bids','Bids']].map(([v,l]) => (
            <button key={v} onClick={() => setMainTab(v)}
              style={{...btnBase, padding:'0 10px', minHeight:'30px', background:mainTab===v?'var(--accent-bg)':'transparent', color:mainTab===v?'var(--accent)':'var(--text-muted)', fontSize:'10px', fontWeight:mainTab===v?700:400}}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* View weeks — schedule tab only */}
        {mainTab === 'schedule' && (
          <div style={{display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px', flexShrink:0}}>
            {[[1,'1 WK'],[2,'2 WK'],[4,'4 WK']].map(([w,l]) => (
              <button key={w} onClick={() => setViewWeeks(w)}
                style={{...btnBase, padding:'0 10px', minHeight:'30px', background:viewWeeks===w?'var(--accent-bg)':'transparent', color:viewWeeks===w?'var(--accent)':'var(--text-muted)', fontSize:'10px', fontWeight:viewWeeks===w?700:400}}>
                {l}
              </button>
            ))}
          </div>
        )}

        {canCreate && mainTab === 'schedule' && (
          <button onClick={() => setShowAutoAssign(true)}
            style={{...btnBase, background:'var(--bg-card)', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', padding:'0 12px', minHeight:'34px', fontSize:'11px', fontWeight:600, gap:'6px', flexShrink:0}}>
            <Icon name="cpu" size={13}/>AUTO-ASSIGN
          </button>
        )}
        {canCreate && mainTab === 'schedule' && (
          <button onClick={() => setShowCreate({})}
            style={{...btnBase, background:'var(--accent)', color:'var(--text-inverse)', padding:'0 14px', minHeight:'34px', fontSize:'11px', fontWeight:700, gap:'6px', flexShrink:0}}>
            <Icon name="plus" size={13}/>ADD SHIFT
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        {/* Non-schedule tabs */}
        {mainTab === 'swaps'        && <SwapsPanel companyId={profile.company_id} profile={profile} employees={employees} shifts={shifts} canApprove={canApprove}/>}
        {mainTab === 'availability' && <AvailabilityPanel companyId={profile.company_id} profile={profile} employees={employees} canEdit={canCreate}/>}
        {mainTab === 'bids'         && <ShiftBidsPanel companyId={profile.company_id} profile={profile} employees={employees} sites={sites} canPost={canCreate}/>}

        {/* Schedule tab */}
        {mainTab === 'schedule' && (
          <>
            {/* Filter sidebar */}
            {!isMobile && sidebarOpen && (
              <FilterSidebar
                positions={positionTitles}
                sites={sites}
                activeSiteIds={activeSiteIds}
                selPositions={selPositions}
                selSites={selSites}
                onPositionsChange={setSelPositions}
                onSitesChange={setSelSites}
              />
            )}

            {/* Staffing grid */}
            {loading ? (
              <div style={{flex:1, padding:'16px 20px', display:'flex', flexDirection:'column', gap:'8px'}}>
                {[...Array(6)].map((_,i) => <div key={i} style={{height:'64px', borderRadius:'8px'}} className="skeleton"/>)}
              </div>
            ) : (
              <StaffingGrid
                dates={viewDates}
                employees={filteredEmployees}
                allEmployees={employees}
                shifts={shifts}
                sites={sites}
                today={today}
                canCreate={canCreate}
                onSelectShift={setSelected}
                onCellClick={(emp, date) => setShowCreate({ prefillEmp: emp.id, prefillDate: date })}
                siteName={siteName}
                viewWeeks={viewWeeks}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {selected && (
        <ShiftDetail
          shift={selected}
          empName={empName}
          siteName={siteName}
          canApprove={canApprove}
          canPublish={canPublish}
          canCreate={canCreate}
          onClose={() => setSelected(null)}
          onStatusChange={async (id, status) => {
            await supabase.from('shift').update({status,...(status==='published'?{published_at:new Date().toISOString()}:{})}).eq('id',id)
            if (status === 'published') {
              toast('Schedule published')
              const shift = shifts.find(s => s.id === id)
              if (shift) {
                const {data:emp} = await supabase.from('employee').select('first_name,email').eq('id',shift.employee_id).single()
                if (emp?.email) emailSchedulePublished({ to:emp.email, firstName:emp.first_name, shiftCount:1, period:new Date(shift.start_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) })
              }
            }
            setSelected(null); loadAll()
          }}
          onDelete={async (id) => {
            await supabase.from('shift').delete().eq('id',id)
            toast('Shift deleted','info')
            setSelected(null); loadAll()
          }}
        />
      )}
      {showCreate && (
        <CreateShiftModal
          employees={employees}
          sites={sites}
          companyId={profile.company_id}
          createdBy={creatorEmpId}
          prefillEmpId={showCreate?.prefillEmp}
          prefillDate={showCreate?.prefillDate}
          onClose={() => setShowCreate(null)}
          onSaved={() => { setShowCreate(null); loadAll() }}
        />
      )}
      {showAutoAssign && (
        <AutoAssignModal
          employees={employees}
          sites={sites}
          shifts={shifts}
          companyId={profile.company_id}
          createdBy={creatorEmpId}
          onClose={() => setShowAutoAssign(false)}
          onSaved={() => { setShowAutoAssign(false); loadAll() }}
        />
      )}
    </div>
  )
}

// ── Filter Sidebar ────────────────────────────────────────────────────────────

function FilterSidebar({ positions, sites, activeSiteIds, selPositions, selSites, onPositionsChange, onSitesChange }) {
  function togglePos(p) {
    if (selPositions.size === 0) {
      onPositionsChange(new Set(positions.filter(x => x !== p)))
    } else {
      const n = new Set(selPositions); n.has(p) ? n.delete(p) : n.add(p)
      onPositionsChange(n.size === positions.length ? new Set() : n)
    }
  }
  function toggleSite(id) {
    if (selSites.size === 0) {
      onSitesChange(new Set(sites.filter(x => x.id !== id).map(x => x.id)))
    } else {
      const n = new Set(selSites); n.has(id) ? n.delete(id) : n.add(id)
      onSitesChange(n.size === sites.length ? new Set() : n)
    }
  }
  const isFiltered = selPositions.size > 0 || selSites.size > 0
  const sectHd = { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'8px', paddingBottom:'6px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }
  const miniBtn = { fontSize:'10px', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', padding:0, letterSpacing:'0.5px' }
  const rowStyle = { display:'flex', alignItems:'center', gap:'8px', padding:'3px 0', cursor:'pointer', userSelect:'none' }

  return (
    <div style={{width:'210px', flexShrink:0, borderRight:'1px solid var(--border)', background:'var(--bg-card)', overflowY:'auto', padding:'14px 12px', display:'flex', flexDirection:'column', gap:'20px'}}>
      {positions.length > 0 && (
        <div>
          <div style={sectHd}>
            <span>Positions</span>
            <div style={{display:'flex', gap:'8px'}}>
              <button style={{...miniBtn, color:'var(--accent)'}} onClick={() => onPositionsChange(new Set())}>ALL</button>
              <button style={{...miniBtn, color:'var(--text-muted)'}} onClick={() => onPositionsChange(new Set(positions))}>NONE</button>
            </div>
          </div>
          {positions.map(p => {
            const checked = selPositions.size === 0 || selPositions.has(p)
            return (
              <label key={p} style={rowStyle}>
                <input type="checkbox" checked={checked} onChange={() => togglePos(p)} style={{width:'14px', height:'14px', accentColor:'var(--accent)', cursor:'pointer', flexShrink:0}}/>
                <span style={{fontSize:'12px', color: checked ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight:1.4, flex:1}}>{p}</span>
              </label>
            )
          })}
        </div>
      )}

      {sites.length > 0 && (
        <div>
          <div style={sectHd}>
            <span>Job Sites</span>
            <div style={{display:'flex', gap:'8px'}}>
              <button style={{...miniBtn, color:'var(--accent)'}} onClick={() => onSitesChange(new Set())}>ALL</button>
              <button style={{...miniBtn, color:'var(--text-muted)'}} onClick={() => onSitesChange(new Set(sites.map(s=>s.id)))}>NONE</button>
            </div>
          </div>
          {sites.map(s => {
            const checked = selSites.size === 0 || selSites.has(s.id)
            return (
              <label key={s.id} style={rowStyle}>
                <input type="checkbox" checked={checked} onChange={() => toggleSite(s.id)} style={{width:'14px', height:'14px', accentColor:'var(--accent)', cursor:'pointer', flexShrink:0}}/>
                <span style={{fontSize:'12px', color: checked ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight:1.4, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.name}</span>
                {activeSiteIds.has(s.id) && <span style={{width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', flexShrink:0}}/>}
              </label>
            )
          })}
        </div>
      )}

      {isFiltered && (
        <button onClick={() => { onPositionsChange(new Set()); onSitesChange(new Set()) }}
          style={{padding:'8px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-muted)', fontSize:'11px', fontFamily:'var(--font-condensed)', cursor:'pointer', letterSpacing:'0.5px', marginTop:'auto'}}>
          CLEAR FILTERS
        </button>
      )}
    </div>
  )
}

// ── Staffing Grid ─────────────────────────────────────────────────────────────

const EMP_COL = 224

function StaffingGrid({ dates, employees, allEmployees, shifts, sites, today, canCreate, onSelectShift, onCellClick, siteName, viewWeeks }) {
  const dayColMin = viewWeeks === 1 ? 140 : viewWeeks === 2 ? 110 : 84

  function getEmpDayShifts(empId, date) {
    return shifts.filter(s => {
      if (s.employee_id !== empId) return false
      return isSameDay(new Date(s.start_time), date)
    })
  }

  function getEmpPeriodHours(empId) {
    return shifts.filter(s => s.employee_id === empId && s.status !== 'cancelled').reduce((acc, s) => {
      if (!s.start_time || !s.end_time) return acc
      return acc + (new Date(s.end_time) - new Date(s.start_time)) / 3600000
    }, 0)
  }

  function getDayAssigned(date) {
    return new Set(shifts.filter(s => s.status !== 'cancelled' && isSameDay(new Date(s.start_time), date)).map(s => s.employee_id)).size
  }

  function getDayHours(date) {
    return shifts.filter(s => s.status !== 'cancelled' && isSameDay(new Date(s.start_time), date)).reduce((acc, s) => {
      if (!s.start_time || !s.end_time) return acc
      return acc + (new Date(s.end_time) - new Date(s.start_time)) / 3600000
    }, 0)
  }

  const totalPeriodHours = shifts.filter(s => s.status !== 'cancelled').reduce((acc, s) => {
    if (!s.start_time || !s.end_time) return acc
    return acc + (new Date(s.end_time) - new Date(s.start_time)) / 3600000
  }, 0)

  const ini = (emp) => `${emp.first_name?.[0]||''}${emp.last_name?.[0]||''}`.toUpperCase()

  if (employees.length === 0) {
    return (
      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'12px', color:'var(--text-muted)'}}>
        <Icon name="users" size={36} color="var(--border-subtle)"/>
        <div style={{fontSize:'14px'}}>No employees match the current filters</div>
      </div>
    )
  }

  // Shared cell style helpers
  const stickyEmpCell = {
    position:'sticky', left:0, zIndex:1,
    background:'var(--bg-card)',
    borderRight:'1px solid var(--border)',
    borderBottom:'1px solid var(--border)',
    padding:'8px 10px',
    width:`${EMP_COL}px`, minWidth:`${EMP_COL}px`, maxWidth:`${EMP_COL}px`,
    verticalAlign:'middle',
    boxShadow:'2px 0 6px rgba(0,0,0,0.15)',
  }

  return (
    <div style={{flex:1, overflow:'auto', position:'relative'}}>
      <table style={{borderCollapse:'collapse', minWidth:`${EMP_COL + dates.length * dayColMin}px`, width:'100%'}}>
        <colgroup>
          <col style={{width:`${EMP_COL}px`}}/>
          {dates.map((_,i) => <col key={i} style={{width:`${dayColMin}px`, minWidth:`${dayColMin}px`}}/>)}
        </colgroup>

        {/* ── Header ── */}
        <thead>
          <tr>
            <th style={{position:'sticky', left:0, top:0, zIndex:4, background:'var(--bg-surface)', borderRight:'1px solid var(--border)', borderBottom:'2px solid var(--border)', padding:'8px 10px', textAlign:'left', width:`${EMP_COL}px`, boxShadow:'2px 0 6px rgba(0,0,0,0.15)'}}>
              <span style={{fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1.5px', textTransform:'uppercase'}}>OFFICER · {employees.length}</span>
            </th>
            {dates.map((d, i) => {
              const isToday = isSameDay(d, today)
              return (
                <th key={i} style={{position:'sticky', top:0, zIndex:2, background: isToday ? 'var(--accent-bg)' : 'var(--bg-surface)', padding:'7px 6px', textAlign:'center', borderLeft:'1px solid var(--border)', borderBottom:'2px solid var(--border)', minWidth:`${dayColMin}px`, whiteSpace:'nowrap'}}>
                  <div style={{fontSize:'10px', color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', textTransform:'uppercase', lineHeight:1}}>{DAYS_SHORT[d.getDay()]}</div>
                  <div style={{fontSize:'17px', fontFamily:'var(--font-display)', color: isToday ? 'var(--accent)' : 'var(--text-primary)', lineHeight:1.2, fontWeight:700}}>{d.getDate()}</div>
                </th>
              )
            })}
          </tr>
        </thead>

        {/* ── Employee Rows ── */}
        <tbody>
          {employees.map(emp => {
            const hours = getEmpPeriodHours(emp.id)
            return (
              <tr key={emp.id}>
                {/* Employee name cell */}
                <td style={stickyEmpCell}>
                  <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <div style={{width:'34px', height:'34px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, color:'var(--accent)', flexShrink:0, overflow:'hidden'}}>
                      {emp.profile_photo_url
                        ? <img src={emp.profile_photo_url} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                        : ini(emp)
                      }
                    </div>
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{fontSize:'12px', fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{emp.first_name} {emp.last_name}</div>
                      {emp.position_title && <div style={{fontSize:'10px', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'1px'}}>{emp.position_title}</div>}
                    </div>
                    {hours > 0 && (
                      <div style={{fontSize:'11px', color:'var(--accent)', fontFamily:'var(--font-display)', fontWeight:700, flexShrink:0, letterSpacing:'0.5px'}}>{Number.isInteger(hours) ? hours : hours.toFixed(1)}h</div>
                    )}
                  </div>
                </td>

                {/* Day cells */}
                {dates.map((d, di) => {
                  const dayShifts = getEmpDayShifts(emp.id, d)
                  const isToday = isSameDay(d, today)
                  const canClick = canCreate && dayShifts.length === 0
                  return (
                    <td key={di}
                      style={{borderLeft:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'4px', verticalAlign:'top', background: isToday ? 'rgba(201,162,39,0.025)' : 'var(--bg-card)', minWidth:`${dayColMin}px`, cursor: canClick ? 'pointer' : 'default', transition:'background 80ms'}}
                      onClick={() => canClick && onCellClick(emp, d)}
                      onMouseEnter={e => { if (canClick) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isToday ? 'rgba(201,162,39,0.025)' : 'var(--bg-card)' }}
                    >
                      {dayShifts.length === 0 && canCreate && (
                        <div style={{minHeight:'48px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontSize:'20px', opacity:0.15, pointerEvents:'none'}}>+</div>
                      )}
                      {dayShifts.map(s => (
                        <ShiftBlock key={s.id} shift={s} siteName={siteName} onClick={e => { e.stopPropagation(); onSelectShift(s) }}/>
                      ))}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>

        {/* ── Totals Row ── */}
        <tfoot>
          <tr>
            <td style={{...stickyEmpCell, background:'var(--bg-surface)', borderTop:'2px solid var(--border)', borderBottom:'none', zIndex:1}}>
              <div style={{fontSize:'10px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase'}}>ASSIGNED</div>
              <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'3px'}}>{totalPeriodHours.toFixed(1)} total hours</div>
            </td>
            {dates.map((d, i) => {
              const assigned = getDayAssigned(d)
              const hrs = getDayHours(d)
              return (
                <td key={i} style={{borderLeft:'1px solid var(--border)', borderTop:'2px solid var(--border)', background:'var(--bg-surface)', padding:'8px 6px', textAlign:'center', minWidth:`${dayColMin}px`, verticalAlign:'middle'}}>
                  <div style={{fontSize:'18px', fontFamily:'var(--font-display)', color: assigned > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight:700, lineHeight:1}}>{assigned}</div>
                  {hrs > 0 && <div style={{fontSize:'9px', color:'var(--text-muted)', marginTop:'2px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px'}}>{hrs.toFixed(0)}h</div>}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Shift Block ───────────────────────────────────────────────────────────────

function ShiftBlock({ shift, siteName, onClick }) {
  const ss = STATUS_STYLES[shift.status] || STATUS_STYLES.draft
  const site = (siteName(shift.site_id) || '').slice(0, 5).toUpperCase()
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--bg-surface)' : 'var(--bg-card)',
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--accent-border)'}`,
        borderLeft: '3px solid var(--accent)',
        borderRadius: '4px',
        padding: '3px 5px',
        marginBottom: '3px',
        cursor: 'pointer',
        transition: 'all 80ms ease',
        minHeight: '42px',
      }}
    >
      <div style={{fontSize:'11px', color:'var(--accent)', fontWeight:700, fontFamily:'var(--font-condensed)', whiteSpace:'nowrap', letterSpacing:'0.3px'}}>{fmt12(shift.start_time)}</div>
      <div style={{fontSize:'10px', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:'1px'}}>{site || '—'}</div>
      {shift.status !== 'draft' && (
        <div style={{fontSize:'8px', color:ss.color, fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px', marginTop:'2px'}}>{ss.label.toUpperCase()}</div>
      )}
    </div>
  )
}

// ── Shift Detail ──────────────────────────────────────────────────────────────

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

// ── Create Shift Modal ────────────────────────────────────────────────────────

function CreateShiftModal({employees,sites,companyId,createdBy,prefillEmpId,prefillDate,onClose,onSaved}){
  const toast = useToast()
  const today=new Date().toISOString().split('T')[0]
  const prefillDateStr = prefillDate ? prefillDate.toISOString().split('T')[0] : today
  const [form,setForm]=useState({employee_id:prefillEmpId||'',site_id:'',date:prefillDateStr,sh:'08',sm:'00',eh:'16',em:'00',role:'officer',is_armed:false,notes:''})
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState(null)
  const [conflict,setConflict]=useState(null)
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  useEffect(()=>{
    if(!form.employee_id||!form.date){setConflict(null);return}
    const start=new Date(form.date+'T'+form.sh+':'+form.sm+':00')
    const end=new Date(form.date+'T'+form.eh+':'+form.em+':00')
    if(end<=start){setConflict(null);return}
    supabase.from('shift').select('id,start_time,end_time,site_id').eq('company_id',companyId).eq('employee_id',form.employee_id).neq('status','cancelled').gte('start_time',new Date(form.date+'T00:00:00').toISOString()).lte('start_time',new Date(form.date+'T23:59:59').toISOString())
      .then(({data})=>{
        const ov=(data||[]).find(s=>{ const sS=new Date(s.start_time),sE=new Date(s.end_time); return start<sE&&end>sS })
        if(ov){ const site=sites.find(s=>s.id===ov.site_id); setConflict({siteName:site?.name||'another site',startTime:new Date(ov.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),endTime:new Date(ov.end_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}) }
        else setConflict(null)
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
    toast('Shift saved'); onSaved()
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
        {conflict&&<div style={{background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-warning)',display:'flex',alignItems:'flex-start',gap:'8px'}}><Icon name="alert-triangle" size={15} color="var(--color-warning)"/><div><strong>Scheduling conflict:</strong> This officer already has a shift at {conflict.siteName} from {conflict.startTime} – {conflict.endTime} on this date.</div></div>}
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
function SR({l,v}){if(!v)return null;return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{l}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'65%'}}>{v}</span></div>}

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

  const empMap   = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  const shiftMap = Object.fromEntries(shifts.map(s=>[s.id,s]))
  const visible  = swaps.filter(s => filter==='all' || s.status===filter)

  const pill  = (st) => { const m=SWAP_STATUS[st]||SWAP_STATUS.pending; return { display:'inline-flex',padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:700,fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',...m } }
  const btnS  = (v='accent') => ({ display:'inline-flex',alignItems:'center',gap:'6px',background:v==='accent'?'var(--accent)':v==='ok'?'var(--color-success-bg)':'var(--color-danger-bg)',color:v==='accent'?'var(--text-inverse)':v==='ok'?'var(--color-success)':'var(--color-danger)',border:v==='accent'?'none':v==='ok'?'1px solid rgba(58,170,106,0.3)':'1px solid rgba(192,57,43,0.3)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer' })

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
            const sh=shiftMap[sw.requester_shift_id], shT=shiftMap[sw.target_shift_id], st=SWAP_STATUS[sw.status]||SWAP_STATUS.pending
            return (
              <div key={sw.id} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',borderBottom:i<visible.length-1?'1px solid var(--border)':'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>{empMap[sw.requester_employee_id]||'—'} → {empMap[sw.target_employee_id]||'Any'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{sh?`${new Date(sh.start_time).toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${new Date(sh.start_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`:'My shift'}{shT?` ↔ ${new Date(shT.start_time).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:''}{sw.notes?` · "${sw.notes}"`:''}
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

function AvailabilityPanel({ companyId, profile, employees, canEdit }) {
  const [avail, setAvail]       = useState([])
  const [employee, setEmployee] = useState(null)
  const [viewEmpId, setViewEmpId] = useState(null)
  const [saving, setSaving]     = useState(false)
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

// ── Auto-Assign Modal ─────────────────────────────────────────────────────────

function AutoAssignModal({ employees, sites, shifts, companyId, createdBy, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ site_id:'', date:today, sh:'08', sm:'00', eh:'16', em:'00', role:'officer', count:1 })
  const [preview, setPreview] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
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
    const alreadyScheduled = new Set(
      shifts.filter(s => {
        const sDate = s.start_time?.slice(0,10)
        if (sDate !== form.date) return false
        const sStart=new Date(s.start_time), sEnd=new Date(s.end_time)
        return start<sEnd && end>sStart
      }).map(s=>s.employee_id)
    )
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
                {preview.candidates.length} officer{preview.candidates.length!==1?'s':''} available
              </div>
              {preview.candidates.length === 0 ? (
                <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px',background:'var(--bg-card)',borderRadius:'var(--radius-md)'}}>No available officers match your criteria.</div>
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

// ── Shift Bids Panel ──────────────────────────────────────────────────────────

function ShiftBidsPanel({ companyId, profile, employees, sites, canPost }) {
  const [bids, setBids]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ site_id:'', date:'', sh:'08', sm:'00', eh:'16', em:'00', role:'officer', bonus:'' })
  const [saving, setSaving]     = useState(false)
  const [myEmpId, setMyEmpId]   = useState(null)
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
    await supabase.from('shift_bid_application').insert({ shift_bid_id:bidId, employee_id:myEmpId, company_id:companyId, status:'pending' }); load()
  }
  async function awardBid(bidId, empId) {
    await supabase.from('shift_bid').update({ status:'awarded' }).eq('id',bidId)
    await supabase.from('shift_bid_application').update({ status:'awarded' }).eq('shift_bid_id',bidId).eq('employee_id',empId); load()
  }
  const hrs=['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23']
  const mins=['00','15','30','45']
  const inp={width:'100%',padding:'9px 11px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'12px',outline:'none',height:'40px'}
  const lbl={fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'block',marginBottom:'5px'}
  const bidApps  = (bidId) => applications.filter(a=>a.shift_bid_id===bidId)
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
          const apps = bidApps(bid.id), applied = hasApplied(bid.id)
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
