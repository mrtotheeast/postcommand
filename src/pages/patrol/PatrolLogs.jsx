import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../context/AuthContext'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import { scopeToOwnEmployee } from '../../lib/scoping'
import Icon from '../../components/ui/Icon'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const s = {
  page:      { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:   { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:       { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  stats:     { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'22px' },
  statCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
  statLbl:   { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
  statVal:   { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  card:      { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'22px', marginBottom:'16px' },
  cardTitle: { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'16px' },
  toolbar:   { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  search:    { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'180px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  sel:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', fontFamily:'var(--font-body)', cursor:'pointer' },
  table:     { width:'100%', borderCollapse:'collapse' },
  th:        { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  tr:        { borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 150ms ease' },
  td:        { padding:'12px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  tdName:    { padding:'12px', fontSize:'13px', color:'var(--text-primary)', fontWeight:600, verticalAlign:'middle' },
  pill:      { display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  // Active patrol
  activeCard:{ background:'rgba(200,168,75,0.07)', border:'2px solid var(--accent-border)', borderRadius:'var(--radius-lg)', padding:'28px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', textAlign:'center', marginBottom:'20px' },
  timer:     { fontFamily:'var(--font-display)', fontSize:'52px', letterSpacing:'4px', color:'var(--accent)', lineHeight:1 },
  timerLbl:  { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)' },
  cpCount:   { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 },
  bigBtn:    { display:'inline-flex', alignItems:'center', gap:'10px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 28px', height:'52px', fontFamily:'var(--font-condensed)', fontSize:'16px', fontWeight:700, letterSpacing:'1.5px', cursor:'pointer', transition:'all 150ms ease' },
  endBtn:    { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  cpBtn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-surface)', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer', transition:'all 150ms ease' },
  cpList:    { width:'100%', display:'flex', flexDirection:'column', gap:'0' },
  cpRow:     { display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
  // Modal
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'480px', boxShadow:'var(--shadow-modal)' },
  modalHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  modalTitle:{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' },
  closeBtn:  { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' },
  field:     { marginBottom:'14px' },
  lbl:       { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  saveBtn:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghostBtn:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  // Detail panel
  detailOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:400, display:'flex', alignItems:'stretch', justifyContent:'flex-end' },
  detailPanel:   { width:'400px', maxWidth:'100vw', background:'var(--bg-card)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', animation:'slideIn 200ms ease' },
  detailHead:    { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'20px 22px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  detailTitle:   { fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1.1 },
  detailBody:    { flex:1, overflowY:'auto', padding:'18px 22px' },
}

function fmtDuration(startISO, endISO) {
  const ms = new Date(endISO ?? Date.now()) - new Date(startISO)
  if (ms < 0) return '0h 0m'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}
function fmtTime(iso) { return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }) }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' }) }

// Live timer hook
function useTimer(startISO) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startISO) return
    const tick = () => {
      const ms = Date.now() - new Date(startISO).getTime()
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000)
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startISO])
  return elapsed
}

export default function PatrolLogs() {
  const { profile } = useAuth()
  const isAdmin     = atLeast(profile?.role, 'sergeant')
  const [employee, setEmployee]     = useState(null)
  const [sites, setSites]           = useState([])
  const [patrols, setPatrols]       = useState([])
  const [activePatrol, setActive]   = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [loading, setLoading]       = useState(true)
  const [empMap, setEmpMap]         = useState({})
  const [siteMap, setSiteMap]       = useState({})
  const [showStart, setShowStart]   = useState(false)
  const [showCP, setShowCP]         = useState(false)
  const [detail, setDetail]         = useState(null)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [mainTab, setMainTab]       = useState('logs')

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  const load = withLoadTimeout(async function load() {
    if (!profile?.company_id) return
    setLoading(true)
    try {
      const [{ data: empData }, { data: siteData }, { data: patrolData }, { data: allEmpData }] = await Promise.all([
        supabase.from('employee').select('id,first_name,last_name,role').eq('user_id', profile.id).single(),
        supabase.from('site').select('id,name,city,state').eq('company_id', profile.company_id),
        scopeToOwnEmployee(supabase.from('patrol_log').select('*').eq('company_id', profile.company_id).order('started_at', { ascending:false }).limit(100), profile),
        supabase.from('employee').select('id,first_name,last_name').eq('company_id', profile.company_id),
      ])
      const emp = empData
      setEmployee(emp)
      setSites(siteData || [])
      setPatrols(patrolData || [])
      setSiteMap(Object.fromEntries((siteData||[]).map(s => [s.id, s])))
      setEmpMap(Object.fromEntries((allEmpData||[]).map(e => [e.id, e])))
      // Find active patrol for this officer
      if (emp) {
        const active = (patrolData||[]).find(p => p.employee_id === emp.id && p.status === 'active')
        if (active) {
          setActive(active)
          const { data: cpData } = await supabase.from('patrol_checkpoint').select('*').eq('patrol_log_id', active.id).eq('company_id', profile.company_id).order('scanned_at')
          setCheckpoints(cpData || [])
        } else {
          setActive(null); setCheckpoints([])
        }
      }
    } catch(e) {
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function startPatrol(siteId) {
    if (!employee || !siteId) return
    const { data } = await supabase.from('patrol_log').insert({
      company_id: profile.company_id, employee_id: employee.id, site_id: siteId, started_at: new Date().toISOString(), status: 'active',
    }).select().single()
    setActive(data); setCheckpoints([]); setShowStart(false); load()
  }

  async function endPatrol() {
    if (!activePatrol) return
    await supabase.from('patrol_log').update({ status:'completed', ended_at: new Date().toISOString() }).eq('id', activePatrol.id).eq('company_id', profile.company_id)
    setActive(null); setCheckpoints([]); load()
  }

  async function logCheckpoint(name, notes, lat, lng, qrCode) {
    if (!activePatrol) return
    const { data } = await supabase.from('patrol_checkpoint').insert({
      company_id: profile.company_id, patrol_log_id: activePatrol.id,
      name: name || qrCode || 'Checkpoint',
      latitude: lat || null, longitude: lng || null,
      notes: notes || null, method: qrCode ? 'qr' : 'manual',
      scanned_at: new Date().toISOString(),
    }).select().single()
    setCheckpoints(prev => [...prev, data]); setShowCP(false)
  }

  const visiblePatrols = patrols.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search) {
      const emp = empMap[p.employee_id]
      const site = siteMap[p.site_id]
      const q = search.toLowerCase()
      if (!`${emp?.first_name} ${emp?.last_name}`.toLowerCase().includes(q) && !site?.name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const todayPatrols = patrols.filter(p => p.started_at?.slice(0,10) === new Date().toISOString().slice(0,10))
  const completedToday = todayPatrols.filter(p => p.status === 'completed').length
  const totalHoursToday = todayPatrols.filter(p => p.ended_at).reduce((acc, p) => acc + (new Date(p.ended_at) - new Date(p.started_at)) / 3600000, 0)

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:'60px', borderRadius:'8px', marginBottom:'10px' }} />)}</div>

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
        <h2 style={s.heading}>PATROL LOGS</h2>
        <div style={{ display:'flex', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'3px' }}>
          {[['logs','Logs'],['analytics','Analytics']].map(([v,l])=>(
            <button key={v} onClick={()=>setMainTab(v)} style={{ padding:'0 12px', height:'32px', border:'none', borderRadius:'4px', background:mainTab===v?'var(--accent-bg)':'transparent', color:mainTab===v?'var(--accent)':'var(--text-muted)', cursor:'pointer', fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:mainTab===v?700:400, letterSpacing:'1px' }}>{l}</button>
          ))}
        </div>
      </div>
      <p style={s.sub}>Start a patrol, log checkpoints, and view patrol history.</p>
      {mainTab === 'analytics' && <PatrolAnalytics patrols={patrols} employees={Object.values(empMap)} siteMap={siteMap} empMap={empMap} />}

      <div style={s.stats}>
        {[
          { label:'Patrols Today',    value: todayPatrols.length, color:'var(--text-primary)' },
          { label:'Completed Today',  value: completedToday, color:'var(--color-success)' },
          { label:'Hours Logged Today', value: `${totalHoursToday.toFixed(1)}h`, color:'var(--accent)' },
          { label:'Active Now',       value: patrols.filter(p=>p.status==='active').length, color:'var(--color-info)' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Active patrol card (officer view) ── */}
      {employee && (
        activePatrol ? (
          <ActivePatrolCard
            patrol={activePatrol}
            checkpoints={checkpoints}
            siteMap={siteMap}
            onEnd={endPatrol}
            onLogCP={() => setShowCP(true)}
          />
        ) : (
          <div style={{ marginBottom:'20px' }}>
            <button style={s.bigBtn} onClick={() => setShowStart(true)}>
              <Icon name="play-circle" size={22} />START PATROL
            </button>
          </div>
        )
      )}

      {/* ── History table ── */}
      <div style={s.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
          <div style={s.cardTitle}>Patrol History</div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <input style={{ ...s.search, flex:'0 0 auto', width:'180px' }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
            <select style={s.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Officer','Site','Started','Duration','Checkpoints','Status'].map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {visiblePatrols.slice(0, 50).map(p => {
                const emp  = empMap[p.employee_id]
                const site = siteMap[p.site_id]
                const isActive = p.status === 'active'
                return (
                  <tr key={p.id} style={s.tr}
                    onClick={() => setDetail(p)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={s.tdName}>{emp ? `${emp.first_name} ${emp.last_name}` : '—'}</td>
                    <td style={s.td}>{site?.name ?? '—'}</td>
                    <td style={s.td}>{fmtDate(p.started_at)} {fmtTime(p.started_at)}</td>
                    <td style={s.td}>{isActive ? <span style={{ animation:'pulse 1.5s infinite', color:'var(--accent)' }}>LIVE</span> : fmtDuration(p.started_at, p.ended_at)}</td>
                    <td style={s.td}>{p.checkpoint_count ?? '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.pill, ...(isActive ? { background:'var(--accent-bg)', color:'var(--accent)' } : { background:'var(--color-success-bg)', color:'var(--color-success)' }) }}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {visiblePatrols.length === 0 && (
                <tr><td colSpan={6} style={{ ...s.td, textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>No patrols found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showStart && <StartPatrolModal sites={sites} onStart={startPatrol} onClose={() => setShowStart(false)} />}
      {showCP    && <CheckpointModal onLog={logCheckpoint} onClose={() => setShowCP(false)} />}
      {detail    && <PatrolDetailPanel patrol={detail} siteMap={siteMap} empMap={empMap} onClose={() => setDetail(null)} />}
    </div>
  )
}

// ── Active Patrol Card ────────────────────────────────────────────────────────

function ActivePatrolCard({ patrol, checkpoints, siteMap, onEnd, onLogCP }) {
  const elapsed = useTimer(patrol.started_at)
  const site = siteMap[patrol.site_id]

  return (
    <div style={s.activeCard}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'2px', fontFamily:'var(--font-condensed)' }}>PATROL ACTIVE</div>
        <div style={{ fontSize:'14px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700 }}>{site?.name ?? 'Unknown Site'}</div>
      </div>
      <div>
        <div style={s.timer}>{elapsed}</div>
        <div style={s.timerLbl}>elapsed</div>
      </div>
      <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={s.cpCount}>{checkpoints.length}</div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' }}>Checkpoints</div>
        </div>
      </div>
      {checkpoints.length > 0 && (
        <div style={{ ...s.cpList, maxHeight:'120px', overflowY:'auto', width:'100%', maxWidth:'400px' }}>
          {[...checkpoints].reverse().slice(0, 5).map((cp, i) => (
            <div key={cp.id} style={s.cpRow}>
              <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--color-success)', flexShrink:0 }} />
              <div style={{ flex:1, textAlign:'left', color:'var(--text-primary)' }}>{cp.name}</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{fmtTime(cp.scanned_at)}</div>
              {cp.method === 'qr' && <Icon name="grid" size={11} color="var(--accent)" />}
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
        <button style={s.cpBtn} onClick={onLogCP}>
          <Icon name="plus-circle" size={15} />LOG CHECKPOINT
        </button>
        <button style={s.endBtn} onClick={onEnd}>
          <Icon name="stop-circle" size={15} />END PATROL
        </button>
      </div>
    </div>
  )
}

// ── Start Patrol Modal ────────────────────────────────────────────────────────

function StartPatrolModal({ sites, onStart, onClose }) {
  const [siteId, setSiteId] = useState(sites[0]?.id || '')
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>START PATROL</div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Select Site</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={siteId} onChange={e => setSiteId(e.target.value)}>
            {sites.map(s2 => <option key={s2.id} value={s2.id}>{s2.name} — {s2.city}, {s2.state}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button style={s.saveBtn} onClick={() => onStart(siteId)} disabled={!siteId}>
            <Icon name="play-circle" size={15} />START
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Checkpoint Modal ──────────────────────────────────────────────────────────

function CheckpointModal({ onLog, onClose }) {
  const [name, setName]       = useState('')
  const [notes, setNotes]     = useState('')
  const [qrCode, setQrCode]   = useState('')
  const [gps, setGps]         = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const animRef   = useRef(null)
  const hasDetector = 'BarcodeDetector' in window

  function getGPS() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false) },
      ()  => setGpsLoading(false),
      { timeout: 5000 }
    )
  }

  async function startScan() {
    if (!hasDetector) return
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      const detector = new window.BarcodeDetector({ formats:['qr_code'] })
      const scan = async () => {
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const val = codes[0].rawValue
            setQrCode(val)
            if (!name) setName(val.replace('postcommand-checkpoint:', '').replace('postcommand-site:', 'Site: '))
            stopScan()
          } else {
            animRef.current = requestAnimationFrame(scan)
          }
        } catch { animRef.current = requestAnimationFrame(scan) }
      }
      animRef.current = requestAnimationFrame(scan)
    } catch { setScanning(false) }
  }

  function stopScan() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setScanning(false)
  }

  useEffect(() => () => stopScan(), [])

  function submit() {
    if (!name.trim() && !qrCode.trim()) return
    onLog(name.trim() || qrCode, notes.trim(), gps?.lat, gps?.lng, qrCode.trim() || null)
  }

  const inputF = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor = 'var(--border)' }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) { stopScan(); onClose() } }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>LOG CHECKPOINT</div>
          <button style={s.closeBtn} onClick={() => { stopScan(); onClose() }}><Icon name="x" size={18} /></button>
        </div>

        {scanning ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', padding:'8px 0' }}>
            <video ref={videoRef} style={{ width:'100%', maxHeight:'220px', borderRadius:'var(--radius-sm)', background:'#000', objectFit:'cover' }} muted playsInline />
            <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Point camera at a PostCommand QR code</div>
            <button style={s.ghostBtn} onClick={stopScan}><Icon name="x" size={14} />CANCEL SCAN</button>
          </div>
        ) : (
          <>
            <div style={s.field}>
              <div style={s.lbl}>Checkpoint Name</div>
              <input style={s.inp} value={name} onChange={e => setName(e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="e.g. Main Entrance, Back Gate, Parking Level B" />
            </div>

            <div style={{ ...s.field, display:'flex', gap:'8px', alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <div style={s.lbl}>QR Code (optional)</div>
                <input style={s.inp} value={qrCode} onChange={e => setQrCode(e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Paste code or scan" />
              </div>
              {hasDetector && (
                <button style={{ ...s.cpBtn, height:'42px', padding:'0 12px', fontSize:'12px' }} onClick={startScan}>
                  <Icon name="grid" size={14} />SCAN
                </button>
              )}
            </div>

            <div style={s.field}>
              <div style={s.lbl}>Notes (optional)</div>
              <input style={s.inp} value={notes} onChange={e => setNotes(e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Observations, conditions..." />
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px' }}>
              <button style={{ ...s.ghostBtn, height:'38px', padding:'0 14px', fontSize:'12px' }} onClick={getGPS} disabled={gpsLoading}>
                <Icon name="map-pin" size={13} />{gpsLoading ? 'LOCATING...' : gps ? 'GPS ✓' : 'CAPTURE GPS'}
              </button>
              {gps && <span style={{ fontSize:'11px', color:'var(--color-success)' }}>{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</span>}
            </div>

            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...s.saveBtn, opacity: !name.trim() && !qrCode.trim() ? 0.5 : 1 }} onClick={submit} disabled={!name.trim() && !qrCode.trim()}>
                <Icon name="check-circle" size={14} />LOG IT
              </button>
              <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Patrol Detail Panel ───────────────────────────────────────────────────────

function cpIcon(num) {
  return L.divIcon({ html:`<div style="width:26px;height:26px;border-radius:50%;background:var(--accent,#c8a84b);border:2px solid #a8841e;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;color:#0d0f14;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${num}</div>`, className:'', iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-13] })
}
function siteIcon() {
  return L.divIcon({ html:`<div style="width:14px;height:14px;border-radius:50%;background:#3aaa6a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`, className:'', iconSize:[14,14], iconAnchor:[7,7] })
}

function PatrolDetailPanel({ patrol, siteMap, empMap, onClose }) {
  const [checkpoints, setCheckpoints] = useState([])
  const [tab, setTab] = useState('info')
  const elapsed = useTimer(patrol.status === 'active' ? patrol.started_at : null)
  const site = siteMap[patrol.site_id]
  const emp  = empMap[patrol.employee_id]

  useEffect(() => {
    supabase.from('patrol_checkpoint').select('*').eq('patrol_log_id', patrol.id).order('scanned_at')
      .then(({ data }) => setCheckpoints(data || []))
      .catch(() => {})
  }, [patrol.id])

  const geoPoints = checkpoints.filter(cp => cp.latitude && cp.longitude)
  const mapCenter = geoPoints.length > 0
    ? [Number(geoPoints[0].latitude), Number(geoPoints[0].longitude)]
    : site?.latitude ? [Number(site.latitude), Number(site.longitude)]
    : [38.9, -77.0]

  const TABS = [{ id:'info',label:'Info' }, { id:'checkpoints',label:`Checkpoints (${checkpoints.length})` }, { id:'map',label:'Map' }]

  return (
    <div style={s.detailOverlay} onClick={onClose}>
      <div style={s.detailPanel} onClick={e => e.stopPropagation()}>
        <div style={s.detailHead}>
          <div>
            <div style={s.detailTitle}>PATROL LOG</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>
              {emp ? `${emp.first_name} ${emp.last_name}` : '—'} · {site?.name ?? '—'}
            </div>
          </div>
          <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' }} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ display:'flex', gap:'2px', padding:'0 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {TABS.map(t => (
            <button key={t.id} style={{ padding:'10px 14px', fontSize:'12px', color:tab===t.id?'var(--accent)':'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:`2px solid ${tab===t.id?'var(--accent)':'transparent'}`, marginBottom:'-1px', transition:'all 150ms ease', fontWeight:tab===t.id?700:400 }} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === 'info' && (
          <div style={s.detailBody}>
            {[
              { label:'Date',        value: fmtDate(patrol.started_at) },
              { label:'Start',       value: fmtTime(patrol.started_at) },
              { label:'End',         value: patrol.ended_at ? fmtTime(patrol.ended_at) : patrol.status === 'active' ? elapsed + ' (live)' : '—' },
              { label:'Duration',    value: patrol.ended_at ? fmtDuration(patrol.started_at, patrol.ended_at) : patrol.status === 'active' ? 'In progress' : '—' },
              { label:'Status',      value: patrol.status.toUpperCase() },
              { label:'Checkpoints', value: checkpoints.length },
              { label:'GPS Logged',  value: geoPoints.length > 0 ? `${geoPoints.length} / ${checkpoints.length}` : 'None' },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                <span style={{ color:'var(--text-muted)', fontFamily:'var(--font-condensed)', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{item.label}</span>
                <span style={{ color:'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'checkpoints' && (
          <div style={s.detailBody}>
            {checkpoints.length === 0 ? (
              <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'20px 0' }}>No checkpoints logged.</div>
            ) : checkpoints.map((cp, i) => (
              <div key={cp.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'11px', color:'var(--accent)', flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{cp.name}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>
                    {fmtTime(cp.scanned_at)}
                    {cp.latitude && ` · ${Number(cp.latitude).toFixed(4)}, ${Number(cp.longitude).toFixed(4)}`}
                    {cp.method === 'qr' && ' · QR'}
                  </div>
                  {cp.notes && <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'3px' }}>{cp.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'map' && (
          <div style={{ flex:1, overflow:'hidden', minHeight:'300px' }}>
            {geoPoints.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontSize:'13px' }}>
                <Icon name="map-pin" size={28} color="var(--border)" />
                <div style={{ marginTop:'12px' }}>No GPS coordinates recorded for this patrol.</div>
              </div>
            ) : (
              <MapContainer center={mapCenter} zoom={15} style={{ width:'100%', height:'100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                {site?.latitude && site?.longitude && (
                  <Marker position={[Number(site.latitude), Number(site.longitude)]} icon={siteIcon()}>
                    <Popup><div style={{fontFamily:'Barlow,sans-serif',fontSize:'12px'}}><strong>{site.name}</strong><br/>Site location</div></Popup>
                  </Marker>
                )}
                {geoPoints.map((cp,i) => (
                  <Marker key={cp.id} position={[Number(cp.latitude), Number(cp.longitude)]} icon={cpIcon(i+1)}>
                    <Popup><div style={{fontFamily:'Barlow,sans-serif',fontSize:'12px'}}><strong>{cp.name}</strong><br/>{fmtTime(cp.scanned_at)}</div></Popup>
                  </Marker>
                ))}
                {geoPoints.length > 1 && (
                  <Polyline positions={geoPoints.map(cp => [Number(cp.latitude), Number(cp.longitude)])} pathOptions={{ color:'#c8a84b', weight:2, dashArray:'6 4', opacity:0.8 }} />
                )}
                <style>{`.leaflet-container{background:#e8f4f8}.leaflet-popup-content-wrapper{background:#1a1d2a;border:1px solid #252838;border-radius:8px;color:#f0f2f8}.leaflet-popup-tip{background:#1a1d2a}.leaflet-popup-close-button{color:#7a8299!important}.leaflet-control-zoom a{background:#1a1d2a!important;color:#c8a84b!important;border-color:#252838!important}`}</style>
              </MapContainer>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Patrol Analytics ──────────────────────────────────────────────────────────

function PatrolAnalytics({ patrols, employees, siteMap, empMap }) {
  const completed = patrols.filter(p => p.status === 'completed' && p.ended_at)
  const empMap2   = empMap

  // Hours per employee
  const empHours = {}
  for (const p of completed) {
    const h = (new Date(p.ended_at) - new Date(p.started_at)) / 3600000
    const n = empMap2[p.employee_id] ? `${empMap2[p.employee_id].first_name} ${empMap2[p.employee_id].last_name}` : 'Unknown'
    empHours[n] = (empHours[n]||0) + h
  }
  const topEmp = Object.entries(empHours).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value:Math.round(value*10)/10}))

  // Patrols per site
  const siteCounts = {}
  for (const p of completed) {
    const n = siteMap[p.site_id]?.name || 'Unknown'
    siteCounts[n] = (siteCounts[n]||0)+1
  }
  const topSites = Object.entries(siteCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,value])=>({label,value}))

  // Daily patrol count for last 14 days
  const daily = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i*86400000).toISOString().slice(0,10)
    daily[d] = 0
  }
  for (const p of completed) {
    const d = p.started_at?.slice(0,10)
    if (d && daily[d] !== undefined) daily[d]++
  }
  const dailyData = Object.entries(daily).map(([date,count])=>({ label:new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), value:count }))
  const maxDaily = Math.max(...dailyData.map(d=>d.value), 1)

  const totalHours = completed.reduce((a,p)=>a+(new Date(p.ended_at)-new Date(p.started_at))/3600000, 0)
  const avgDuration = completed.length > 0 ? totalHours/completed.length : 0

  const sc = {
    stats:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'20px' },
    card:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'18px 20px', marginBottom:'14px' },
    title:  { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' },
    barRow: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' },
    barLbl: { fontSize:'12px', color:'var(--text-secondary)', minWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 },
    barTrk: { flex:1, height:'8px', background:'var(--border)', borderRadius:'4px', overflow:'hidden' },
    barVal: { fontSize:'12px', color:'var(--text-muted)', minWidth:'36px', textAlign:'right', flexShrink:0 },
    statCard:{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
    statLbl: { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
    statVal: { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  }

  function Bar({ data, color }) {
    const max = Math.max(...data.map(d=>d.value), 1)
    return data.map((d,i)=>(
      <div key={i} style={sc.barRow}>
        <div style={sc.barLbl} title={d.label}>{d.label}</div>
        <div style={sc.barTrk}><div style={{ height:'100%', borderRadius:'4px', background:color, width:`${(d.value/max)*100}%`, transition:'width 500ms ease' }}/></div>
        <div style={sc.barVal}>{d.value}</div>
      </div>
    ))
  }

  return (
    <div>
      <div style={sc.stats}>
        {[
          { label:'Total Patrols',   value:completed.length,               color:'var(--text-primary)' },
          { label:'Total Hours',     value:`${Math.round(totalHours)}h`,   color:'var(--accent)' },
          { label:'Avg Duration',    value:`${Math.round(avgDuration*60)}m`,color:'var(--color-info)' },
          { label:'Active Officers', value:Object.keys(empHours).length,   color:'var(--color-success)' },
        ].map(c=>(
          <div key={c.label} style={sc.statCard}>
            <div style={sc.statLbl}>{c.label}</div>
            <div style={{ ...sc.statVal, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Daily activity */}
      <div style={sc.card}>
        <div style={sc.title}>Daily Patrols — Last 14 Days</div>
        <div style={{ display:'flex', gap:'4px', alignItems:'flex-end', height:'80px' }}>
          {dailyData.map((d,i)=>(
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
              <div style={{ width:'100%', borderRadius:'3px 3px 0 0', background: d.value>0?'var(--accent)':'var(--border)', height:`${d.value>0?Math.max(8,Math.round((d.value/maxDaily)*70)):4}px`, transition:'height 400ms ease' }} title={`${d.label}: ${d.value}`}/>
              <div style={{ fontSize:'9px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', writingMode:'vertical-rl', transform:'rotate(180deg)', height:'36px', overflow:'hidden' }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        <div style={sc.card}>
          <div style={sc.title}>Hours by Officer</div>
          {topEmp.length > 0 ? <Bar data={topEmp} color="var(--accent)"/> : <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No data.</div>}
        </div>
        <div style={sc.card}>
          <div style={sc.title}>Patrols by Site</div>
          {topSites.length > 0 ? <Bar data={topSites} color="var(--color-info)"/> : <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No data.</div>}
        </div>
      </div>
    </div>
  )
}
