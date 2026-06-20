import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import Icon from '../../components/ui/Icon'
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TABS = [
  { id:'overview',  label:'Overview',  icon:'grid' },
  { id:'coverage',  label:'Coverage',  icon:'map-pin' },
  { id:'schedule',  label:'Schedule',  icon:'calendar' },
  { id:'requests',  label:'Requests',  icon:'send' },
  { id:'incidents', label:'Incidents', icon:'file-check' },
  { id:'messages',  label:'Messages',  icon:'message-circle' },
  { id:'invoices',  label:'Invoices',  icon:'file-text' },
]

const s = {
  shell:    { display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg-base)', flexDirection:'column' },
  topbar:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', height:'58px', minHeight:'58px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  logo:     { fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'3px', color:'var(--accent)', lineHeight:1 },
  logoSub:  { fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' },
  userPill: { display:'flex', alignItems:'center', gap:'10px' },
  avatar:   { width:'32px', height:'32px', borderRadius:'50%', background:'var(--accent)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' },
  userName: { fontSize:'13px', fontWeight:600, color:'var(--text-primary)' },
  signOut:  { background:'transparent', border:'none', color:'var(--text-muted)', padding:'6px', borderRadius:'var(--radius-sm)', cursor:'pointer', display:'flex', alignItems:'center' },
  iconBtn:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', minHeight:'36px', minWidth:'36px', padding:'0 8px', gap:'6px', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' },
  body:     { flex:1, display:'flex', overflow:'hidden', flexDirection:'column' },
  tabnav:   { display:'flex', gap:'2px', padding:'0 24px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' },
  tab:      { display:'flex', alignItems:'center', gap:'7px', padding:'12px 16px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease', whiteSpace:'nowrap' },
  tabAct:   { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  content:  { flex:1, overflowY:'auto', overflowX:'hidden' },
  page:     { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'12px', marginBottom:'24px' },
  statCard: { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'16px' },
  statLbl:  { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  statVal:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'1px', lineHeight:1 },
  statSub:  { fontSize:'11px', color:'var(--text-muted)', marginTop:'3px' },
  card:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'16px' },
  cardTitle:{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' },
  row:      { display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
  dot:      { width:'8px', height:'8px', borderRadius:'50%', flexShrink:0 },
  mapWrap:  { height:'100%', position:'relative' },
  badge:    { display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' },
}

export default function ClientPortal() {
  const { profile, signOut } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [tab, setTab]             = useState('overview')
  const [sites, setSites]         = useState([])
  const [activeTS, setActiveTS]   = useState([])
  const [incidents, setIncidents] = useState([])
  const [shifts, setShifts]       = useState([])
  const [messages, setMessages]   = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [{ data: siteData }, { data: tsData }, { data: incData }, { data: shiftData }, { data: empData }] = await Promise.all([
        supabase.from('site').select('id,name,city,state,latitude,longitude,geofence_radius,is_active').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('timesheet').select('id,employee_id,site_id,clock_in').eq('company_id', profile.company_id).is('clock_out', null).eq('date', today),
        supabase.from('incident_report').select('id,cad_number,incident_type,status,created_at,site_id,summary').eq('company_id', profile.company_id).in('status', ['approved','reviewed']).gte('created_at', weekAgo).order('created_at', { ascending:false }).limit(20),
        supabase.from('shift').select('id,employee_id,site_id,start_time,end_time,position_title,status').eq('company_id', profile.company_id).eq('status','published').gte('start_time', today + 'T00:00:00').order('start_time').limit(30),
        supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', profile.company_id).eq('status','active'),
      ])
      setSites(siteData || [])
      setActiveTS(tsData || [])
      setIncidents(incData || [])
      setShifts(shiftData || [])
      setEmployees(empData || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  const empMap    = Object.fromEntries((employees || []).map(e => [e.id, e]))
  const siteMap   = Object.fromEntries((sites || []).map(s => [s.id, s]))
  const onDutyMap = {}
  for (const ts of activeTS) { onDutyMap[ts.site_id] = (onDutyMap[ts.site_id] || []).concat(ts) }
  const totalOnDuty = activeTS.length
  const staffedSites = Object.keys(onDutyMap).length

  const initials = profile ? `${profile.first_name?.[0]??''}${profile.last_name?.[0]??''}`.toUpperCase() : 'C'

  return (
    <div style={s.shell}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Top bar */}
      <header style={s.topbar}>
        <div>
          <div style={s.logo}>POST<span style={{ color:'var(--text-primary)' }}>COMMAND</span></div>
          <div style={s.logoSub}>Client Portal · {profile?.company_slug?.toUpperCase()}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <button style={s.iconBtn} onClick={toggleTheme}>
            <Icon name={isDark ? 'sun' : 'moon'} size={15} />
          </button>
          <div style={s.userPill}>
            <div style={s.avatar}>{initials}</div>
            <div style={s.userName}>{profile?.first_name} {profile?.last_name}</div>
            <button style={s.signOut} onClick={signOut} title="Sign out">
              <Icon name="log-out" size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav style={s.tabnav}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabAct : {}) }} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </nav>

      <div style={s.body}>
        <div style={s.content}>
          {loading ? (
            <div style={{ padding:'40px', fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', color:'var(--accent)' }}>LOADING...</div>
          ) : (
            <>
              {tab === 'overview'  && <OverviewTab sites={sites} onDutyMap={onDutyMap} totalOnDuty={totalOnDuty} staffedSites={staffedSites} incidents={incidents} shifts={shifts} siteMap={siteMap} empMap={empMap} profile={profile} companyId={profile?.company_id} onViewInvoices={() => setTab('invoices')} />}
              {tab === 'coverage'  && <CoverageTab sites={sites} onDutyMap={onDutyMap} empMap={empMap} />}
              {tab === 'schedule'  && <ScheduleTab shifts={shifts} sites={sites} siteMap={siteMap} empMap={empMap} />}
              {tab === 'incidents' && <IncidentsTab incidents={incidents} siteMap={siteMap} />}
              {tab === 'requests'  && <ServiceRequestsTab companyId={profile?.company_id} profile={profile} sites={sites} />}
              {tab === 'messages'  && <MessagesTab companyId={profile?.company_id} profile={profile} />}
              {tab === 'invoices'  && <InvoicesTab companyId={profile?.company_id} profile={profile} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ sites, onDutyMap, totalOnDuty, staffedSites, incidents, shifts, siteMap, empMap, profile, companyId, onViewInvoices }) {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
  const upcomingShifts = shifts.filter(sh => new Date(sh.start_time) > new Date()).slice(0, 5)
  const recentIncidents = incidents.slice(0, 4)
  const [invoiceSummary, setInvoiceSummary] = useState(null)

  useEffect(() => {
    if (!companyId || !profile?.email) return
    async function loadBalance() {
      const { data: contact } = await supabase.from('client_contact').select('client_id').eq('email', profile.email).eq('company_id', companyId).maybeSingle()
      if (!contact?.client_id) return
      const { data: invs } = await supabase.from('invoice').select('total').eq('company_id', companyId).eq('client_id', contact.client_id).neq('status','paid').neq('status','void').neq('status','cancelled')
      if (invs && invs.length > 0) {
        setInvoiceSummary({ count: invs.length, amount: invs.reduce((a,b) => a+(b.total||0), 0) })
      }
    }
    loadBalance()
  }, [companyId, profile?.email])

  const fmtMoney = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0)

  return (
    <div style={s.page}>
      <h2 style={s.heading}>SECURITY OVERVIEW</h2>
      <p style={s.sub}>{today}</p>

      {invoiceSummary && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'14px 18px', marginBottom:'20px', background:'rgba(200,168,75,0.1)', border:'1px solid rgba(200,168,75,0.35)', borderRadius:'var(--radius-md)', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <Icon name="alert-circle" size={16} color="#c8a84b" />
            <span style={{ fontSize:'13px', color:'var(--text-primary)' }}>
              You have <strong>{invoiceSummary.count}</strong> outstanding invoice{invoiceSummary.count !== 1 ? 's' : ''} totaling <strong style={{ color:'#c8a84b' }}>{fmtMoney(invoiceSummary.amount)}</strong>.
            </span>
          </div>
          <button onClick={onViewInvoices} style={{ background:'transparent', border:'1px solid rgba(200,168,75,0.5)', color:'#c8a84b', borderRadius:'var(--radius-sm)', padding:'6px 14px', fontSize:'12px', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'1px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            VIEW INVOICES →
          </button>
        </div>
      )}

      <div style={s.statsRow}>
        {[
          { label:'Officers On Duty', value: totalOnDuty, color:'var(--accent)', sub:'Right now' },
          { label:'Sites Staffed', value: `${staffedSites}/${sites.length}`, color:'var(--color-success)', sub:'Active coverage' },
          { label:'Incidents (7d)', value: incidents.length, color: incidents.length > 0 ? 'var(--color-warning)' : 'var(--color-success)', sub:'Reviewed or approved' },
          { label:'Upcoming Shifts', value: upcomingShifts.length, color:'var(--color-info)', sub:'Today & tomorrow' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
            <div style={s.statSub}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Site coverage grid */}
      <div style={{ ...s.card }}>
        <div style={s.cardTitle}>Site Coverage — Now</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px' }}>
          {sites.map(site => {
            const officers = onDutyMap[site.id] || []
            return (
              <div key={site.id} style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', padding:'14px', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{site.name}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{site.city}, {site.state}</div>
                <div style={{ marginTop:'4px' }}>
                  {officers.length > 0 ? (
                    <span style={{ ...s.badge, background:'var(--accent-bg)', color:'var(--accent)' }}>
                      <Icon name="users" size={10} />{officers.length} on duty
                    </span>
                  ) : (
                    <span style={{ ...s.badge, background:'var(--border)', color:'var(--text-muted)' }}>
                      Unattended
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent incidents */}
      {recentIncidents.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Recent Incidents</div>
          {recentIncidents.map(inc => (
            <div key={inc.id} style={s.row}>
              <div style={{ ...s.dot, background: inc.status === 'approved' ? 'var(--color-success)' : 'var(--color-warning)' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{inc.incident_type}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                  {inc.cad_number} · {siteMap[inc.site_id]?.name ?? 'Unknown Site'} · {new Date(inc.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                </div>
              </div>
              <span style={{ ...s.badge, background: inc.status === 'approved' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: inc.status === 'approved' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {inc.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Coverage (Live Map) ───────────────────────────────────────────────────────

function CoverageTab({ sites, onDutyMap, empMap }) {
  const sitesWithGeo = sites.filter(s => s.latitude && s.longitude)
  const center = sitesWithGeo.length > 0
    ? [Number(sitesWithGeo[0].latitude), Number(sitesWithGeo[0].longitude)]
    : [38.9, -77.0]

  function makeIcon(count) {
    const color  = count > 0 ? '#c8a84b' : '#3d4460'
    const border = count > 0 ? '#a8841e' : '#252838'
    const text   = count > 0 ? '#0d0f14' : '#7a8299'
    return L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:${text};box-shadow:0 2px 8px rgba(0,0,0,0.5);">${count > 0 ? count : ''}</div>`,
      className:'', iconSize:[30,30], iconAnchor:[15,15], popupAnchor:[0,-15],
    })
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', color:'var(--text-primary)' }}>LIVE COVERAGE</span>
        <span style={{ fontSize:'12px', color:'var(--text-muted)', marginLeft:'12px' }}>
          {Object.keys(onDutyMap).length} sites staffed · {Object.values(onDutyMap).reduce((a,b) => a + b.length, 0)} officers on duty
        </span>
      </div>
      <div style={{ flex:1 }}>
        <MapContainer center={center} zoom={11} style={{ width:'100%', height:'100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {sitesWithGeo.map(site => {
            const officers = onDutyMap[site.id] || []
            return (
              <Marker key={site.id} position={[Number(site.latitude), Number(site.longitude)]} icon={makeIcon(officers.length)}>
                <Popup>
                  <div style={{ fontFamily:'Barlow, sans-serif', minWidth:'160px' }}>
                    <div style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'13px', fontWeight:700, letterSpacing:'1px', marginBottom:'6px' }}>{site.name}</div>
                    <div style={{ fontSize:'12px', color:'#888', marginBottom:'6px' }}>{site.city}, {site.state}</div>
                    {officers.length === 0
                      ? <div style={{ fontSize:'12px', color:'#888' }}>No officers on duty</div>
                      : <div style={{ fontSize:'12px', color:'#3aaa6a', fontWeight:600 }}>{officers.length} officer{officers.length !== 1 ? 's' : ''} on duty</div>
                    }
                  </div>
                </Popup>
                {officers.length > 0 && (
                  <Circle center={[Number(site.latitude), Number(site.longitude)]} radius={site.geofence_radius || 150} pathOptions={{ color:'#c8a84b', fillColor:'#c8a84b', fillOpacity:0.06, weight:1, dashArray:'4 4' }} />
                )}
              </Marker>
            )
          })}
        </MapContainer>
        <style>{`
          .leaflet-container{background:#0d0f14}
          .leaflet-popup-content-wrapper{background:#1a1d2a;border:1px solid #252838;border-radius:8px;color:#f0f2f8}
          .leaflet-popup-tip{background:#1a1d2a}
          .leaflet-popup-close-button{color:#7a8299!important}
          .leaflet-control-zoom a{background:#1a1d2a!important;color:#c8a84b!important;border-color:#252838!important}
        `}</style>
      </div>
    </div>
  )
}

// ── Schedule ─────────────────────────────────────────────────────────────────

function ScheduleTab({ shifts, siteMap, empMap }) {
  const grouped = {}
  for (const sh of shifts) {
    const day = sh.start_time.slice(0, 10)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(sh)
  }
  const days = Object.keys(grouped).sort()

  function fmt(ts) { return new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) }

  return (
    <div style={s.page}>
      <h2 style={s.heading}>SCHEDULE</h2>
      <p style={s.sub}>Published shifts for your sites over the next 14 days.</p>
      {days.length === 0 ? (
        <div style={{ ...s.card, textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>No published shifts found.</div>
      ) : days.map(day => (
        <div key={day} style={{ marginBottom:'18px' }}>
          <div style={{ fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'8px' }}>
            {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </div>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            {grouped[day].map((sh, i) => {
              const emp  = empMap[sh.employee_id]
              const site = siteMap[sh.site_id]
              return (
                <div key={sh.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 16px', borderBottom: i < grouped[day].length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <Icon name="clock" size={13} color="var(--text-muted)" />
                  <div style={{ minWidth:'120px', fontSize:'13px', color:'var(--accent)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>
                    {fmt(sh.start_time)} — {fmt(sh.end_time)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>
                      {emp ? `${emp.first_name} ${emp.last_name}` : 'Officer'}
                    </div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{site?.name ?? 'Unknown Site'}</div>
                  </div>
                  {sh.position_title && <div style={{ fontSize:'11px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{sh.position_title}</div>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Incidents ─────────────────────────────────────────────────────────────────

function IncidentsTab({ incidents, siteMap }) {
  const [selected, setSelected] = useState(null)

  if (incidents.length === 0) {
    return (
      <div style={s.page}>
        <h2 style={s.heading}>INCIDENT REPORTS</h2>
        <p style={s.sub}>Reviewed or approved reports from the last 7 days.</p>
        <div style={{ ...s.card, textAlign:'center', padding:'48px' }}>
          <Icon name="shield-check" size={28} color="var(--color-success)" />
          <div style={{ marginTop:'12px', fontSize:'14px', color:'var(--color-success)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>NO INCIDENTS IN THE LAST 7 DAYS</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <h2 style={s.heading}>INCIDENT REPORTS</h2>
      <p style={s.sub}>{incidents.length} reviewed or approved report{incidents.length !== 1 ? 's' : ''} in the last 7 days.</p>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
        {incidents.map((inc, i) => (
          <div key={inc.id}
            style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom: i < incidents.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 150ms ease' }}
            onClick={() => setSelected(selected?.id === inc.id ? null : inc)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ ...s.dot, background: inc.status === 'approved' ? 'var(--color-success)' : 'var(--color-warning)', width:'10px', height:'10px' }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{inc.incident_type}</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>
                {inc.cad_number} · {siteMap[inc.site_id]?.name ?? 'Unknown Site'} · {new Date(inc.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
              </div>
              {selected?.id === inc.id && inc.summary && (
                <div style={{ marginTop:'10px', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, paddingTop:'10px', borderTop:'1px solid var(--border)' }}>{inc.summary}</div>
              )}
            </div>
            <Icon name={selected?.id === inc.id ? 'chevron-up' : 'chevron-down'} size={14} color="var(--text-muted)" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Messages ─────────────────────────────────────────────────────────────────

// ── Service Requests Tab ──────────────────────────────────────────────────────

const SR_TYPES    = ['Additional Coverage', 'Schedule Change', 'Emergency Response', 'Site Inspection', 'Equipment Issue', 'Personnel Complaint', 'Event Security', 'Other']
const SR_PRIORITY = ['Normal', 'Urgent', 'Critical']
const SR_STATUS   = { pending:{bg:'var(--color-warning-bg)',color:'var(--color-warning)',label:'Pending'}, acknowledged:{bg:'var(--color-info-bg)',color:'var(--color-info)',label:'Acknowledged'}, resolved:{bg:'var(--color-success-bg)',color:'var(--color-success)',label:'Resolved'} }

function ServiceRequestsTab({ companyId, profile, sites }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ request_type:'Additional Coverage', priority:'Normal', site_id:'', description:'', preferred_date:'' })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => { if (companyId) load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('service_request').select('*').eq('company_id', companyId).order('created_at', { ascending:false })
      setRequests(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function submit() {
    if (!form.description.trim()) return
    setSaving(true)
    await supabase.from('service_request').insert({ company_id:companyId, request_type:form.request_type, priority:form.priority, site_id:form.site_id||null, description:form.description.trim(), preferred_date:form.preferred_date||null, status:'pending', submitted_by:profile?.email })
    setSaving(false); setSaved(true); setShowNew(false)
    setForm({ request_type:'Additional Coverage', priority:'Normal', site_id:'', description:'', preferred_date:'' })
    load(); setTimeout(() => setSaved(false), 3000)
  }

  const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const foc = e => { e.target.style.borderColor='var(--border-focus)' }
  const blr = e => { e.target.style.borderColor='var(--border)' }

  return (
    <div style={s.page}>
      <h2 style={s.heading}>SERVICE REQUESTS</h2>
      <p style={s.sub}>Submit requests for additional coverage, schedule changes, or other service needs.</p>

      {saved && <div style={{ ...s.card, background:'var(--color-success-bg)', border:'1px solid rgba(58,170,106,0.3)', padding:'14px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'10px', color:'var(--color-success)', fontSize:'13px' }}><Icon name="check-circle" size={15}/>Request submitted. Our team will acknowledge within 24 hours.</div>}

      <div style={{ marginBottom:'20px' }}>
        <button style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }} onClick={() => setShowNew(v=>!v)}>
          <Icon name={showNew?'x':'plus'} size={16}/>{showNew ? 'CANCEL' : 'NEW REQUEST'}
        </button>
      </div>

      {showNew && (
        <div style={{ ...s.card, marginBottom:'20px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'16px' }}>New Service Request</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div><div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Request Type</div>
              <select style={{...inp,cursor:'pointer'}} value={form.request_type} onChange={e=>setForm(p=>({...p,request_type:e.target.value}))}>{SR_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            </div>
            <div><div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Priority</div>
              <select style={{...inp,cursor:'pointer'}} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>{SR_PRIORITY.map(p=><option key={p}>{p}</option>)}</select>
            </div>
            <div><div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Site (optional)</div>
              <select style={{...inp,cursor:'pointer'}} value={form.site_id} onChange={e=>setForm(p=>({...p,site_id:e.target.value}))}>
                <option value="">Any / Not site-specific</option>
                {(sites||[]).map(sv=><option key={sv.id} value={sv.id}>{sv.name}</option>)}
              </select>
            </div>
            <div><div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Preferred Date</div>
              <input type="date" style={inp} value={form.preferred_date} onChange={e=>setForm(p=>({...p,preferred_date:e.target.value}))} onFocus={foc} onBlur={blr}/>
            </div>
          </div>
          <div style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Description *</div>
            <textarea style={{...inp,minHeight:'80px',resize:'vertical',lineHeight:1.6}} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="Describe your request in detail..."/>
          </div>
          <button style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:(!form.description.trim()||saving)?0.6:1 }} onClick={submit} disabled={!form.description.trim()||saving}>
            <Icon name="send" size={14}/>{saving?'SUBMITTING...':'SUBMIT REQUEST'}
          </button>
        </div>
      )}

      {loading ? <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div> : requests.length === 0 ? (
        <div style={{ ...s.card, textAlign:'center', padding:'40px', color:'var(--text-muted)' }}>No service requests submitted yet.</div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          {requests.map((r,i) => {
            const st = SR_STATUS[r.status] || SR_STATUS.pending
            const prioColor = r.priority==='Critical'?'var(--color-danger)':r.priority==='Urgent'?'var(--color-warning)':'var(--text-muted)'
            return (
              <div key={r.id} style={{ display:'flex', alignItems:'flex-start', gap:'14px', padding:'16px 18px', borderBottom:i<requests.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{r.request_type}</div>
                    <span style={{ fontSize:'10px', color:prioColor, fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px' }}>{r.priority.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'6px' }}>
                    {new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    {r.preferred_date ? ` · Preferred: ${r.preferred_date}` : ''}
                  </div>
                  <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.5 }}>{r.description}</div>
                </div>
                <span style={{ ...s.badge, background:st.bg, color:st.color, flexShrink:0 }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MessagesTab({ companyId, profile }) {
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages]  = useState([])
  const [input, setInput]        = useState('')
  const [sending, setSending]    = useState(false)
  const [employee, setEmployee]  = useState(null)

  useEffect(() => {
    if (!companyId) return
    Promise.all([
      supabase.from('message').select('channel_id').eq('company_id', companyId).then(({ data }) => {
        const unique = [...new Set((data||[]).map(m => m.channel_id))]
        setChannels(unique.map(id => ({ id, name: id })))
        if (unique.length > 0 && !activeChannel) setActiveChannel(unique[0])
      }),
      supabase.from('employee').select('id').eq('user_id', profile.id).single().then(({ data }) => setEmployee(data)),
    ])
  }, [companyId])

  useEffect(() => {
    if (!activeChannel || !companyId) return
    supabase.from('message').select('*').eq('company_id', companyId).eq('channel_id', activeChannel).order('created_at').limit(50)
      .then(({ data }) => setMessages(data || []))
    const channel = supabase.channel(`client-chat-${activeChannel}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'message', filter:`channel_id=eq.${activeChannel}` }, payload => {
        setMessages(prev => [...prev, payload.new])
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeChannel, companyId])

  async function sendMessage() {
    if (!input.trim() || !employee || sending) return
    setSending(true)
    await supabase.from('message').insert({
      company_id: companyId,
      channel_id: activeChannel,
      sender_id: employee.id,
      content: input.trim(),
      message_type: 'direct',
    })
    setInput('')
    setSending(false)
  }

  const channelLabel = (id) => {
    if (id === 'announcements') return 'Announcements'
    if (id === 'general') return 'General'
    return id.charAt(0).toUpperCase() + id.slice(1)
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Channel list */}
      <div style={{ width:'200px', borderRight:'1px solid var(--border)', padding:'12px 0', flexShrink:0, overflowY:'auto' }}>
        <div style={{ fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', padding:'8px 14px 4px', fontFamily:'var(--font-condensed)' }}>Channels</div>
        {channels.map(ch => (
          <button key={ch.id} style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'10px 14px', fontSize:'13px', color: activeChannel === ch.id ? 'var(--accent)' : 'var(--text-secondary)', background: activeChannel === ch.id ? 'var(--accent-bg)' : 'transparent', border:'none', borderLeft: activeChannel === ch.id ? '2px solid var(--accent)' : '2px solid transparent', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-body)' }} onClick={() => setActiveChannel(ch.id)}>
            <Icon name="hash" size={13} />{channelLabel(ch.id)}
          </button>
        ))}
        {channels.length === 0 && (
          <div style={{ padding:'14px', fontSize:'12px', color:'var(--text-muted)' }}>No messages yet.</div>
        )}
      </div>

      {/* Message view */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {activeChannel ? (
          <>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', flexShrink:0, fontSize:'14px', fontWeight:600, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'8px' }}>
              <Icon name="hash" size={14} color="var(--text-muted)" />{channelLabel(activeChannel)}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {messages.map(msg => {
                const isMe = employee && msg.sender_id === employee.id
                return (
                  <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap:'2px' }}>
                    <div style={{ maxWidth:'70%', background: isMe ? 'var(--accent)' : 'var(--bg-surface)', color: isMe ? 'var(--text-inverse)' : 'var(--text-primary)', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding:'10px 14px', fontSize:'13px', lineHeight:1.5, border: isMe ? 'none' : '1px solid var(--border)' }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'1px' }}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>No messages in this channel yet.</div>}
            </div>
            <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', display:'flex', gap:'10px', flexShrink:0 }}>
              <input
                style={{ flex:1, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', fontFamily:'var(--font-body)' }}
                placeholder="Type a message..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                style={{ background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity: !input.trim() || sending ? 0.5 : 1 }}
                onClick={sendMessage}
                disabled={!input.trim() || sending}
              >
                SEND
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding:'40px', color:'var(--text-muted)', fontSize:'14px' }}>Select a channel to view messages.</div>
        )}
      </div>
    </div>
  )
}

// ── Invoices ──────────────────────────────────────────────────────────────────

function InvoicesTab({ companyId, profile }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [hasClient, setHasClient] = useState(false)
  const [contactId, setContactId] = useState(null)
  const hasTrackedRef = useRef(false)

  useEffect(() => {
    if (!companyId || !profile?.email) { setLoading(false); return }
    const _timer = setTimeout(() => setLoading(false), 10_000)
    async function load() {
      try {
        const { data: contactData } = await supabase
          .from('client_contact')
          .select('id,client_id')
          .eq('email', profile.email)
          .eq('company_id', companyId)
          .maybeSingle()

        if (!contactData?.client_id) { return }
        setHasClient(true)
        setContactId(contactData.id || null)

        const { data } = await supabase
          .from('invoice')
          .select('id,invoice_number,issue_date,due_date,total,status,pdf_url')
          .eq('company_id', companyId)
          .eq('client_id', contactData.client_id)
          .order('created_at', { ascending: false })

        setInvoices(data || [])
      } finally {
        clearTimeout(_timer)
        setLoading(false)
      }
    }
    load()
    return () => clearTimeout(_timer)
  }, [companyId, profile?.email])

  // Log a view for each invoice when the client opens the Invoices tab (once per mount)
  useEffect(() => {
    if (hasTrackedRef.current || invoices.length === 0 || !contactId || !profile?.email) return
    hasTrackedRef.current = true
    const now = new Date().toISOString()
    for (const inv of invoices) {
      supabase.from('invoice_view_log').insert({
        invoice_id:        inv.id,
        company_id:        companyId,
        viewed_by_email:   profile.email,
        client_contact_id: contactId,
        viewed_at:         now,
      }).catch(() => {})
    }
  }, [invoices, contactId, profile?.email, companyId])

  const fmtMoney = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0)
  const fmtDate  = d => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'

  const outstanding = invoices.filter(i => !['paid','void'].includes(i.status)).reduce((a,b) => a+(b.total||0), 0)

  const STATUS_COLOR = {
    draft:    { bg:'var(--border)',              color:'var(--text-muted)' },
    sent:     { bg:'rgba(59,130,246,0.12)',      color:'#3b82f6' },
    paid:     { bg:'rgba(34,197,94,0.12)',       color:'#16a34a' },
    overdue:  { bg:'rgba(239,68,68,0.12)',       color:'#dc2626' },
    void:     { bg:'rgba(130,130,130,0.12)',     color:'#8899aa' },
    cancelled:{ bg:'rgba(130,130,130,0.12)',     color:'#8899aa' },
  }

  return (
    <div style={s.page}>
      <h2 style={s.heading}>INVOICES</h2>
      <p style={s.sub}>Your account balance and billing history.</p>

      {/* Outstanding balance */}
      <div style={{ ...s.statCard, textAlign:'center', marginBottom:'24px', padding:'28px' }}>
        <div style={s.statLbl}>Outstanding Balance</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'48px', letterSpacing:'2px', lineHeight:1, color: outstanding > 0 ? 'var(--accent)' : 'var(--color-success, #16a34a)' }}>
          {fmtMoney(outstanding)}
        </div>
        {outstanding === 0 && invoices.length > 0 && (
          <div style={{ fontSize:'12px', color:'var(--color-success, #16a34a)', marginTop:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            <Icon name="check-circle" size={13}/>All invoices paid
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>
      ) : invoices.length === 0 ? (
        <div style={{ ...s.card, textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
          {hasClient ? 'No invoices on file.' : 'No billing account linked to this email address.'}
        </div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          {invoices.map((inv, i) => {
            const st = STATUS_COLOR[inv.status] || STATUS_COLOR.draft
            return (
              <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px', borderBottom: i < invoices.length-1 ? '1px solid var(--border)' : 'none', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:'180px' }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'3px' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    <span>Issued: {fmtDate(inv.issue_date)}</span>
                    {inv.due_date && <span>Due: {fmtDate(inv.due_date)}</span>}
                  </div>
                </div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'18px', color:'var(--text-primary)', letterSpacing:'1px', flexShrink:0 }}>
                  {fmtMoney(inv.total)}
                </div>
                <span style={{ ...s.badge, background:st.bg, color:st.color, flexShrink:0 }}>
                  {inv.status?.toUpperCase()}
                </span>
                {inv.pdf_url ? (
                  <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => { supabase.from('invoice_view_log').insert({ invoice_id:inv.id, company_id:profile.company_id, viewed_by_email:profile.email, client_contact_id:contactId, viewed_at:new Date().toISOString() }).catch(()=>{}) }}
                    style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'6px 14px', background:'var(--accent)', color:'var(--text-inverse)', borderRadius:'var(--radius-sm)', fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'1px', textDecoration:'none', flexShrink:0 }}>
                    <Icon name="external-link" size={12}/>VIEW PDF
                  </a>
                ) : (
                  <div style={{ width:'85px' }}/>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
