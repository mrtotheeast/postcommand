import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LEVELS, ROLE_LABELS } from '../../config/roles'
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

// ── Shared bottom-sheet primitives ────────────────────────────────────────────

function SheetBackdrop({ onClose }) {
  return <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, backdropFilter:'blur(2px)' }}/>
}

function Sheet({ children }) {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--bg-surface)', borderRadius:'16px 16px 0 0', zIndex:101, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 -4px 24px rgba(0,0,0,0.3)' }}>
      <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px', flexShrink:0 }}>
        <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-subtle)' }}/>
      </div>
      {children}
    </div>
  )
}

function SheetHeader({ title, onClose, onBack }) {
  return (
    <div style={{ padding:'4px 20px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {onBack && (
          <button onClick={onBack} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', padding:'0', minHeight:'44px', minWidth:'36px' }}>
            <Icon name="arrow-left" size={18}/>
          </button>
        )}
        <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'2px', color:'var(--text-primary)' }}>{title}</div>
      </div>
      <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'44px', minWidth:'44px' }}>
        <Icon name="x" size={18}/>
      </button>
    </div>
  )
}

function WarningBox({ text }) {
  return (
    <div style={{ background:'rgba(232,148,58,0.08)', border:'1px solid rgba(232,148,58,0.3)', borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:'16px' }}>
      <div style={{ fontSize:'13px', color:'var(--color-warning)', lineHeight:1.5 }}>⚠ {text}</div>
    </div>
  )
}

function ShiftSummary({ shift, siteName }) {
  if (!shift) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:'16px' }}>
      <div style={{ fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, color:'var(--text-primary)', marginBottom:'4px' }}>{siteName}</div>
      <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>{fmtDate(shift.start_time)}</div>
      <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'2px' }}>{fmt12(shift.start_time)} – {fmt12(shift.end_time)} · {fmtDur(shift.start_time, shift.end_time)}</div>
    </div>
  )
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

  const [tab, setTab]                   = useState('schedule')
  const [loading, setLoading]           = useState(true)
  const [empId, setEmpId]               = useState(null)
  const [myShifts, setMyShifts]         = useState([])
  const [openShifts, setOpenShifts]     = useState([])
  const [availableShifts, setAvailableShifts] = useState([])
  const [sites, setSites]               = useState([])
  const [employees, setEmployees]       = useState([])
  const [otSettings, setOtSettings]     = useState(null)

  // Claim sheet state (existing)
  const [selected, setSelected]         = useState(null)
  const [claiming, setClaiming]         = useState(false)
  const [otWarning, setOtWarning]       = useState(null)

  // Drop sheet state
  const [dropShift, setDropShift]       = useState(null)
  const [submittingDrop, setSubmittingDrop] = useState(false)

  // Swap sheet state
  const [swapShift, setSwapShift]       = useState(null)
  const [swapStep, setSwapStep]         = useState('choose') // 'choose' | 'specific'
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [submittingSwap, setSubmittingSwap] = useState(false)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    if (!profile?.company_id) return
    setLoading(true)

    const { data: empRow } = await supabase
      .from('employee')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('user_id', profile.id)
      .maybeSingle()

    const myEmpId = empRow?.id || null
    setEmpId(myEmpId)

    const now = new Date().toISOString()

    const [sitesR, openR, csR, myR, empsR] = await Promise.all([
      supabase.from('site').select('id,name,city,state').eq('company_id', profile.company_id),
      supabase.from('open_shift').select('*').eq('company_id', profile.company_id).eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('company_settings')
        .select('ot_weekly_hours,ot_week_start,shift_drop_min_hours_before,shift_swap_min_hours_before')
        .eq('company_id', profile.company_id)
        .maybeSingle(),
      myEmpId
        ? supabase.from('shift').select('*')
            .eq('employee_id', myEmpId)
            .eq('company_id', profile.company_id)
            .neq('status', 'cancelled')
            .gte('start_time', now)
            .order('start_time')
            .limit(30)
        : Promise.resolve({ data: [] }),
      supabase.from('employee')
        .select('id,first_name,last_name,role,position_title')
        .eq('company_id', profile.company_id)
        .eq('status', 'active')
        .or('invitation_status.eq.accepted,has_app_access.eq.true')
        .order('last_name'),
    ])

    const siteList = sitesR.data || []
    const allOpen  = openR.data  || []

    const shiftIds = [...new Set(allOpen.map(os => os.shift_id).filter(Boolean))]
    let shiftMap = {}
    if (shiftIds.length > 0) {
      const { data: sd } = await supabase.from('shift').select('*').in('id', shiftIds)
      ;(sd || []).forEach(s => { shiftMap[s.id] = s })
    }

    const merged = allOpen
      .map(os => ({
        ...os,
        shift: os.shift_id ? shiftMap[os.shift_id] || null : null,
        site:  siteList.find(s => s.id === os.site_id) || null,
      }))
      .filter(os => os.shift)

    const availableSources = ['dropped', 'swap_pool']
    setSites(siteList)
    setOpenShifts(merged.filter(os => !availableSources.includes(os.source)))
    setAvailableShifts(merged.filter(os => availableSources.includes(os.source)))
    setOtSettings(csR.data || null)
    setMyShifts(myR.data || [])
    setEmployees((empsR.data || []).filter(e => e.id !== myEmpId))
    setLoading(false)
  }

  function siteName(id) {
    const s = sites.find(s => s.id === id)
    return s ? s.name : '—'
  }

  function closeAll() {
    setSelected(null); setOtWarning(null)
    setDropShift(null)
    setSwapShift(null); setSwapStep('choose'); setSelectedTarget(null)
  }

  // ── Claim ──────────────────────────────────────────────────────────────────

  function closeClaimSheet() { setSelected(null); setOtWarning(null) }

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
      .update({ status:'claimed', claimed_by_employee_id:empId, claimed_at:new Date().toISOString() })
      .eq('id', selected.id)
      .eq('status', 'open')

    setClaiming(false)
    if (error) { toast('Failed to claim — shift may have already been taken', 'error'); return }
    toast('Shift claimed!')
    closeClaimSheet()
    load()
  }

  // ── Drop ───────────────────────────────────────────────────────────────────

  function handleDropCheck(shift) {
    const buffer = otSettings?.shift_drop_min_hours_before ?? 2
    const hoursUntil = (new Date(shift.start_time) - Date.now()) / 3600000
    if (hoursUntil < buffer) {
      toast('Too close to shift start to drop this shift', 'error')
      return
    }
    setDropShift(shift)
  }

  async function handleDropConfirm() {
    if (!dropShift || !empId) return
    setSubmittingDrop(true)
    const buffer = otSettings?.shift_drop_min_hours_before ?? 2
    const expiresAt = new Date(new Date(dropShift.start_time).getTime() - buffer * 3600000).toISOString()

    const { error } = await supabase.from('open_shift').insert({
      company_id: profile.company_id,
      site_id: dropShift.site_id,
      shift_id: dropShift.id,
      source: 'dropped',
      original_employee_id: empId,
      status: 'open',
      expires_at: expiresAt,
    })

    setSubmittingDrop(false)
    if (error) { toast('Failed to post shift to pool', 'error'); return }
    toast('Shift posted to the pool')
    setDropShift(null)
    load()
  }

  // ── Swap ───────────────────────────────────────────────────────────────────

  function handleSwapCheck(shift) {
    const buffer = otSettings?.shift_swap_min_hours_before ?? 2
    const hoursUntil = (new Date(shift.start_time) - Date.now()) / 3600000
    if (hoursUntil < buffer) {
      toast('Too close to shift start to request a swap', 'error')
      return
    }
    setSwapShift(shift)
    setSwapStep('choose')
    setSelectedTarget(null)
  }

  async function handleSwapPool() {
    if (!swapShift || !empId) return
    setSubmittingSwap(true)
    const buffer = otSettings?.shift_swap_min_hours_before ?? 2
    const expiresAt = new Date(new Date(swapShift.start_time).getTime() - buffer * 3600000).toISOString()

    const { error: osErr } = await supabase.from('open_shift').insert({
      company_id: profile.company_id,
      site_id: swapShift.site_id,
      shift_id: swapShift.id,
      source: 'swap_pool',
      original_employee_id: empId,
      status: 'open',
      expires_at: expiresAt,
    })
    if (osErr) { setSubmittingSwap(false); toast('Failed to post swap', 'error'); return }

    await supabase.from('shift_swap_request').insert({
      company_id: profile.company_id,
      requesting_employee_id: empId,
      shift_id: swapShift.id,
      request_type: 'swap',
      posted_to_pool: true,
      status: 'pending',
      expires_at: expiresAt,
    })

    setSubmittingSwap(false)
    toast('Swap posted to the pool')
    setSwapShift(null)
    load()
  }

  async function handleSwapSpecific() {
    if (!swapShift || !empId || !selectedTarget) return
    setSubmittingSwap(true)
    const buffer = otSettings?.shift_swap_min_hours_before ?? 2
    const expiresAt = new Date(new Date(swapShift.start_time).getTime() - buffer * 3600000).toISOString()

    const { error } = await supabase.from('shift_swap_request').insert({
      company_id: profile.company_id,
      requesting_employee_id: empId,
      shift_id: swapShift.id,
      target_employee_id: selectedTarget.id,
      request_type: 'swap',
      posted_to_pool: false,
      status: 'pending',
      expires_at: expiresAt,
    })

    setSubmittingSwap(false)
    if (error) { toast('Failed to send swap request', 'error'); return }
    toast(`Swap request sent to ${selectedTarget.first_name}`)
    setSwapShift(null)
    load()
  }

  // Eligible swap targets: same role level or higher, excluding self
  const myLevel = ROLE_LEVELS[profile?.role] ?? 0
  const eligibleEmployees = employees.filter(e => (ROLE_LEVELS[e.role] ?? 0) >= myLevel)

  const TABS = [
    { id:'schedule',  label:'MY SCHEDULE' },
    { id:'open',      label:'OPEN SHIFTS' },
    { id:'available', label:'AVAILABLE'   },
  ]

  const btnSmall = (bg, border, color) => ({
    flex:1, height:'34px', background:bg, border:`1px solid ${border}`, borderRadius:'var(--radius-sm)',
    color, fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, cursor:'pointer', letterSpacing:'0.5px',
  })

  const btnPrimary = (disabled) => ({
    width:'100%', height:'52px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)',
    color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700,
    cursor:disabled?'not-allowed':'pointer', letterSpacing:'1.5px', opacity:disabled?0.7:1,
  })

  const btnSecondary = {
    flex:1, height:'48px', background:'transparent', border:'1px solid var(--border-subtle)',
    borderRadius:'var(--radius-md)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)',
    fontSize:'13px', fontWeight:700, cursor:'pointer', letterSpacing:'1px',
  }

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
            {[1,2,3].map(i => <div key={i} style={{ height:'100px', borderRadius:'var(--radius-md)' }} className="skeleton"/>)}
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
                        {/* Action buttons */}
                        <div style={{ display:'flex', gap:'8px', marginTop:'12px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); handleDropCheck(s) }}
                            style={btnSmall('rgba(224,85,85,0.07)','rgba(224,85,85,0.3)','var(--color-danger)')}>
                            DROP SHIFT
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleSwapCheck(s) }}
                            style={btnSmall('var(--accent-bg)','var(--accent-border)','var(--accent)')}>
                            SWAP SHIFT
                          </button>
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

            {/* AVAILABLE — dropped + swap_pool */}
            {tab === 'available' && (
              availableShifts.length === 0
                ? <EmptyState icon="refresh-cw" title="No available shifts" sub="No officers have dropped or posted a swap yet." />
                : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {availableShifts.map(os => <OpenShiftCard key={os.id} os={os} onSelect={setSelected}/>)}
                  </div>
                )
            )}
          </>
        )}
      </div>

      {/* ── CLAIM bottom sheet ─────────────────────────────────────────────── */}
      {selected && (
        <>
          <SheetBackdrop onClose={closeClaimSheet}/>
          <Sheet>
            <SheetHeader title="SHIFT DETAILS" onClose={closeClaimSheet}/>
            <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 8px' }}>
              <DetailRow label="SITE"     value={selected.site?.name || '—'}/>
              <DetailRow label="DATE"     value={selected.shift ? fmtDate(selected.shift.start_time) : '—'}/>
              <DetailRow label="TIME"     value={selected.shift ? `${fmt12(selected.shift.start_time)} – ${fmt12(selected.shift.end_time)}` : '—'}/>
              <DetailRow label="DURATION" value={selected.shift ? fmtDur(selected.shift.start_time, selected.shift.end_time) : '—'}/>
              {selected.shift?.role  && <DetailRow label="ROLE"  value={selected.shift.role}/>}
              {selected.shift?.notes && <DetailRow label="NOTES" value={selected.shift.notes}/>}
              {selected.source === 'dropped'   && <DetailRow label="TYPE" value="Dropped shift"/>}
              {selected.source === 'swap_pool' && <DetailRow label="TYPE" value="Swap requested"/>}

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
            <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              {otWarning ? (
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setOtWarning(null)} style={btnSecondary}>CANCEL</button>
                  <button onClick={() => handleClaim(true)} disabled={claiming}
                    style={{ flex:2, height:'48px', background:'rgba(232,148,58,0.1)', border:'1px solid rgba(232,148,58,0.35)', borderRadius:'var(--radius-md)', color:'var(--color-warning)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, cursor:claiming?'not-allowed':'pointer', letterSpacing:'1px', opacity:claiming?0.7:1 }}>
                    {claiming ? 'CLAIMING...' : 'CLAIM ANYWAY'}
                  </button>
                </div>
              ) : (
                <button onClick={() => handleClaim(false)} disabled={claiming} style={btnPrimary(claiming)}>
                  {claiming ? 'CLAIMING...' : 'CLAIM SHIFT'}
                </button>
              )}
            </div>
          </Sheet>
        </>
      )}

      {/* ── DROP bottom sheet ──────────────────────────────────────────────── */}
      {dropShift && (
        <>
          <SheetBackdrop onClose={() => setDropShift(null)}/>
          <Sheet>
            <SheetHeader title="DROP SHIFT" onClose={() => setDropShift(null)}/>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 8px' }}>
              <ShiftSummary shift={dropShift} siteName={siteName(dropShift.site_id)}/>
              <WarningBox text="You will remain responsible for this shift until someone accepts it. Your supervisor will be notified."/>
              <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, margin:0 }}>
                This shift will be posted to the Available pool. Any eligible officer may claim it. If unclaimed, the shift remains assigned to you.
              </p>
            </div>
            <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', gap:'10px' }}>
              <button onClick={() => setDropShift(null)} style={btnSecondary}>CANCEL</button>
              <button onClick={handleDropConfirm} disabled={submittingDrop}
                style={{ flex:2, height:'48px', background:'rgba(224,85,85,0.1)', border:'1px solid rgba(224,85,85,0.35)', borderRadius:'var(--radius-md)', color:'var(--color-danger)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, cursor:submittingDrop?'not-allowed':'pointer', letterSpacing:'1px', opacity:submittingDrop?0.7:1 }}>
                {submittingDrop ? 'POSTING...' : 'CONFIRM DROP'}
              </button>
            </div>
          </Sheet>
        </>
      )}

      {/* ── SWAP bottom sheet ──────────────────────────────────────────────── */}
      {swapShift && (
        <>
          <SheetBackdrop onClose={() => setSwapShift(null)}/>
          <Sheet>
            {swapStep === 'choose' && (
              <>
                <SheetHeader title="SWAP SHIFT" onClose={() => setSwapShift(null)}/>
                <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 8px' }}>
                  <ShiftSummary shift={swapShift} siteName={siteName(swapShift.site_id)}/>
                  <WarningBox text="You will remain responsible for this shift until someone accepts the swap."/>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    <button onClick={handleSwapPool} disabled={submittingSwap}
                      style={{ width:'100%', textAlign:'left', padding:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', cursor:submittingSwap?'not-allowed':'pointer', opacity:submittingSwap?0.7:1, transition:'border-color 150ms ease' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent-border)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}>
                      <div style={{ fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, color:'var(--accent)', marginBottom:'4px' }}>
                        {submittingSwap ? 'POSTING...' : 'POST TO POOL'}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Make this shift available to all eligible officers</div>
                    </button>
                    <button onClick={() => setSwapStep('specific')}
                      style={{ width:'100%', textAlign:'left', padding:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'border-color 150ms ease' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent-border)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}>
                      <div style={{ fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, color:'var(--text-primary)', marginBottom:'4px' }}>REQUEST SPECIFIC OFFICER</div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Ask a specific officer to take this shift</div>
                    </button>
                  </div>
                </div>
                <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
                  <button onClick={() => setSwapShift(null)} style={{ ...btnSecondary, width:'100%', flex:'unset' }}>CANCEL</button>
                </div>
              </>
            )}

            {swapStep === 'specific' && (
              <>
                <SheetHeader
                  title="SELECT OFFICER"
                  onClose={() => setSwapShift(null)}
                  onBack={() => { setSwapStep('choose'); setSelectedTarget(null) }}
                />
                <div style={{ flex:1, overflowY:'auto', padding:'8px 20px' }}>
                  {eligibleEmployees.length === 0 ? (
                    <EmptyState icon="users" title="No eligible officers" sub="No officers with matching or higher rank found."/>
                  ) : (
                    eligibleEmployees.map(emp => {
                      const isSelected = selectedTarget?.id === emp.id
                      return (
                        <button key={emp.id}
                          onClick={() => setSelectedTarget(isSelected ? null : emp)}
                          style={{ width:'100%', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', background:'transparent', border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                          <div>
                            <div style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)' }}>
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>
                              {ROLE_LABELS[emp.role] || emp.role}{emp.position_title ? ` · ${emp.position_title}` : ''}
                            </div>
                          </div>
                          <div style={{ width:'22px', height:'22px', borderRadius:'50%', border:`2px solid ${isSelected?'var(--accent)':'var(--border-subtle)'}`, background:isSelected?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {isSelected && <Icon name="check" size={12} color="var(--text-inverse)"/>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
                <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
                  <button onClick={handleSwapSpecific} disabled={!selectedTarget || submittingSwap} style={btnPrimary(!selectedTarget || submittingSwap)}>
                    {submittingSwap ? 'SENDING...' : selectedTarget ? `REQUEST ${selectedTarget.first_name.toUpperCase()}` : 'SELECT AN OFFICER'}
                  </button>
                </div>
              </>
            )}
          </Sheet>
        </>
      )}
    </div>
  )
}
