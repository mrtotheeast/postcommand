import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'

// Fix Leaflet's broken default icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeIcon(active, count) {
  const color  = active ? '#c8a84b' : '#3d4460'
  const border = active ? '#a8841e' : '#252838'
  const text   = active ? '#0d0f14' : '#7a8299'
  const html = `
    <div style="position:relative;width:32px;height:32px">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:2px solid ${border};
        display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;
        font-size:13px;font-weight:700;color:${text};box-shadow:0 2px 8px rgba(0,0,0,0.5);">
        ${active ? count : ''}
      </div>
      ${active ? `<div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);
        width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
        border-top:6px solid ${color};"></div>` : ''}
    </div>`
  return L.divIcon({ html, className: '', iconSize: [32, active ? 38 : 32], iconAnchor: [16, active ? 38 : 16], popupAnchor: [0, active ? -38 : -16] })
}

const s = {
  shell:    { display: 'flex', height: '100%', overflow: 'hidden' },
  sidebar:  { width: '300px', minWidth: '300px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sideHead: { padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  sideTitle:{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '2px', color: 'var(--text-primary)', lineHeight: 1 },
  sideSub:  { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' },
  sideBody: { flex: 1, overflowY: 'auto', padding: '10px 0' },
  siteRow:  { padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 150ms ease' },
  siteRowHov:{ background: 'var(--bg-card)' },
  siteName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  siteCity: { fontSize: '11px', color: 'var(--text-muted)' },
  officerList:{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  officerPill:{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' },
  dot:      { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0 },
  badge:    { fontSize: '10px', fontFamily: 'var(--font-condensed)', letterSpacing: '0.5px', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 },
  badgeOn:  { background: 'rgba(200,168,75,0.18)', color: 'var(--accent)' },
  badgeOff: { background: 'var(--border)', color: 'var(--text-muted)' },
  statBar:  { display: 'flex', gap: '0', borderTop: '1px solid var(--border)', flexShrink: 0 },
  stat:     { flex: 1, padding: '12px 14px', textAlign: 'center', borderRight: '1px solid var(--border)' },
  statVal:  { fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '1px', lineHeight: 1 },
  statLbl:  { fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)', marginTop: '2px' },
  mapWrap:  { flex: 1, position: 'relative' },
  loading:  { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', zIndex: 10, fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '3px', color: 'var(--accent)' },
  refreshBtn:{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0 14px', height: '38px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-condensed)', fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '1px', cursor: 'pointer', boxShadow: 'var(--shadow-card)' },
}

const MAP_TILES  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const MAP_TILES_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const MAP_CENTER = [38.9, -77.0]

function makeOfficerIcon(initials, recencyColor) {
  const bg = recencyColor === 'green' ? '#2e7d32' : recencyColor === 'amber' ? '#e65100' : '#555'
  const html = `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:2px solid rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${initials}</div>`
  return L.divIcon({ html, className:'', iconSize:[34,34], iconAnchor:[17,17], popupAnchor:[0,-17] })
}

export default function LiveMap() {
  const { profile } = useAuth()
  const [sites, setSites]               = useState([])
  const [active, setActive]             = useState([])
  const [employees, setEmployees]       = useState([])
  const [empLocations, setEmpLocations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const mapRef = useRef(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const since5min = new Date(Date.now() - 5*60000).toISOString()
    const since30min = new Date(Date.now() - 30*60000).toISOString()
    const [{ data: siteData }, { data: tsData }, { data: empData }, { data: locData }] = await Promise.all([
      supabase.from('site').select('id,name,city,state,latitude,longitude,address').eq('company_id', profile.company_id),
      supabase.from('timesheet').select('id,employee_id,site_id,clock_in').eq('company_id', profile.company_id).is('clock_out', null).eq('date', today),
      supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', profile.company_id).eq('status', 'active'),
      supabase.from('employee_location').select('*').eq('company_id', profile.company_id).gte('recorded_at', since30min).order('recorded_at', {ascending:false}),
    ])
    setSites(siteData || [])
    setActive(tsData || [])
    setEmployees(empData || [])
    // Keep only the most recent location per employee
    const latestByEmp = {}
    for (const loc of (locData||[])) {
      if (!latestByEmp[loc.employee_id]) latestByEmp[loc.employee_id] = loc
    }
    setEmpLocations(Object.values(latestByEmp))
    setLoading(false)
  }

  const empMap = Object.fromEntries((employees || []).map(e => [e.id, e]))

  const sitesWithOfficers = (sites || []).map(site => {
    const onDuty = (active || []).filter(ts => ts.site_id === site.id).map(ts => ({ ...ts, employee: empMap[ts.employee_id] }))
    return { ...site, onDuty }
  })

  const totalOnDuty = active.length
  const activeSites = sitesWithOfficers.filter(s => s.onDuty.length > 0).length

  function flyTo(site) {
    setSelected(site.id)
    if (mapRef.current && site.latitude && site.longitude) {
      mapRef.current.flyTo([site.latitude, site.longitude], 15, { duration: 0.8 })
    }
  }

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sideHead}>
          <div style={s.sideTitle}>LIVE MAP</div>
          <div style={s.sideSub}>{totalOnDuty} officer{totalOnDuty !== 1 ? 's' : ''} on duty · {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>

        <div style={s.sideBody}>
          {sitesWithOfficers.sort((a, b) => b.onDuty.length - a.onDuty.length).map(site => {
            const isSelected = selected === site.id
            return (
              <div key={site.id}
                style={{ ...s.siteRow, ...(isSelected ? { background: 'var(--accent-bg)', borderLeft: '3px solid var(--accent)' } : {}) }}
                onClick={() => flyTo(site)}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={s.siteName}>{site.name}</div>
                  <span style={{ ...s.badge, ...(site.onDuty.length > 0 ? s.badgeOn : s.badgeOff) }}>
                    {site.onDuty.length > 0 ? `${site.onDuty.length} ON DUTY` : 'EMPTY'}
                  </span>
                </div>
                <div style={s.siteCity}>{site.city}, {site.state}</div>
                {site.onDuty.length > 0 && (
                  <div style={s.officerList}>
                    {site.onDuty.map(ts => (
                      <div key={ts.id} style={s.officerPill}>
                        <div style={s.dot} />
                        <span>{ts.employee ? `${ts.employee.first_name} ${ts.employee.last_name}` : 'Unknown'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          · {new Date(ts.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={s.statBar}>
          <div style={{ ...s.stat, borderRight: '1px solid var(--border)' }}>
            <div style={{ ...s.statVal, color: 'var(--accent)' }}>{totalOnDuty}</div>
            <div style={s.statLbl}>On Duty</div>
          </div>
          <div style={{ ...s.stat, borderRight: '1px solid var(--border)' }}>
            <div style={{ ...s.statVal, color: 'var(--color-success)' }}>{activeSites}</div>
            <div style={s.statLbl}>Active Sites</div>
          </div>
          <div style={{ ...s.stat, borderRight: 'none' }}>
            <div style={{ ...s.statVal, color: 'var(--text-secondary)' }}>{sites.length}</div>
            <div style={s.statLbl}>Total Sites</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={s.mapWrap}>
        {loading && <div style={s.loading}>LOADING MAP...</div>}
        <button style={s.refreshBtn} onClick={load}>
          <Icon name="refresh-cw" size={13} />REFRESH
        </button>
        <MapContainer
          center={MAP_CENTER}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          ref={mapRef}
          zoomControl={true}
        >
          <TileLayer url={MAP_TILES} attribution={MAP_TILES_ATTR} />
          {/* Individual officer GPS markers from employee_location */}
          {empLocations.filter(loc => loc.latitude && loc.longitude).map(loc => {
            const emp = empMap[loc.employee_id]
            if (!emp) return null
            const minsOld = (Date.now() - new Date(loc.recorded_at)) / 60000
            const color = minsOld < 5 ? 'green' : minsOld < 15 ? 'amber' : 'gray'
            const initials = `${emp.first_name?.[0]||''}${emp.last_name?.[0]||''}`.toUpperCase()
            return (
              <Marker key={`loc-${loc.employee_id}`} position={[loc.latitude, loc.longitude]} icon={makeOfficerIcon(initials, color)}>
                <Popup>
                  <div style={{ fontFamily:'Barlow, sans-serif', minWidth:'160px' }}>
                    <div style={{ fontWeight:700, marginBottom:'4px' }}>{emp.first_name} {emp.last_name}</div>
                    <div style={{ fontSize:'12px', color:'#888' }}>{emp.position_title || emp.role}</div>
                    <div style={{ fontSize:'11px', color: color==='green'?'#2e7d32':color==='amber'?'#e65100':'#888', marginTop:'4px' }}>
                      GPS updated {Math.round(minsOld)}m ago
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          {sitesWithOfficers.filter(s => s.latitude && s.longitude).map(site => (
            <Marker
              key={site.id}
              position={[site.latitude, site.longitude]}
              icon={makeIcon(site.onDuty.length > 0, site.onDuty.length)}
              eventHandlers={{ click: () => flyTo(site) }}
            >
              <Popup>
                <div style={{ fontFamily: 'Barlow, sans-serif', minWidth: '180px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>{site.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{site.city}, {site.state}</div>
                  {site.onDuty.length === 0
                    ? <div style={{ fontSize: '12px', color: '#888' }}>No officers on duty</div>
                    : site.onDuty.map(ts => (
                        <div key={ts.id} style={{ fontSize: '12px', padding: '3px 0', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#3aaa6a', display: 'inline-block', flexShrink: 0 }} />
                          {ts.employee ? `${ts.employee.first_name} ${ts.employee.last_name}` : 'Unknown'}
                        </div>
                      ))
                  }
                </div>
              </Popup>
              {site.onDuty.length > 0 && (
                <Circle center={[site.latitude, site.longitude]} radius={150} pathOptions={{ color: '#c8a84b', fillColor: '#c8a84b', fillOpacity: 0.08, weight: 1, dashArray: '4 4' }} />
              )}
            </Marker>
          ))}
        </MapContainer>

        <style>{`
          .leaflet-container { background: #e8f4f8; }
          .leaflet-popup-content-wrapper { background: #1a1d2a; border: 1px solid #252838; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); color: #f0f2f8; }
          .leaflet-popup-tip { background: #1a1d2a; }
          .leaflet-popup-close-button { color: #7a8299 !important; }
          .leaflet-control-zoom a { background: #1a1d2a !important; color: #c8a84b !important; border-color: #252838 !important; }
          .leaflet-control-attribution { background: rgba(13,15,20,0.7) !important; color: #3d4460 !important; font-size: 10px !important; }
          .leaflet-control-attribution a { color: #3d4460 !important; }
        `}</style>
      </div>
    </div>
  )
}
