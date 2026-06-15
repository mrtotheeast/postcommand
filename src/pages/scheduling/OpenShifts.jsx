import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Icon from '../../components/ui/Icon'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(ts) {
  if (!ts) return '—'
  const t = new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return t.replace(' AM', 'a').replace(' PM', 'p')
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtDur(start, end) {
  const h = (new Date(end) - new Date(start)) / 3600000
  return (h % 1 === 0 ? h : h.toFixed(1)) + 'h'
}
function fmtH(h) { return (h % 1 === 0 ? h : h.toFixed(1)) + 'h' }

// Copied from Scheduling.jsx — same signature and logic
async function checkOT(employeeId, companyId, shiftStart, shiftEnd, weekStartDay, otThreshold) {
  const shiftDate = new Date(shiftStart)
  const daysBack = (shiftDate.getDay() - weekStartDay + 7) % 7
  const weekStart = new Date(shiftDate)
  weekStart.setDate(shiftDate.getDate() - daysBack)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const { data } = await supabase
    .from('shift')
    .select('start_time,end_time')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .neq('status', 'cancelled')
    .gte('start_time', weekStart.toISOString())
    .lt('start_time', weekEnd.toISOString())

  const currentHours = (data || []).reduce((acc, s) => {
    if (!s.start_time || !s.end_time) return acc
    return acc + (new Date(s.end_time) - new Date(s.start_time)) / 3600000
  }, 0)
  const newShiftHours = (new Date(shiftEnd) - new Date(shiftStart)) / 3600000
  const projectedHours = currentHours + newShiftHours
  const wouldExceed = projectedHours > otThreshold
  const otHours = Math.max(0, projectedHours - otThreshold)
  return { wouldExceed, currentHours, newShiftHours, projectedHours, otHours }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', textAlign:'center' }}>
      <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px' }}>
        <Icon name={icon} size={24} color="var(--text-muted)"/>
      </div>
      <div style={{ fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, color:'var(--text-primary)', letterSpacing:'0.5px', marginBottom:'6px' }}>{title}</div>
      <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', flexShrink:0, marginRight:'12px', paddingTop:'1px' }}>{label}</span>
      <span style={{ fontSize:'13px', color:'var(--text-primary)', textAlign:'right', lineHeight:1.4 }}>{value}</span>
    </div>
  )
}

const STATUS_STYLE = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa' },
  published: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a' },
  cancelled: { bg:'rgba(224,85,85,0.15)',   color:'#e05555' },
}
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft
  return (
    <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'8px', background:s.bg, color:s.color, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
      {(status || 'draft').toUpperCase()}
    </span>
  )
}

function OpenShiftCard({ os, onSelect }) {
  const shift = os.shift
  return (
    <button
      onClick={() => onSelect(os)}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
      style={{ width:'100%', textAlign:'left', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px', cursor:'pointer', display:'flex', flexDirection:'column', gap:'4px', transition:'border-color 150ms ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
        <div style={{ fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, color:'var(--text-primary)', lineHeight:1.2 }}>
          {os.site?.name || '—'}
        </div>
        {shift && (
          <div style={{ fontSize:'12px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700, background:'var(--accent-bg)', padding:'2px 8px', borderRadius:'8px', border:'1px solid var(--accent-border)', flexShrink:0 }}>
            {fmtDur(shift.start_time, shift.end_time)}
          </div>
        )}
      </div>
      {shift && (
        <>
          <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>{fmtDate(shift.start_time)}</div>
          <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</div>
        </>
      )}
      {shift?.notes && (
        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px', fontStyle:'italic' }}>
          {shift.notes}
        </div>
      )}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OpenShifts() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab]               = useState('schedule')
  const [loading, setLoading]       = useState(true)
  const [empId, setEmpId]           = useState(null)
  const [myShifts, setMyShifts]     = useState([])
  const [openShifts, setOpenShifts] = useState([])
  const [droppedShifts, setDroppedShifts] = useState([])
  const [sites, setSites]           = useState([])
  const [otSettings, setOtSettings] = useState(null)
  const [selected, setSelected]     = useState(null)
  const [claiming, setClaiming]     = useState(false)
  const [otWarning, setOtWarning]   = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    if (!profile?.company_id) return
    setLoading(true)

    // Find employee record for this user
    const { data: empRow } = await supabase
      .from('employee')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('user_id', profile.id)
      .maybeSingle()

    const myEmpId = empRow?.id || null
    setEmpId(myEmpId)

    const now = new Date().toISOString()

    const [sitesR, openR, csR, myR] = await Promise.all([
      supabase.from('site').select('id,name,city,state').eq('company_id', profile.company_id),
      supabase.from('open_shift').select('*').eq('company_id', profile.company_id).eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('ot_weekly_hours,ot_week_start').eq('company_id', profile.company_id).maybeSingle(),
      myEmpId
        ? supabase.from('shift').select('*')
            .eq('employee_id', myEmpId)
            .eq('company_id', profile.company_id)
            .neq('status', 'cancelled')
            .gte('start_time', now)
            .order('start_time')
            .limit(30)
        : Promise.resolve({ data: [] }),
    ])

    const siteList = sitesR.data || []
    const allOpen  = openR.data  || []

    // Fetch shift details for all open_shift records in one query
    const shiftIds = [...new Set(allOpen.map(os => os.shift_id).filter(Boolean))]
    let shiftMap = {}
    if (shiftIds.length > 0) {
      const { data: sd } = await supabase.from('shift').select('*').in('id', shiftIds)
      ;(sd || []).forEach(s => { shiftMap[s.id] = s })
    }

    // Merge open_shift records with their shift + site data
    const merged = allOpen
      .map(os => ({
        ...os,
        shift: os.shift_id ? shiftMap[os.shift_id] || null : null,
        site:  siteList.find(s => s.id === os.site_id) || null,
      }))
      .filter(os => os.shift) // only show if we have the underlying shift details

    setSites(siteList)
    setOpenShifts(merged.filter(os => os.source !== 'dropped'))
    setDroppedShifts(merged.filter(os => os.source === 'dropped'))
    setOtSettings(csR.data || null)
    setMyShifts(myR.data || [])
    setLoading(false)
  }

  function siteName(id) {
    const s = sites.find(s => s.id === id)
    return s ? s.name : '—'
  }

  function closeSheet() { setSelected(null); setOtWarning(null) }

  async function handleClaim(override = false) {
    if (!selected?.shift || !empId) return
    setClaiming(true)
    if (!override) setOtWarning(null)

    const shift = selected.shift
    const weekStartDay = otSettings?.ot_week_start  ?? 0
    const otThreshold  = otSettings?.ot_weekly_hours ?? 40

    const otResult = await checkOT(empId, profile.company_id, shift.start_time, shift.end_time, weekStartDay, otThreshold)

    if (otResult.wouldExceed && !override) {
      setOtWarning(otResult)
      setClaiming(false)
      return
    }

    const { error } = await supabase
      .from('open_shift')
      .update({
        status: 'claimed',
        claimed_by_employee_id: empId,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', selected.id)
      .eq('status', 'open') // optimistic lock — bail if already claimed

    setClaiming(false)

    if (error) {
      toast('Failed to claim — shift may have already been taken', 'error')
      return
    }

    toast('Shift claimed!')
    closeSheet()
    load()
  }

  const TABS = [
    { id:'schedule',  label:'MY SCHEDULE' },
    { id:'open',      label:'OPEN SHIFTS' },
    { id:'available', label:'AVAILABLE'   },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-base)' }}>

      {/* ── Tab bar ── */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', flexShrink:0, padding:'0 16px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:'14px 6px', background:'transparent', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--accent)':'transparent'}`, color:tab===t.id?'var(--accent)':'var(--text-muted)', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:tab===t.id?700:400, letterSpacing:'1px', cursor:'pointer', transition:'all 150ms ease', marginBottom:'-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {[1,2,3].map(i => <div key={i} style={{ height:'88px', borderRadius:'var(--radius-md)' }} className="skeleton"/>)}
          </div>
        ) : (
          <>
            {/* MY SCHEDULE */}
            {tab === 'schedule' && (
              myShifts.length === 0
                ? <EmptyState icon="calendar" title="No upcoming shifts" sub="Your schedule is clear for now." />
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {myShifts.map(s => (
                      <div key={s.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                          <div style={{ fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, color:'var(--text-primary)' }}>
                            {siteName(s.site_id)}
                          </div>
                          <StatusBadge status={s.status}/>
                        </div>
                        <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>{fmtDate(s.start_time)}</div>
                        <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'2px' }}>
                          {fmt12(s.start_time)} – {fmt12(s.end_time)} · {fmtDur(s.start_time, s.end_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
            )}

            {/* OPEN SHIFTS */}
            {tab === 'open' && (
              openShifts.length === 0
                ? <EmptyState icon="flag" title="No open shifts" sub="Check back later for shifts available to claim." />
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {openShifts.map(os => <OpenShiftCard key={os.id} os={os} onSelect={setSelected}/>)}
                  </div>
                )
            )}

            {/* AVAILABLE — dropped shifts */}
            {tab === 'available' && (
              droppedShifts.length === 0
                ? <EmptyState icon="refresh-cw" title="No dropped shifts" sub="No officers have dropped a shift yet." />
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {droppedShifts.map(os => <OpenShiftCard key={os.id} os={os} onSelect={setSelected}/>)}
                  </div>
                )
            )}
          </>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      {selected && (
        <>
          <div onClick={closeSheet} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, backdropFilter:'blur(2px)' }}/>
          <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--bg-surface)', borderRadius:'16px 16px 0 0', zIndex:101, maxHeight:'82vh', display:'flex', flexDirection:'column', boxShadow:'0 -4px 24px rgba(0,0,0,0.3)' }}>
            {/* drag handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
              <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-subtle)' }}/>
            </div>
            {/* header */}
            <div style={{ padding:'6px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'2px', color:'var(--text-primary)' }}>SHIFT DETAILS</div>
              <button onClick={closeSheet} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'44px', minWidth:'44px' }}>
                <Icon name="x" size={18}/>
              </button>
            </div>
            {/* body */}
            <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 8px' }}>
              <DetailRow label="SITE"     value={selected.site?.name || '—'}/>
              <DetailRow label="DATE"     value={selected.shift ? fmtDate(selected.shift.start_time) : '—'}/>
              <DetailRow label="TIME"     value={selected.shift ? `${fmt12(selected.shift.start_time)} – ${fmt12(selected.shift.end_time)}` : '—'}/>
              <DetailRow label="DURATION" value={selected.shift ? fmtDur(selected.shift.start_time, selected.shift.end_time) : '—'}/>
              {selected.shift?.role  && <DetailRow label="ROLE"  value={selected.shift.role}/>}
              {selected.shift?.notes && <DetailRow label="NOTES" value={selected.shift.notes}/>}
              {selected.source === 'dropped' && <DetailRow label="TYPE" value="Dropped shift"/>}

              {/* OT warning inline */}
              {otWarning && (
                <div style={{ marginTop:'16px', background:'rgba(232,148,58,0.08)', border:'1px solid rgba(232,148,58,0.35)', borderRadius:'var(--radius-md)', padding:'14px' }}>
                  <div style={{ fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, color:'var(--color-warning)', letterSpacing:'1px', marginBottom:'10px' }}>⚠ OVERTIME WARNING</div>
                  {[
                    ['Current hours this week', fmtH(otWarning.currentHours)],
                    ['This shift adds',          fmtH(otWarning.newShiftHours)],
                    ['Projected total',          fmtH(otWarning.projectedHours)],
                    ['Overtime hours',           fmtH(otWarning.otHours)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'3px 0' }}>
                      <span style={{ color:'var(--text-muted)' }}>{l}</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* footer */}
            <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              {otWarning ? (
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setOtWarning(null)}
                    style={{ flex:1, height:'48px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, cursor:'pointer', letterSpacing:'1px' }}>
                    CANCEL
                  </button>
                  <button onClick={() => handleClaim(true)} disabled={claiming}
                    style={{ flex:2, height:'48px', background:'rgba(232,148,58,0.1)', border:'1px solid rgba(232,148,58,0.35)', borderRadius:'var(--radius-md)', color:'var(--color-warning)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, cursor:claiming?'not-allowed':'pointer', letterSpacing:'1px', opacity:claiming?0.7:1 }}>
                    {claiming ? 'CLAIMING...' : 'CLAIM ANYWAY'}
                  </button>
                </div>
              ) : (
                <button onClick={() => handleClaim(false)} disabled={claiming}
                  style={{ width:'100%', height:'52px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, cursor:claiming?'not-allowed':'pointer', letterSpacing:'1.5px', opacity:claiming?0.7:1 }}>
                  {claiming ? 'CLAIMING...' : 'CLAIM SHIFT'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
