import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const s = {
  page:      { padding:'24px', maxWidth:'1200px', animation:'fadeIn 200ms ease' },
  heading:   { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:       { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  stats:     { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'20px' },
  statCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
  statLbl:   { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
  statVal:   { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  toolbar:   { display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap', alignItems:'center' },
  search:    { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'200px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  select:    { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', fontFamily:'var(--font-body)', cursor:'pointer' },
  addBtn:    { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 },
  grid:      { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:'14px' },
  siteCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', cursor:'pointer', transition:'all 150ms ease', display:'flex', flexDirection:'column', gap:'10px' },
  cardTop:   { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px' },
  cardName:  { fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1.1 },
  cardAddr:  { fontSize:'12px', color:'var(--text-muted)', marginTop:'3px', lineHeight:1.4 },
  cardMeta:  { display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' },
  pill:      { display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  cardActions:{ display:'flex', gap:'6px', flexShrink:0 },
  iconBtn:   { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', width:'34px', height:'34px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 150ms ease', minHeight:'34px', minWidth:'34px' },
  // Modal
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' },
  modal:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'640px', boxShadow:'var(--shadow-modal)', flexShrink:0 },
  modalHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'22px' },
  modalTitle:{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)' },
  closeBtn:  { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' },
  row:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  row3:      { display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px', marginBottom:'12px' },
  field:     { display:'flex', flexDirection:'column', gap:'5px' },
  fieldFull: { display:'flex', flexDirection:'column', gap:'5px', marginBottom:'12px' },
  label:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' },
  input:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  textarea:  { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', resize:'vertical', minHeight:'70px', lineHeight:1.5 },
  saveBtn:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 24px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghostBtn:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  dangerBtn: { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  geocodeBtn:{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent-bg)', color:'var(--accent)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', whiteSpace:'nowrap' },
  sectionLbl:{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', margin:'18px 0 10px', borderBottom:'1px solid var(--border)', paddingBottom:'6px' },
  slider:    { accentColor:'var(--accent)', cursor:'pointer', width:'100%', height:'4px' },
  sliderVal: { fontFamily:'var(--font-display)', fontSize:'18px', color:'var(--accent)', letterSpacing:'1px', minWidth:'50px', textAlign:'right' },
  mapThumb:  { width:'100%', height:'180px', borderRadius:'var(--radius-sm)', overflow:'hidden', border:'1px solid var(--border)', marginTop:'8px' },
  // Detail panel
  detailOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'stretch', justifyContent:'flex-end' },
  detailPanel:   { width:'460px', maxWidth:'100vw', background:'var(--bg-card)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', animation:'slideIn 200ms ease' },
  detailHead:    { display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'22px 24px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  detailTitle:   { fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1.1 },
  detailBody:    { flex:1, overflowY:'auto', padding:'20px 24px' },
  detailTabs:    { display:'flex', gap:'2px', padding:'0 24px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  detailTab:     { padding:'10px 14px', fontSize:'12px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  detailTabAct:  { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  qrBox:         { display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'20px 0' },
  qrImg:         { width:'200px', height:'200px', borderRadius:'var(--radius-md)', border:'8px solid white', background:'white' },
}

// Draggable pin for map
function DraggableMarker({ position, onChange }) {
  useMapEvents({
    click(e) { onChange(e.latlng.lat, e.latlng.lng) },
  })
  if (!position.lat || !position.lng) return null
  return (
    <Marker
      position={[position.lat, position.lng]}
      draggable
      eventHandlers={{ dragend: e => { const p = e.target.getLatLng(); onChange(p.lat, p.lng) } }}
    />
  )
}

function qrUrl(siteId) {
  const data = encodeURIComponent(`https://postcommand.app/clockin?site=${siteId}`)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}&color=0d0f14&bgcolor=ffffff`
}

export default function SiteManagement() {
  const { profile } = useAuth()
  const canEdit = atLeast(profile?.role, 'lieutenant')
  const [sites, setSites]           = useState([])
  const [activeTSMap, setActiveTSMap] = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [editing, setEditing]       = useState(null)   // null | 'new' | site object
  const [detail, setDetail]         = useState(null)   // site object for detail panel
  const [detailTab, setDetailTab]   = useState('info')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: siteData }, { data: tsData }] = await Promise.all([
      supabase.from('site').select('*').eq('company_id', profile.company_id).order('name'),
      supabase.from('timesheet').select('site_id').eq('company_id', profile.company_id).is('clock_out', null).eq('date', today),
    ])
    setSites(siteData || [])
    const map = {}
    for (const ts of (tsData || [])) {
      map[ts.site_id] = (map[ts.site_id] || 0) + 1
    }
    setActiveTSMap(map)
    setLoading(false)
  }

  const filtered = useMemo(() => (sites || []).filter(s => {
    const q = search.toLowerCase()
    if (q && !s.name?.toLowerCase().includes(q) && !s.city?.toLowerCase().includes(q) && !s.address?.toLowerCase().includes(q)) return false
    if (filterActive === 'active'   && s.is_active === false) return false
    if (filterActive === 'inactive' && s.is_active !== false) return false
    return true
  }), [sites, search, filterActive])

  async function deleteSite(id) {
    await supabase.from('site').delete().eq('id', id)
    setConfirmDelete(null)
    setDetail(null)
    load()
  }

  const totalActive   = sites.filter(s => s.is_active !== false).length
  const totalWithStaff = Object.keys(activeTSMap).length
  const totalOfficers  = Object.values(activeTSMap).reduce((a, b) => a + b, 0)

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(6)].map((_,i) => <div key={i} className="skeleton" style={{ height:'130px', borderRadius:'10px', marginBottom:'12px' }} />)}</div>

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
        .site-card:hover{border-color:var(--accent-border)!important;background:var(--bg-card-hover)!important;}
        .icon-btn:hover{border-color:var(--accent-border)!important;color:var(--accent)!important;}
      `}</style>

      <h2 style={s.heading}>SITE MANAGEMENT</h2>
      <p style={s.sub}>Manage all job sites, geofences, QR codes, and coverage.</p>

      <div style={s.stats}>
        {[
          { label:'Total Sites',    value: sites.length,    color:'var(--text-primary)' },
          { label:'Active',         value: totalActive,     color:'var(--color-success)' },
          { label:'Staffed Now',    value: totalWithStaff,  color:'var(--accent)' },
          { label:'Officers On Duty', value: totalOfficers, color:'var(--color-info)' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search sites..." value={search} onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
        />
        <select style={s.select} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="all">All Sites</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {canEdit && (
          <button style={s.addBtn} onClick={() => setEditing('new')}>
            <Icon name="plus" size={15} />ADD SITE
          </button>
        )}
      </div>

      <div style={s.grid}>
        {filtered.map(site => {
          const onDuty  = activeTSMap[site.id] || 0
          const active  = site.is_active !== false
          return (
            <div key={site.id} className="site-card" style={s.siteCard} onClick={() => { setDetail(site); setDetailTab('info') }}>
              <div style={s.cardTop}>
                <div style={{ minWidth:0 }}>
                  <div style={s.cardName}>{site.name}</div>
                  <div style={s.cardAddr}>{site.address && `${site.address}, `}{site.city}, {site.state}</div>
                </div>
                {canEdit && (
                  <div style={s.cardActions} onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" style={s.iconBtn} title="Edit" onClick={() => setEditing(site)}>
                      <Icon name="edit-2" size={14} />
                    </button>
                    <button className="icon-btn" style={s.iconBtn} title="QR Code" onClick={() => { setDetail(site); setDetailTab('qr') }}>
                      <Icon name="grid" size={14} />
                    </button>
                    <button className="icon-btn" style={{ ...s.iconBtn, color:'var(--color-danger)' }} title="Delete" onClick={() => setConfirmDelete(site)}>
                      <Icon name="trash-2" size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div style={s.cardMeta}>
                <span style={{ ...s.pill, background: active ? 'var(--color-success-bg)' : 'var(--border)', color: active ? 'var(--color-success)' : 'var(--text-muted)' }}>
                  {active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {onDuty > 0 && (
                  <span style={{ ...s.pill, background:'var(--accent-bg)', color:'var(--accent)' }}>
                    <Icon name="users" size={10} />{onDuty} ON DUTY
                  </span>
                )}
                {site.geofence_radius && (
                  <span style={{ ...s.pill, background:'var(--bg-surface)', color:'var(--text-muted)' }}>
                    <Icon name="radio" size={10} />{site.geofence_radius}m
                  </span>
                )}
              </div>
              {site.latitude && site.longitude && (
                <div style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>
                  {Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>
            No sites match your search.
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {editing !== null && (
        <SiteFormModal
          site={editing === 'new' ? null : editing}
          companyId={profile.company_id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {/* Site detail panel */}
      {detail && (
        <DetailPanel
          site={detail}
          onDuty={activeTSMap[detail.id] || 0}
          tab={detailTab}
          setTab={setDetailTab}
          onClose={() => setDetail(null)}
          onEdit={() => { setDetail(null); setEditing(detail) }}
          canEdit={canEdit}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={s.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={{ ...s.modal, maxWidth:'400px' }} onClick={e => e.stopPropagation()}>
            <div style={{ ...s.modalTitle, marginBottom:'12px' }}>DELETE SITE</div>
            <p style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'22px' }}>
              Are you sure you want to delete <strong style={{ color:'var(--text-primary)' }}>{confirmDelete.name}</strong>? This cannot be undone and will affect shifts linked to this site.
            </p>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={s.dangerBtn} onClick={() => deleteSite(confirmDelete.id)}>
                <Icon name="trash-2" size={14} />DELETE
              </button>
              <button style={s.ghostBtn} onClick={() => setConfirmDelete(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Site Form Modal ──────────────────────────────────────────────────────────

const EMPTY_FORM = { name:'', address:'', city:'', state:'DC', zip_code:'', description:'', contact_name:'', contact_phone:'', latitude:'', longitude:'', geofence_radius:150, is_active:true }

function SiteFormModal({ site, companyId, onClose, onSaved }) {
  const [form, setForm]     = useState(site ? { ...EMPTY_FORM, ...site, geofence_radius: site.geofence_radius ?? 150, is_active: site.is_active !== false } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geoError, setGeoError]   = useState(null)
  const [mapPos, setMapPos]       = useState({ lat: site?.latitude ? Number(site.latitude) : null, lng: site?.longitude ? Number(site.longitude) : null })

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleMapPos(lat, lng) {
    setMapPos({ lat, lng })
    setF('latitude', lat)
    setF('longitude', lng)
  }

  async function geocode() {
    if (!form.address || !form.city) { setGeoError('Enter address and city first.'); return }
    setGeocoding(true); setGeoError(null)
    const q = encodeURIComponent(`${form.address}, ${form.city}, ${form.state}`)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
        headers: { 'User-Agent': 'PostCommand/1.0' }
      })
      const data = await res.json()
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        setF('latitude', lat); setF('longitude', lng)
        setMapPos({ lat, lng })
      } else {
        setGeoError('Address not found. Try a more specific address.')
      }
    } catch {
      setGeoError('Geocoding failed. Check your connection.')
    }
    setGeocoding(false)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      description: form.description.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      geofence_radius: Number(form.geofence_radius) || 150,
      is_active: form.is_active,
    }
    if (site?.id) {
      await supabase.from('site').update(payload).eq('id', site.id)
    } else {
      await supabase.from('site').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const inputF = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor = 'var(--border)' }

  const mapCenter = mapPos.lat && mapPos.lng ? [mapPos.lat, mapPos.lng] : [38.9, -77.0]

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>{site ? 'EDIT SITE' : 'NEW SITE'}</div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={s.sectionLbl}>Basic Info</div>
        <div style={s.fieldFull}>
          <div style={s.label}>Site Name *</div>
          <input style={s.input} value={form.name} onChange={e => setF('name', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="e.g. Capitol Hill Office Complex" />
        </div>
        <div style={s.fieldFull}>
          <div style={s.label}>Description</div>
          <textarea style={s.textarea} value={form.description} onChange={e => setF('description', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Site notes, SOP summary..." />
        </div>

        <div style={s.sectionLbl}>Location</div>
        <div style={{ ...s.row3, marginBottom:'8px' }}>
          <div style={s.field}>
            <div style={s.label}>Street Address</div>
            <input style={s.input} value={form.address} onChange={e => setF('address', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="123 Main St" />
          </div>
          <div style={s.field}>
            <div style={s.label}>City</div>
            <input style={s.input} value={form.city} onChange={e => setF('city', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Washington" />
          </div>
          <div style={s.field}>
            <div style={s.label}>State</div>
            <select style={{ ...s.input, cursor:'pointer' }} value={form.state} onChange={e => setF('state', e.target.value)}>
              {US_STATES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', marginBottom:'12px', flexWrap:'wrap' }}>
          <div style={{ ...s.field, flex:1 }}>
            <div style={s.label}>Latitude</div>
            <input style={s.input} value={form.latitude} onChange={e => setF('latitude', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="38.9000" />
          </div>
          <div style={{ ...s.field, flex:1 }}>
            <div style={s.label}>Longitude</div>
            <input style={s.input} value={form.longitude} onChange={e => setF('longitude', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="-77.0000" />
          </div>
          <button style={{ ...s.geocodeBtn, marginBottom:'1px' }} onClick={geocode} disabled={geocoding}>
            <Icon name={geocoding ? 'loader' : 'map-pin'} size={12} />
            {geocoding ? 'LOCATING...' : 'GEOCODE'}
          </button>
        </div>
        {geoError && <div style={{ fontSize:'12px', color:'var(--color-danger)', marginBottom:'10px' }}>{geoError}</div>}

        {/* Mini map */}
        <div style={s.mapThumb}>
          <MapContainer center={mapCenter} zoom={mapPos.lat ? 14 : 11} style={{ width:'100%', height:'180px' }} key={`${mapPos.lat}-${mapPos.lng}`}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <DraggableMarker position={{ lat: mapPos.lat ? Number(form.latitude) : null, lng: mapPos.lng ? Number(form.longitude) : null }} onChange={handleMapPos} />
          </MapContainer>
        </div>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'5px', marginBottom:'4px' }}>Click or drag marker on map to set exact coordinates.</div>

        <div style={s.sectionLbl}>Geofence & Status</div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'14px' }}>
          <div style={{ flex:1 }}>
            <div style={s.label}>Clock-In Radius</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'6px' }}>
              <input type="range" min={10} max={500} step={5} value={form.geofence_radius} onChange={e => setF('geofence_radius', Number(e.target.value))} style={s.slider} />
              <span style={s.sliderVal}>{form.geofence_radius}m</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ accentColor:'var(--accent)', width:'16px', height:'16px', cursor:'pointer' }} />
          <label htmlFor="is_active" style={{ fontSize:'13px', color:'var(--text-primary)', cursor:'pointer' }}>Site is active</label>
        </div>

        <div style={s.sectionLbl}>Contact</div>
        <div style={{ ...s.row, marginBottom:'0' }}>
          <div style={s.field}>
            <div style={s.label}>Contact Name</div>
            <input style={s.input} value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="On-site contact" />
          </div>
          <div style={s.field}>
            <div style={s.label}>Contact Phone</div>
            <input style={s.input} value={form.contact_phone} onChange={e => setF('contact_phone', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="(555) 000-0000" />
          </div>
        </div>

        <div style={{ display:'flex', gap:'10px', marginTop:'24px' }}>
          <button style={{ ...s.saveBtn, opacity: saving || !form.name.trim() ? 0.6 : 1 }} onClick={save} disabled={saving || !form.name.trim()}>
            <Icon name="save" size={14} />{saving ? 'SAVING...' : site ? 'SAVE CHANGES' : 'CREATE SITE'}
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Site Detail Panel ────────────────────────────────────────────────────────

function DetailPanel({ site, onDuty, tab, setTab, onClose, onEdit, canEdit }) {
  const [shifts, setShifts]   = useState([])
  const [officers, setOfficers] = useState([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('timesheet').select('id,employee_id,clock_in,clock_out').eq('site_id', site.id).is('clock_out', null).eq('date', today),
      supabase.from('shift').select('id,employee_id,start_time,end_time,position_title').eq('site_id', site.id).gte('start_time', new Date().toISOString().slice(0,10) + 'T00:00:00').order('start_time').limit(10),
    ]).then(([{ data: tsData }, { data: shiftData }]) => {
      setOfficers(tsData || [])
      setShifts(shiftData || [])
    })
  }, [site.id])

  const TABS = [
    { id:'info',        label:'Info' },
    { id:'status',      label:'Coverage' },
    { id:'docs',        label:'Documents' },
    { id:'checkpoints', label:'Checkpoints' },
    { id:'inspections', label:'Inspections' },
    { id:'qr',          label:'Site QR' },
  ]

  return (
    <div style={s.detailOverlay} onClick={onClose}>
      <div style={s.detailPanel} onClick={e => e.stopPropagation()}>
        <div style={s.detailHead}>
          <div>
            <div style={s.detailTitle}>{site.name}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{site.city}, {site.state}</div>
          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            {canEdit && <button style={{ ...s.iconBtn, minHeight:'36px' }} onClick={onEdit}><Icon name="edit-2" size={14} /></button>}
            <button style={{ ...s.iconBtn, minHeight:'36px' }} onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
        </div>

        <div style={s.detailTabs}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.detailTab, ...(tab === t.id ? s.detailTabAct : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={s.detailBody}>
          {tab === 'info' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'Address', value: [site.address, site.city, site.state, site.zip_code].filter(Boolean).join(', ') || '—' },
                { label:'Geofence Radius', value: `${site.geofence_radius ?? 150}m` },
                { label:'Status', value: site.is_active !== false ? 'Active' : 'Inactive' },
                { label:'Coordinates', value: site.latitude && site.longitude ? `${Number(site.latitude).toFixed(5)}, ${Number(site.longitude).toFixed(5)}` : 'Not set' },
                { label:'Contact', value: [site.contact_name, site.contact_phone].filter(Boolean).join(' · ') || '—' },
                { label:'Description', value: site.description || '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'3px' }}>{item.label}</div>
                  <div style={{ fontSize:'13px', color:'var(--text-primary)', lineHeight:1.5 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'status' && (
            <div>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'12px' }}>Officers On Duty Now</div>
              {officers.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'20px 0' }}>No officers currently clocked in at this site.</div>
              ) : officers.map(o => (
                <div key={o.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--color-success)', flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:'13px', color:'var(--text-primary)' }}>
                    Officer #{o.employee_id?.slice(0,8)}
                    <span style={{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'8px' }}>
                      since {new Date(o.clock_in).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', margin:'18px 0 10px' }}>Upcoming Shifts Today</div>
              {shifts.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No shifts scheduled for today.</div>
              ) : shifts.slice(0, 6).map(sh => (
                <div key={sh.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                  <Icon name="clock" size={13} color="var(--text-muted)" />
                  <div style={{ flex:1, color:'var(--text-secondary)' }}>
                    {new Date(sh.start_time).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })} — {new Date(sh.end_time).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{sh.position_title || '—'}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'docs' && <SiteDocs siteId={site.id} companyId={site.company_id} canEdit={canEdit} />}

          {tab === 'checkpoints' && <SiteCheckpoints siteId={site.id} companyId={site.company_id} siteName={site.name} canEdit={canEdit} />}

          {tab === 'inspections' && <SiteInspections siteId={site.id} companyId={site.company_id} siteName={site.name} canEdit={canEdit} />}

          {tab === 'qr' && (
            <div style={s.qrBox}>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', textAlign:'center', maxWidth:'280px', lineHeight:1.6 }}>
                Officers scan this code to confirm their site location. Links to the PostCommand clock-in flow for <strong style={{ color:'var(--text-primary)' }}>{site.name}</strong>.
              </div>
              <img src={qrUrl(site.id)} alt={`QR code for ${site.name}`} style={s.qrImg} />
              <div style={{ display:'flex', gap:'10px' }}>
                <a href={qrUrl(site.id)} download={`site-qr-${site.name.replace(/\s+/g,'_')}.png`} style={{ ...s.saveBtn, textDecoration:'none', fontSize:'12px' }}>
                  <Icon name="download" size={13} />DOWNLOAD
                </a>
                <button style={{ ...s.ghostBtn, fontSize:'12px' }} onClick={() => window.open(qrUrl(site.id), '_blank')}>
                  <Icon name="external-link" size={13} />OPEN
                </button>
              </div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', textAlign:'center', maxWidth:'260px' }}>
                Site ID: {site.id}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Site Documents ────────────────────────────────────────────────────────────

const DOC_TYPES = ['SOP','Contract','Emergency Plan','Post Orders','Photo','Map','Other']

function SiteDocs({ siteId, companyId, canEdit }) {
  const [docs, setDocs]     = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ title:'', doc_type:'SOP', content:'', file_url:'' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [siteId])
  async function load() {
    const { data } = await supabase.from('site_document').select('*').eq('site_id', siteId).order('created_at', { ascending:false })
    setDocs(data || [])
  }
  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('site_document').insert({ company_id:companyId, site_id:siteId, title:form.title.trim(), doc_type:form.doc_type, content:form.content.trim()||null, file_url:form.file_url.trim()||null })
    setSaving(false); setAdding(false); setForm({ title:'', doc_type:'SOP', content:'', file_url:'' }); load()
  }
  async function del(id) {
    await supabase.from('site_document').delete().eq('id', id); load()
  }

  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }
  const inp    = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl    = { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }

  return (
    <div>
      {docs.length === 0 && !adding && (
        <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'16px 0' }}>No documents on file for this site.</div>
      )}
      {docs.map(doc => (
        <div key={doc.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }} onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{doc.title}</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{doc.doc_type} · {new Date(doc.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
            </div>
            {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:'11px', color:'var(--accent)', display:'flex', alignItems:'center', gap:'3px' }}><Icon name="external-link" size={11}/>OPEN</a>}
            {canEdit && <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', padding:'2px' }} onClick={e=>{e.stopPropagation();del(doc.id)}}><Icon name="trash-2" size={13}/></button>}
            <Icon name={expanded===doc.id?'chevron-up':'chevron-down'} size={13} color="var(--text-muted)"/>
          </div>
          {expanded === doc.id && doc.content && (
            <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap', padding:'10px 0 2px', maxHeight:'200px', overflowY:'auto' }}>{doc.content}</div>
          )}
        </div>
      ))}

      {canEdit && (
        adding ? (
          <div style={{ marginTop:'14px', padding:'14px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'10px', marginBottom:'8px' }}>
              <div><div style={lbl}>Title *</div><input style={inp} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} onFocus={inputF} onBlur={inputB} placeholder="e.g. Post Orders — Main Entrance" /></div>
              <div><div style={lbl}>Type</div><select style={{...inp,cursor:'pointer'}} value={form.doc_type} onChange={e=>setForm(p=>({...p,doc_type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div style={{ marginBottom:'8px' }}><div style={lbl}>Content (SOP text)</div><textarea style={{...inp,minHeight:'80px',resize:'vertical',lineHeight:1.5}} value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} onFocus={inputF} onBlur={inputB} placeholder="Procedure text, instructions..."/></div>
            <div style={{ marginBottom:'12px' }}><div style={lbl}>File URL (optional)</div><input style={inp} value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} onFocus={inputF} onBlur={inputB} placeholder="https://drive.google.com/..."/></div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={{ ...s.saveBtn, height:'36px', fontSize:'12px', padding:'0 14px', opacity:(!form.title.trim()||saving)?0.6:1 }} onClick={save} disabled={!form.title.trim()||saving}>{saving?'SAVING...':'SAVE'}</button>
              <button style={{ ...s.ghostBtn, height:'36px', fontSize:'12px', padding:'0 12px' }} onClick={()=>setAdding(false)}>CANCEL</button>
            </div>
          </div>
        ) : (
          <button style={{ ...s.ghostBtn, marginTop:'14px', height:'36px', fontSize:'12px', padding:'0 14px', borderStyle:'dashed' }} onClick={()=>setAdding(true)}><Icon name="plus" size={13}/>ADD DOCUMENT</button>
        )
      )}
    </div>
  )
}

// ── Site Checkpoints ─────────────────────────────────────────────────────────

function cpQrUrl(checkpointId) {
  const data = encodeURIComponent(`postcommand-checkpoint:${checkpointId}`)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}&color=0d0f14&bgcolor=ffffff`
}

function SiteCheckpoints({ siteId, companyId, siteName, canEdit }) {
  const [checkpoints, setCheckpoints] = useState([])
  const [loading, setLoading]     = useState(true)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ name:'', location_hint:'', order_index:0 })
  const [saving, setSaving]       = useState(false)
  const [viewQr, setViewQr]       = useState(null)

  useEffect(() => { load() }, [siteId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('site_checkpoint').select('*').eq('site_id', siteId).order('order_index')
    setCheckpoints(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('site_checkpoint').insert({ company_id:companyId, site_id:siteId, name:form.name.trim(), location_hint:form.location_hint.trim()||null, order_index:checkpoints.length })
    setSaving(false); setAdding(false); setForm({ name:'', location_hint:'', order_index:0 }); load()
  }

  async function del(id) {
    await supabase.from('site_checkpoint').delete().eq('id', id); load()
  }

  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }
  const inp    = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl    = { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }

  return (
    <div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px', lineHeight:1.5 }}>
        Checkpoints are QR codes placed at specific locations (door, gate, post). Officers scan them during patrol to log their position.
      </div>

      {checkpoints.map((cp, i) => (
        <div key={cp.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, color:'var(--accent)', flexShrink:0 }}>{i+1}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{cp.name}</div>
            {cp.location_hint && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{cp.location_hint}</div>}
          </div>
          <button style={{ ...s.iconBtn, minHeight:'32px', minWidth:'32px' }} title="View QR Code" onClick={()=>setViewQr(cp)}>
            <Icon name="grid" size={13}/>
          </button>
          {canEdit && <button style={{ ...s.iconBtn, color:'var(--color-danger)', minHeight:'32px', minWidth:'32px' }} onClick={()=>del(cp.id)}>
            <Icon name="trash-2" size={13}/>
          </button>}
        </div>
      ))}

      {checkpoints.length === 0 && !adding && (
        <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'12px 0' }}>No checkpoints defined. Add them below.</div>
      )}

      {canEdit && (
        adding ? (
          <div style={{ marginTop:'12px', padding:'12px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
              <div><div style={lbl}>Checkpoint Name *</div><input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} onFocus={inputF} onBlur={inputB} placeholder="e.g. Main Entrance"/></div>
              <div><div style={lbl}>Location Hint</div><input style={inp} value={form.location_hint} onChange={e=>setForm(p=>({...p,location_hint:e.target.value}))} onFocus={inputF} onBlur={inputB} placeholder="e.g. Front door, east side"/></div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={{ ...s.saveBtn, height:'34px', fontSize:'11px', padding:'0 12px', opacity:(!form.name.trim()||saving)?0.6:1 }} onClick={save} disabled={!form.name.trim()||saving}>{saving?'SAVING...':'SAVE'}</button>
              <button style={{ ...s.ghostBtn, height:'34px', fontSize:'11px', padding:'0 10px' }} onClick={()=>setAdding(false)}>CANCEL</button>
            </div>
          </div>
        ) : (
          <button style={{ ...s.ghostBtn, marginTop:'12px', height:'34px', fontSize:'11px', padding:'0 12px', borderStyle:'dashed' }} onClick={()=>setAdding(true)}><Icon name="plus" size={12}/>ADD CHECKPOINT</button>
        )
      )}

      {/* QR Code viewer modal */}
      {viewQr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={()=>setViewQr(null)}>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', maxWidth:'300px', width:'100%', textAlign:'center', boxShadow:'var(--shadow-modal)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'4px' }}>{viewQr.name}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px' }}>{siteName}{viewQr.location_hint?` · ${viewQr.location_hint}`:''}</div>
            <img src={cpQrUrl(viewQr.id)} alt={viewQr.name} style={{ width:'200px', height:'200px', borderRadius:'var(--radius-md)', border:'8px solid white', background:'white', display:'block', margin:'0 auto 16px' }}/>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', marginBottom:'14px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>ID: {viewQr.id}</div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
              <a href={cpQrUrl(viewQr.id)} download={`checkpoint-${viewQr.name.replace(/\s+/g,'_')}.png`} style={{ ...s.saveBtn, textDecoration:'none', height:'38px', fontSize:'12px', padding:'0 14px' }}>
                <Icon name="download" size={13}/>DOWNLOAD
              </a>
              <button style={{ ...s.ghostBtn, height:'38px', fontSize:'12px', padding:'0 12px' }} onClick={()=>setViewQr(null)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Site Inspections ──────────────────────────────────────────────────────────

const INSPECTION_ITEMS = [
  'Entry/Exit points secured',
  'Lighting functional — perimeter',
  'Lighting functional — interior',
  'CCTV cameras operational',
  'Alarm system tested',
  'Fire exits clear and accessible',
  'First aid kit stocked',
  'AED accessible and charged',
  'Hazardous materials secured',
  'Visitor log maintained',
  'Officer post orders on site',
  'Communication equipment charged',
  'Vehicle access controlled',
  'Fence/barrier integrity',
  'No unauthorized personnel observed',
]

function SiteInspections({ siteId, companyId, siteName, canEdit }) {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showNew, setShowNew]         = useState(false)
  const [checks, setChecks]           = useState(Object.fromEntries(INSPECTION_ITEMS.map(i=>[i, null]))) // null | pass | fail | na
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [expanded, setExpanded]       = useState(null)

  useEffect(() => { load() }, [siteId])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('site_inspection').select('*').eq('site_id', siteId).order('inspected_at', { ascending:false }).limit(20)
    setInspections(data || []); setLoading(false)
  }

  async function save() {
    setSaving(true)
    const items = Object.entries(checks).map(([item, result]) => ({ item, result: result || 'na' }))
    const passed = items.filter(i=>i.result==='pass').length
    const failed = items.filter(i=>i.result==='fail').length
    const score  = items.filter(i=>i.result!=='na').length > 0 ? Math.round((passed/(passed+failed))*100) : null
    await supabase.from('site_inspection').insert({ company_id:companyId, site_id:siteId, inspected_at:new Date().toISOString(), items, notes:notes.trim()||null, score, passed, failed })
    setSaving(false); setShowNew(false); setChecks(Object.fromEntries(INSPECTION_ITEMS.map(i=>[i,null]))); setNotes(''); load()
  }

  const RESULT_STYLES = {
    pass: { bg:'var(--color-success-bg)', color:'var(--color-success)', label:'✓' },
    fail: { bg:'var(--color-danger-bg)',  color:'var(--color-danger)',  label:'✗' },
    na:   { bg:'var(--border)',           color:'var(--text-muted)',    label:'N/A' },
  }

  function scoreColor(score) {
    if (score == null) return 'var(--text-muted)'
    if (score >= 90) return 'var(--color-success)'
    if (score >= 70) return 'var(--color-warning)'
    return 'var(--color-danger)'
  }

  const inpBase = { background:'transparent', border:'none', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, letterSpacing:'0.5px', cursor:'pointer', transition:'all 150ms ease', minHeight:'30px', minWidth:'44px' }

  return (
    <div>
      {canEdit && !showNew && (
        <button style={{ ...s.saveBtn, height:'36px', fontSize:'12px', padding:'0 14px', marginBottom:'14px' }} onClick={()=>setShowNew(true)}>
          <Icon name="clipboard" size={13}/>NEW INSPECTION
        </button>
      )}

      {showNew && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px', marginBottom:'14px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'12px' }}>
            New Inspection — {siteName}
          </div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'10px', flexWrap:'wrap' }}>
            <span style={{ ...s.pill, background:'var(--color-success-bg)', color:'var(--color-success)' }}>✓ Pass</span>
            <span style={{ ...s.pill, background:'var(--color-danger-bg)', color:'var(--color-danger)' }}>✗ Fail</span>
            <span style={{ ...s.pill, background:'var(--border)', color:'var(--text-muted)' }}>N/A</span>
            <span style={{ fontSize:'11px', color:'var(--text-muted)', alignSelf:'center' }}>— tap each item to cycle</span>
          </div>
          {INSPECTION_ITEMS.map(item => {
            const current = checks[item]
            const cycle = () => setChecks(p => ({ ...p, [item]: current===null?'pass':current==='pass'?'fail':current==='fail'?'na':null }))
            const rs = current ? RESULT_STYLES[current] : null
            return (
              <div key={item} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:'12px', color: rs ? 'var(--text-primary)' : 'var(--text-muted)' }}>{item}</span>
                <button style={{ ...inpBase, background: rs?.bg || 'var(--bg-card)', color: rs?.color || 'var(--text-muted)', border:`1px solid ${rs?rs.color+'33':'var(--border)'}` }} onClick={cycle}>
                  {rs?.label || '—'}
                </button>
              </div>
            )
          })}
          <div style={{ marginTop:'12px' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }}>Notes</div>
            <textarea style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', width:'100%', resize:'vertical', minHeight:'60px', lineHeight:1.5, fontFamily:'var(--font-body)' }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observations, issues noted, follow-up required..." onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
            <button style={{ ...s.saveBtn, height:'36px', fontSize:'12px', padding:'0 14px', opacity:saving?0.6:1 }} onClick={save} disabled={saving}>{saving?'SAVING...':'SUBMIT INSPECTION'}</button>
            <button style={{ ...s.ghostBtn, height:'36px', fontSize:'12px', padding:'0 12px' }} onClick={()=>setShowNew(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>
        : inspections.length === 0 ? <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'16px 0' }}>No inspections on record for this site.</div>
        : inspections.map(insp => {
          const isOpen = expanded === insp.id
          const items  = Array.isArray(insp.items) ? insp.items : []
          const failed = items.filter(i=>i.result==='fail')
          return (
            <div key={insp.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:'8px', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'11px 14px', cursor:'pointer', background:'var(--bg-surface)' }} onClick={()=>setExpanded(isOpen?null:insp.id)}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>
                    {new Date(insp.inspected_at).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', display:'flex', gap:'10px' }}>
                    {insp.score!=null && <span style={{ color:scoreColor(insp.score), fontWeight:700 }}>{insp.score}% pass rate</span>}
                    {failed.length > 0 && <span style={{ color:'var(--color-danger)' }}>{failed.length} failed item{failed.length!==1?'s':''}</span>}
                  </div>
                </div>
                <Icon name={isOpen?'chevron-up':'chevron-down'} size={14} color="var(--text-muted)"/>
              </div>
              {isOpen && (
                <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)' }}>
                  {items.map((it,i) => {
                    const rs = RESULT_STYLES[it.result] || RESULT_STYLES.na
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:i<items.length-1?'1px solid var(--border)':'none' }}>
                        <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{it.item}</span>
                        <span style={{ ...s.pill, background:rs.bg, color:rs.color, fontSize:'10px' }}>{it.result?.toUpperCase()}</span>
                      </div>
                    )
                  })}
                  {insp.notes && <div style={{ marginTop:'10px', fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', lineHeight:1.5 }}>{insp.notes}</div>}
                </div>
              )}
            </div>
          )
        })
      }
    </div>
  )
}
