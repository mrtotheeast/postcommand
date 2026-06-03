import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import { isNative } from '../../lib/platform'
import Icon from '../../components/ui/Icon'

const HOLD_MS = 3000

const s = {
  page:    { padding: '24px', maxWidth: '900px', animation: 'fadeIn 200ms ease' },
  heading: { fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '4px' },
  sub:     { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '28px' },
  card:    { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '16px' },
  cardTitle: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'var(--font-condensed)', marginBottom: '18px' },
  // Officer SOS button
  triggerWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '24px' },
  sosBtn:  { width: '160px', height: '160px', borderRadius: '50%', background: '#c0392b', border: '4px solid #e05555', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 150ms ease', boxShadow: '0 0 0 0 rgba(224,85,85,0.4)', userSelect: 'none', WebkitUserSelect: 'none', position: 'relative', overflow: 'hidden' },
  sosBtnLabel: { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '3px', color: '#fff', pointerEvents: 'none' },
  sosBtnSub:   { fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-condensed)', letterSpacing: '1px', pointerEvents: 'none' },
  activeAlert: { background: 'rgba(192,57,43,0.1)', border: '2px solid #c0392b', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  alertTitle:  { fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '2px', color: '#e05555', animation: 'pulse 1.5s ease-in-out infinite' },
  alertSub:    { fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 },
  resolveBtn:  { display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 28px', height: '48px', fontFamily: 'var(--font-condensed)', fontSize: '15px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
  // Admin monitoring
  alertRow:    { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderBottom: '1px solid var(--border)', position: 'relative' },
  alertPulse:  { width: '12px', height: '12px', borderRadius: '50%', background: '#e05555', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' },
  alertEmp:    { flex: 1, minWidth: 0 },
  alertName:   { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' },
  alertMeta:   { fontSize: '12px', color: 'var(--text-muted)' },
  alertTime:   { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', color: '#e05555', minWidth: '70px', textAlign: 'right' },
  resolveSmall:{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(58,170,106,0.3)', borderRadius: 'var(--radius-sm)', padding: '0 14px', height: '36px', fontFamily: 'var(--font-condensed)', fontSize: '12px', letterSpacing: '1px', cursor: 'pointer', flexShrink: 0 },
  empty:   { padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
}

function useElapsed(start) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!start) return
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(start).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [start])
  const m = Math.floor(elapsed / 60)
  const sec = elapsed % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function ElapsedCell({ start }) {
  const t = useElapsed(start)
  return <div style={s.alertTime}>{t}</div>
}

export default function SOS() {
  const { profile } = useAuth()
  const { incrementBadge, clearBadge } = useNotifications()
  const isAdmin = atLeast(profile?.role, 'sergeant')
  const [alerts, setAlerts]     = useState([])
  const [myAlert, setMyAlert]   = useState(null)
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [holding, setHolding]   = useState(false)
  const [holdPct, setHoldPct]   = useState(0)
  const [resolving, setResolving] = useState(null)
  const holdTimer = useRef(null)
  const holdStart = useRef(null)
  const holdAnim  = useRef(null)

  useEffect(() => {
    loadData()
    const channel = supabase.channel('sos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alert', filter: `company_id=eq.${profile?.company_id}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  async function loadData() {
    if (!profile?.company_id) return
    const [{ data: empData }, { data: alertData }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('user_id', profile.id).single(),
      supabase.from('sos_alert').select('id,employee_id,site_id,latitude,longitude,triggered_at,status,message').eq('company_id', profile.company_id).eq('status', 'active').order('triggered_at', { ascending: false }),
    ])
    setEmployee(empData)
    const all = alertData || []
    setAlerts(all)
    const mine = empData ? all.find(a => a.employee_id === empData.id) : null
    setMyAlert(mine || null)
    const count = all.length
    if (count > 0) incrementBadge('active_sos')
    else clearBadge('active_sos')
    setLoading(false)
  }

  function startHold() {
    setHolding(true)
    holdStart.current = Date.now()
    const tick = () => {
      const pct = Math.min(100, ((Date.now() - holdStart.current) / HOLD_MS) * 100)
      setHoldPct(pct)
      if (pct < 100) holdAnim.current = requestAnimationFrame(tick)
      else triggerSOS()
    }
    holdAnim.current = requestAnimationFrame(tick)
  }

  function stopHold() {
    setHolding(false)
    setHoldPct(0)
    if (holdAnim.current) cancelAnimationFrame(holdAnim.current)
  }

  async function triggerHaptics() {
    if (!isNative()) return
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Heavy })
      await new Promise(r => setTimeout(r, 100))
      await Haptics.vibrate()
      await new Promise(r => setTimeout(r, 200))
      await Haptics.notification({ type: NotificationType.Warning })
    } catch {}
  }

  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = freq; osc.type = 'sine'
        gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
        osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
      }
      beep(880, 0, 0.2); beep(660, 0.25, 0.2); beep(880, 0.5, 0.2); beep(660, 0.75, 0.2)
    } catch {}
  }

  async function triggerSOS() {
    stopHold()
    if (!employee || !profile?.company_id) return
    playAlertSound()
    triggerHaptics()
    // Flash the body red briefly
    document.body.style.backgroundColor = '#c0392b'
    setTimeout(() => { document.body.style.backgroundColor = '' }, 600)
    let latitude = null, longitude = null
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }))
      latitude  = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {}
    await supabase.from('sos_alert').insert({
      company_id: profile.company_id,
      employee_id: employee.id,
      latitude, longitude,
      status: 'active',
      triggered_at: new Date().toISOString(),
    })
    await loadData()
  }

  async function cancelSOS() {
    if (!myAlert) return
    await supabase.from('sos_alert').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', myAlert.id)
    await loadData()
  }

  async function resolveAlert(alertId, note) {
    setResolving(alertId)
    let myEmpId = employee?.id
    if (!myEmpId) {
      const { data } = await supabase.from('employee').select('id').eq('user_id', profile.id).single()
      myEmpId = data?.id
    }
    await supabase.from('sos_alert').update({
      status: 'resolved', resolved_at: new Date().toISOString(),
      resolved_by: myEmpId, resolution_note: note||null
    }).eq('id', alertId)
    setResolving(null)
    await loadData()
  }

  async function acknowledgeAlert(alertId) {
    let myEmpId = employee?.id
    if (!myEmpId) {
      const { data } = await supabase.from('employee').select('id').eq('user_id', profile.id).single()
      myEmpId = data?.id
    }
    await supabase.from('sos_alert').update({ acknowledged_by: myEmpId, acknowledged_at: new Date().toISOString() }).eq('id', alertId)
    await loadData()
  }

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'var(--font-condensed)', letterSpacing: '2px' }}>LOADING...</div>

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes sosPulse{0%{box-shadow:0 0 0 0 rgba(224,85,85,0.5)}70%{box-shadow:0 0 0 24px rgba(224,85,85,0)}100%{box-shadow:0 0 0 0 rgba(224,85,85,0)}}
      `}</style>
      <h2 style={s.heading}>SOS</h2>
      <p style={s.sub}>Emergency alert system. Use only in a genuine emergency.</p>

      {/* ── Officer: trigger or active ── */}
      {!isAdmin && (
        <div style={s.card}>
          {!myAlert ? (
            <div style={s.triggerWrap}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
                Hold the button for 3 seconds to trigger an emergency SOS. Your location will be shared with supervisors.
              </div>
              <div
                style={{
                  ...s.sosBtn,
                  animation: myAlert ? 'sosPulse 1.5s infinite' : 'none',
                  boxShadow: holding ? `0 0 0 ${Math.round(holdPct * 0.3)}px rgba(224,85,85,0.3)` : '0 4px 24px rgba(0,0,0,0.5)',
                  transform: holding ? 'scale(0.96)' : 'scale(1)',
                }}
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={e => { e.preventDefault(); startHold() }}
                onTouchEnd={e => { e.preventDefault(); stopHold() }}
              >
                {holding && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
                    <circle cx="80" cy="80" r="74" fill="none" stroke="#fff" strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 74}`}
                      strokeDashoffset={`${2 * Math.PI * 74 * (1 - holdPct / 100)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                      style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                    />
                  </svg>
                )}
                <Icon name="alert-triangle" size={36} color="#fff" />
                <span style={s.sosBtnLabel}>SOS</span>
                <span style={s.sosBtnSub}>{holding ? 'HOLD...' : 'HOLD 3s'}</span>
              </div>
            </div>
          ) : (
            <div style={s.activeAlert}>
              <div style={s.alertTitle}>SOS ACTIVE</div>
              <Icon name="alert-triangle" size={40} color="#e05555" />
              <div style={s.alertSub}>
                Your SOS alert is active. Supervisors have been notified.<br />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Triggered at {new Date(myAlert.triggered_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#e05555', letterSpacing: '2px', margin: '8px 0' }}>
                <ElapsedCell start={myAlert.triggered_at} />
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button style={s.resolveBtn} onClick={() => resolveAlert(myAlert.id, '')} disabled={resolving === myAlert.id}>
                  <Icon name="check" size={16} />{resolving === myAlert.id ? 'RESOLVING...' : "I'M SAFE — RESOLVE"}
                </button>
                {(Date.now() - new Date(myAlert.triggered_at).getTime()) < 30000 && (
                  <button style={{ display:'flex',alignItems:'center',gap:'8px',background:'transparent',border:'2px solid rgba(224,85,85,0.5)',color:'#e05555',borderRadius:'var(--radius-sm)',padding:'0 20px',height:'48px',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,letterSpacing:'1px',cursor:'pointer' }} onClick={cancelSOS}>
                    CANCEL SOS
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Admin/Supervisor: active alerts ── */}
      {isAdmin && (
        <div style={s.card}>
          <div style={s.cardTitle}>Active SOS Alerts {alerts.length > 0 && `(${alerts.length})`}</div>
          {alerts.length === 0 ? (
            <div style={s.empty}>
              <Icon name="shield-check" size={32} color="var(--color-success)" />
              <div style={{ marginTop: '12px', color: 'var(--color-success)', fontFamily: 'var(--font-condensed)', letterSpacing: '1px', fontSize: '13px' }}>ALL CLEAR — No active SOS alerts</div>
            </div>
          ) : (
            <AlertList alerts={alerts} onResolve={resolveAlert} onAcknowledge={acknowledgeAlert} resolving={resolving} companyId={profile?.company_id} />
          )}
        </div>
      )}

      {/* Resolved history for admin */}
      {isAdmin && <ResolvedHistory companyId={profile?.company_id} />}
    </div>
  )
}

function AlertList({ alerts, onResolve, onAcknowledge, resolving, companyId }) {
  const [employees, setEmployees] = useState({})
  const [sites, setSites]         = useState({})
  const [resolveNote, setResolveNote] = useState({})
  const [showNote, setShowNote]   = useState({})

  useEffect(() => {
    if (!companyId) return
    Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', companyId),
      supabase.from('site').select('id,name,city,state').eq('company_id', companyId),
    ]).then(([{ data: eData }, { data: sData }]) => {
      setEmployees(Object.fromEntries((eData || []).map(e => [e.id, e])))
      setSites(Object.fromEntries((sData || []).map(s => [s.id, s])))
    })
  }, [companyId])

  return (
    <div>
      {alerts.map(alert => {
        const emp  = employees[alert.employee_id]
        const site = alert.site_id ? sites[alert.site_id] : null
        const isAcked = !!alert.acknowledged_at
        return (
          <div key={alert.id} style={{ ...s.alertRow, flexDirection:'column', alignItems:'flex-start', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'14px', width:'100%' }}>
              <div style={s.alertPulse} />
              <div style={s.alertEmp}>
                <div style={s.alertName}>{emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Officer'}</div>
                <div style={s.alertMeta}>
                  {emp?.position_title || emp?.role?.replace(/_/g,' ') || '—'}
                  {site ? ` · ${site.name}` : ''}
                  {alert.latitude ? ` · GPS: ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}` : ''}
                  {isAcked && <span style={{ color:'var(--color-success)', fontWeight:600 }}> · ACKNOWLEDGED</span>}
                </div>
              </div>
              <ElapsedCell start={alert.triggered_at} />
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                {!isAcked && onAcknowledge && (
                  <button style={{ ...s.resolveSmall, background:'var(--color-info-bg)', color:'var(--color-info)', border:'1px solid rgba(91,159,224,0.3)' }} onClick={() => onAcknowledge(alert.id)}>
                    <Icon name="eye" size={13}/>ACK
                  </button>
                )}
                <button style={{ ...s.resolveSmall, opacity: resolving === alert.id ? 0.6 : 1 }} onClick={() => setShowNote(p=>({...p,[alert.id]:!p[alert.id]}))} disabled={resolving === alert.id}>
                  <Icon name="check" size={13}/>{showNote[alert.id] ? 'CANCEL' : 'RESOLVE'}
                </button>
              </div>
            </div>
            {showNote[alert.id] && (
              <div style={{ display:'flex', gap:'8px', width:'100%', paddingLeft:'26px' }}>
                <input placeholder="Resolution note (required for record)..." value={resolveNote[alert.id]||''} onChange={e=>setResolveNote(p=>({...p,[alert.id]:e.target.value}))}
                  style={{ flex:1, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', fontFamily:'var(--font-body)' }}/>
                <button style={{ ...s.resolveSmall, opacity: resolving===alert.id||!resolveNote[alert.id]?.trim()?0.6:1 }} onClick={() => { if (resolveNote[alert.id]?.trim()) { onResolve(alert.id, resolveNote[alert.id]); setShowNote(p=>({...p,[alert.id]:false})) }}} disabled={!resolveNote[alert.id]?.trim()||resolving===alert.id}>
                  {resolving === alert.id ? 'RESOLVING...' : 'CONFIRM RESOLVE'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResolvedHistory({ companyId }) {
  const [history, setHistory]   = useState([])
  const [employees, setEmployees] = useState({})
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    if (!open || !companyId) return
    Promise.all([
      supabase.from('sos_alert').select('id,employee_id,triggered_at,resolved_at,status').eq('company_id', companyId).eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(20),
      supabase.from('employee').select('id,first_name,last_name').eq('company_id', companyId),
    ]).then(([{ data: hData }, { data: eData }]) => {
      setHistory(hData || [])
      setEmployees(Object.fromEntries((eData || []).map(e => [e.id, e])))
    })
  }, [open, companyId])

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-condensed)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px' }}
        onClick={() => setOpen(o => !o)}
      >
        <span>Resolved History</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} />
      </button>
      {open && (
        <div>
          {history.length === 0 ? (
            <div style={{ padding: '20px 24px', fontSize: '13px', color: 'var(--text-muted)' }}>No resolved alerts.</div>
          ) : history.map(a => {
            const emp = employees[a.employee_id]
            const duration = a.resolved_at && a.triggered_at
              ? Math.round((new Date(a.resolved_at) - new Date(a.triggered_at)) / 1000)
              : null
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 24px', borderTop: '1px solid var(--border)', fontSize: '13px' }}>
                <Icon name="check-circle" size={14} color="var(--color-success)" />
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{new Date(a.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                {duration !== null && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{Math.floor(duration / 60)}m {duration % 60}s</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
