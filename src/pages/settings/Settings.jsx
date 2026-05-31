import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, ROLE_LEVELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

// ── Shared primitives ─────────────────────────────────────────────────────────

const s = {
  page:      { padding:'24px', maxWidth:'960px', animation:'fadeIn 200ms ease' },
  heading:   { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:       { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  layout:    { display:'flex', gap:'20px', alignItems:'flex-start' },
  tabList:   { width:'190px', minWidth:'190px', display:'flex', flexDirection:'column', gap:'2px' },
  tabBtn:    { display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'11px 14px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', borderRadius:'var(--radius-sm)', textAlign:'left', cursor:'pointer', transition:'all 150ms ease', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' },
  tabBtnAct: { color:'var(--accent)', background:'var(--accent-bg)', fontWeight:600 },
  panel:     { flex:1, minWidth:0 },
  card:      { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'22px', marginBottom:'14px' },
  cardTitle: { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'16px' },
  row:       { display:'flex', gap:'14px', marginBottom:'14px', flexWrap:'wrap' },
  field:     { display:'flex', flexDirection:'column', gap:'5px', flex:1, minWidth:'180px' },
  fieldFull: { display:'flex', flexDirection:'column', gap:'5px', marginBottom:'12px' },
  lbl:       { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' },
  inp:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  inpRo:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-muted)', width:'100%', fontFamily:'var(--font-body)', cursor:'not-allowed' },
  btn:       { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghost:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  danger:    { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  toggle:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 0', borderBottom:'1px solid var(--border)' },
  togLabel:  { display:'flex', flexDirection:'column', gap:'2px' },
  togName:   { fontSize:'14px', color:'var(--text-primary)', fontWeight:500 },
  togDesc:   { fontSize:'12px', color:'var(--text-muted)' },
  sw:        { position:'relative', width:'44px', height:'24px', cursor:'pointer', flexShrink:0 },
  swTrack:   { position:'absolute', inset:0, borderRadius:'12px', transition:'background 200ms ease' },
  swThumb:   { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.3)', transition:'left 200ms ease' },
  toast:     { fontSize:'13px', padding:'10px 14px', borderRadius:'var(--radius-sm)', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' },
  toastOk:   { background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)' },
  toastErr:  { background:'var(--color-danger-bg)',  color:'var(--color-danger)',  border:'1px solid rgba(192,57,43,0.3)' },
  linkTile:  { display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all 150ms ease', textDecoration:'none', marginBottom:'8px' },
}

function Inp({ value, onChange, placeholder, type='text', readOnly=false }) {
  const f = e => { e.target.style.borderColor='var(--border-focus)' }
  const b = e => { e.target.style.borderColor='var(--border)' }
  return <input style={readOnly ? s.inpRo : s.inp} type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly} onFocus={f} onBlur={b} />
}
function Sw({ on, onToggle }) {
  return (
    <div style={s.sw} role="switch" aria-checked={on} tabIndex={0} onClick={onToggle} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&onToggle()}>
      <div style={{ ...s.swTrack, background:on?'var(--accent)':'var(--border)' }} />
      <div style={{ ...s.swThumb, left:on?'22px':'2px' }} />
    </div>
  )
}
function Toast({ msg, type }) {
  if (!msg) return null
  return <div style={{ ...s.toast, ...(type==='ok'?s.toastOk:s.toastErr) }}><Icon name={type==='ok'?'check-circle':'alert-circle'} size={15}/>{msg}</div>
}
function getKey(k) { try { return JSON.parse(localStorage.getItem(k)||'{}') } catch { return {} } }
function setKey(k, v) { localStorage.setItem(k, JSON.stringify(v)) }

// ── TABS ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id:'company',       label:'Company Profile',  icon:'briefcase' },
  { id:'team',          label:'Team & Roles',      icon:'users' },
  { id:'notifications', label:'Notifications',     icon:'bell' },
  { id:'integrations',  label:'Integrations',      icon:'link' },
  { id:'security',      label:'Security',          icon:'lock' },
  { id:'ai',            label:'AI Settings',       icon:'zap' },
]

// ── Main export ───────────────────────────────────────────────────────────────

export default function Settings() {
  const { profile, companyId } = useAuth()
  const { theme, toggleTheme }  = useTheme()
  const [tab, setTab]           = useState('company')

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .link-tile:hover{border-color:var(--accent-border)!important;background:var(--accent-bg)!important;}
      `}</style>
      <h2 style={s.heading}>SETTINGS</h2>
      <p style={s.sub}>Company configuration, preferences, and integrations.</p>

      <div style={s.layout}>
        {/* Left tab list */}
        <div style={s.tabList}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.tabBtn, ...(tab===t.id?s.tabBtnAct:{}) }} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={15} />{t.label}
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div style={s.panel}>
          {tab === 'company'       && <CompanyTab       profile={profile} companyId={companyId} />}
          {tab === 'team'          && <TeamTab          profile={profile} companyId={companyId} theme={theme} toggleTheme={toggleTheme} />}
          {tab === 'notifications' && <NotificationsTab profile={profile} companyId={companyId} />}
          {tab === 'integrations'  && <IntegrationsTab  companyId={companyId} />}
          {tab === 'security'      && <SecurityTab      profile={profile} companyId={companyId} />}
          {tab === 'ai'            && <AITab            companyId={companyId} />}
        </div>
      </div>
    </div>
  )
}

// ── Tab 1 — Company Profile ───────────────────────────────────────────────────

function CompanyTab({ profile, companyId }) {
  const [form, setForm]   = useState({ name:'', logo_url:'', primary_color:'#c8a84b', address:'', phone:'', email:'', license_number:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]     = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('company').select('*').eq('id', companyId).single().then(({ data }) => {
      if (data) setForm(f => ({ ...f, name:data.name||'', logo_url:data.logo_url||'', primary_color:data.primary_color||'#c8a84b', address:data.address||'', phone:data.phone||'', email:data.email||'', license_number:data.license_number||'' }))
    })
    // Also load from localStorage as fallback
    const saved = getKey(`pc-company-${companyId}`)
    if (saved.primaryColor) { setForm(f=>({...f, primary_color:saved.primaryColor})); document.documentElement.style.setProperty('--accent', saved.primaryColor) }
    if (saved.logoUrl)      setForm(f=>({...f, logo_url:saved.logoUrl}))
  }, [companyId])

  function setF(k, v) { setForm(p=>({...p,[k]:v})) }

  async function save() {
    setSaving(true); setMsg(null)
    // Apply color immediately
    document.documentElement.style.setProperty('--accent', form.primary_color)
    setKey(`pc-company-${companyId}`, { primaryColor:form.primary_color, logoUrl:form.logo_url, displayName:form.name })
    // Upsert to company table
    const { error } = await supabase.from('company').upsert({ id:companyId, name:form.name.trim()||null, logo_url:form.logo_url.trim()||null, primary_color:form.primary_color, address:form.address.trim()||null, phone:form.phone.trim()||null, email:form.email.trim()||null, license_number:form.license_number.trim()||null }, { onConflict:'id' })
    setSaving(false)
    setMsg(error ? { type:'err', text:error.message } : { type:'ok', text:'Company profile saved.' })
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Company Identity</div>
        <Toast msg={msg?.text} type={msg?.type} />
        <div style={s.row}>
          <div style={s.field}><div style={s.lbl}>Company Name</div><Inp value={form.name} onChange={e=>setF('name',e.target.value)} placeholder="Nationwide Police Services" /></div>
          <div style={s.field}><div style={s.lbl}>License Number</div><Inp value={form.license_number} onChange={e=>setF('license_number',e.target.value)} placeholder="MD-SEC-12345" /></div>
        </div>
        <div style={s.fieldFull}>
          <div style={s.lbl}>Logo URL</div>
          <Inp value={form.logo_url} onChange={e=>setF('logo_url',e.target.value)} placeholder="https://cdn.example.com/logo.png" />
        </div>
        {form.logo_url && (
          <div style={{ marginBottom:'12px' }}>
            <img src={form.logo_url} alt="Logo preview" style={{ maxHeight:'56px', maxWidth:'180px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', padding:'6px', background:'var(--bg-surface)' }} onError={e=>e.target.style.display='none'} />
          </div>
        )}
        <div style={{ display:'flex', alignItems:'flex-end', gap:'12px', marginBottom:'14px', flexWrap:'wrap' }}>
          <div>
            <div style={s.lbl}>Primary / Accent Color</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginTop:'5px' }}>
              <input type="color" value={form.primary_color} onChange={e=>{ setF('primary_color',e.target.value); document.documentElement.style.setProperty('--accent',e.target.value) }} style={{ width:'44px', height:'44px', padding:'2px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', background:'var(--bg-input)' }} />
              <Inp value={form.primary_color} onChange={e=>{ setF('primary_color',e.target.value); if(/^#[0-9a-f]{6}$/i.test(e.target.value)) document.documentElement.style.setProperty('--accent',e.target.value) }} placeholder="#c8a84b" />
              <button style={{ ...s.ghost, height:'40px', padding:'0 12px', fontSize:'11px' }} onClick={()=>{ setF('primary_color','#c8a84b'); document.documentElement.style.removeProperty('--accent') }}>RESET</button>
            </div>
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Contact Details</div>
        <div style={s.row}>
          <div style={s.field}><div style={s.lbl}>Address</div><Inp value={form.address} onChange={e=>setF('address',e.target.value)} placeholder="123 Main St, Baltimore MD" /></div>
          <div style={s.field}><div style={s.lbl}>Phone</div><Inp value={form.phone} onChange={e=>setF('phone',e.target.value)} placeholder="(410) 555-0000" /></div>
        </div>
        <div style={s.fieldFull}>
          <div style={s.lbl}>Company Email</div>
          <Inp value={form.email} onChange={e=>setF('email',e.target.value)} placeholder="admin@company.com" type="email" />
        </div>
        <button style={{ ...s.btn, opacity:saving?0.6:1 }} onClick={save} disabled={saving}>
          <Icon name="save" size={14}/>{saving?'SAVING...':'SAVE CHANGES'}
        </button>
      </div>
    </>
  )
}

// ── Tab 2 — Team & Roles ──────────────────────────────────────────────────────

function TeamTab({ profile, companyId, theme, toggleTheme }) {
  const navigate = useNavigate()
  const [ops, setOps]   = useState({ geofenceRadius:150, requirePhotos:true, requireClockOutPhoto:true, earlyClockIn:15 })
  const [opsSaved, setOpsSaved] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [acting, setActing] = useState(null)

  useEffect(() => {
    if (!companyId) return
    const saved = getKey(`pc-ops-${companyId}`)
    setOps(p => ({ ...p, ...saved }))
    supabase.from('employee').select('id,first_name,last_name,profile_photo_url').eq('company_id', companyId).eq('profile_photo_status','pending').then(({ data }) => setPendingPhotos(data||[]))
  }, [companyId])

  function updOps(k, v) { setOps(p=>({...p,[k]:v})) }
  function saveOps() { setKey(`pc-ops-${companyId}`, ops); setOpsSaved(true); setTimeout(()=>setOpsSaved(false),2500) }

  async function approvePhoto(id, approve) {
    setActing(id)
    await supabase.from('employee').update({ profile_photo_status: approve?'approved':'rejected' }).eq('id', id)
    setPendingPhotos(p => p.filter(e => e.id !== id))
    setActing(null)
  }

  const QL = [
    { label:'Employee Directory', icon:'users',   path:'/personnel' },
    { label:'User Management',    icon:'user-plus',path:'/personnel' },
    { label:'Roles & Permissions',icon:'shield',  path:'/personnel' },
    { label:'Position Management',icon:'briefcase',path:'/personnel' },
  ]

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Quick Links</div>
        {QL.map(q => (
          <div key={q.label} className="link-tile" style={s.linkTile} onClick={() => navigate(q.path)}>
            <Icon name={q.icon} size={16} color="var(--accent)"/><span style={{ fontSize:'13px', color:'var(--text-primary)' }}>{q.label}</span><Icon name="chevron-right" size={14} color="var(--text-muted)" />
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Timekeeping & Geofence</div>
        {opsSaved && <Toast msg="Settings saved." type="ok" />}
        <div style={{ ...s.toggle, borderBottom:'none', paddingTop:0 }}>
          <div style={s.togLabel}>
            <span style={s.togName}>Geofence Radius</span>
            <span style={s.togDesc}>Max distance from site for clock-in</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', minWidth:'200px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="range" min={10} max={500} step={5} value={ops.geofenceRadius} onChange={e=>updOps('geofenceRadius',Number(e.target.value))} style={{ flex:1, accentColor:'var(--accent)', cursor:'pointer', height:'4px', width:'140px' }} />
              <span style={{ fontFamily:'var(--font-display)', fontSize:'18px', color:'var(--accent)', letterSpacing:'1px', minWidth:'56px', textAlign:'right' }}>{ops.geofenceRadius}m</span>
            </div>
            <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>10m — 500m</span>
          </div>
        </div>
        <div style={{ borderTop:'1px solid var(--border)', marginTop:'4px' }} />
        {[
          { key:'requirePhotos',        name:'Require Clock-In Photo',   desc:'Officers must submit a photo when clocking in' },
          { key:'requireClockOutPhoto', name:'Require Clock-Out Photo',  desc:'Officers must submit a photo when clocking out' },
        ].map(item => (
          <div key={item.key} style={s.toggle}>
            <div style={s.togLabel}>
              <span style={s.togName}>{item.name}</span>
              <span style={s.togDesc}>{item.desc}</span>
            </div>
            <Sw on={ops[item.key] !== false} onToggle={() => updOps(item.key, !(ops[item.key] !== false))} />
          </div>
        ))}
        <div style={{ ...s.toggle, borderBottom:'none' }}>
          <div style={s.togLabel}>
            <span style={s.togName}>Early Clock-In Window</span>
            <span style={s.togDesc}>Minutes before shift start that officers can clock in</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', minWidth:'200px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="range" min={0} max={60} step={5} value={ops.earlyClockIn} onChange={e=>updOps('earlyClockIn',Number(e.target.value))} style={{ flex:1, accentColor:'var(--accent)', cursor:'pointer', height:'4px', width:'140px' }} />
              <span style={{ fontFamily:'var(--font-display)', fontSize:'18px', color:'var(--accent)', letterSpacing:'1px', minWidth:'56px', textAlign:'right' }}>{ops.earlyClockIn}m</span>
            </div>
          </div>
        </div>
        <button style={{ ...s.btn, marginTop:'14px' }} onClick={saveOps}><Icon name="save" size={14}/>SAVE SETTINGS</button>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Appearance</div>
        <div style={{ display:'flex', gap:'12px' }}>
          {[{ id:'dark',label:'Dark',bg:'#0d0f14',surface:'#1a1d2a',accent:'#c8a84b',text:'#f0f2f8' },{ id:'light',label:'Light',bg:'#f8f9fa',surface:'#fff',accent:'#c8a84b',text:'#0d0f14' }].map(opt => {
            const active = theme === opt.id
            return (
              <button key={opt.id} style={{ flex:1, background:opt.bg, border:`2px solid ${active?opt.accent:'transparent'}`, borderRadius:'var(--radius-md)', padding:'14px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', transition:'all 150ms ease' }} onClick={()=>{ if(theme!==opt.id) toggleTheme() }}>
                <div style={{ width:'100%', height:'40px', borderRadius:'5px', background:opt.surface, border:`1px solid ${opt.accent}22`, display:'flex', alignItems:'center', padding:'8px', gap:'6px' }}>
                  <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:opt.accent }} /><div style={{ flex:1, height:'3px', borderRadius:'2px', background:opt.accent+'44' }} />
                </div>
                <div style={{ fontSize:'12px', color:opt.text, fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontWeight:active?700:400 }}>{opt.label.toUpperCase()}{active?' ✓':''}</div>
              </button>
            )
          })}
        </div>
      </div>

      {pendingPhotos.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Profile Photo Approvals ({pendingPhotos.length})</div>
          {pendingPhotos.map(emp => (
            <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <img src={emp.profile_photo_url} alt="" style={{ width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:'1px solid var(--border)' }} onError={e=>e.target.style.display='none'} />
              <div style={{ flex:1, fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{emp.first_name} {emp.last_name}</div>
              <button style={{ ...s.btn, height:'34px', padding:'0 12px', fontSize:'11px', opacity:acting===emp.id?0.6:1 }} onClick={()=>approvePhoto(emp.id,true)} disabled={acting===emp.id}><Icon name="check" size={11}/>APPROVE</button>
              <button style={{ ...s.danger, height:'34px', padding:'0 12px', fontSize:'11px', opacity:acting===emp.id?0.6:1 }} onClick={()=>approvePhoto(emp.id,false)} disabled={acting===emp.id}><Icon name="x" size={11}/>REJECT</button>
            </div>
          ))}
          {pendingPhotos.length === 0 && <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No pending photo approvals.</div>}
        </div>
      )}

      <div style={s.card}>
        <div style={s.cardTitle}>Roles & Permissions</div>
        <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
          {[
            { label:'Your Role', value:ROLE_LABELS[profile?.role]||profile?.role },
            { label:'Access Level', value:`Level ${ROLE_LEVELS[profile?.role]||0}` },
          ].map(item => (
            <div key={item.label}><div style={s.lbl}>{item.label}</div><div style={{ fontSize:'14px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px', marginTop:'4px' }}>{item.value}</div></div>
          ))}
        </div>
        <button style={{ ...s.ghost, marginTop:'14px' }} onClick={()=> document.querySelector('[data-role-link]')?.click()}>
          <Icon name="shield" size={14}/>MANAGE ROLES & PERMISSIONS →
        </button>
      </div>
    </>
  )
}

// ── Tab 3 — Notifications ─────────────────────────────────────────────────────

function NotificationsTab({ profile, companyId }) {
  const KEY    = `pc-notif-${profile?.id}`
  const [prefs, setPrefs] = useState({
    emergency_alerts:true, schedule_changes:true, shift_reminders:true,
    pto_updates:true, incident_alerts:true, training_reminders:true,
    payroll_notifications:false, chat_messages:true,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = getKey(KEY); if (Object.keys(p).length) setPrefs(prev=>({...prev,...p}))
  }, [KEY])

  function tog(k) { setPrefs(p=>({...p,[k]:!p[k]})) }

  function save() {
    setKey(KEY, prefs)
    setSaved(true); setTimeout(()=>setSaved(false),2500)
  }

  const ITEMS = [
    { key:'emergency_alerts',       name:'Emergency Alerts (SOS)',     desc:'Immediate SOS trigger notifications' },
    { key:'schedule_changes',       name:'Schedule Changes',           desc:'When your schedule is updated or published' },
    { key:'shift_reminders',        name:'Shift Reminders',            desc:'Reminder before your shift starts' },
    { key:'pto_updates',            name:'PTO Updates',                desc:'When your PTO request is approved or denied' },
    { key:'incident_alerts',        name:'Incident Alerts',            desc:'New incidents submitted for review' },
    { key:'training_reminders',     name:'Training Reminders',         desc:'Upcoming training due dates' },
    { key:'payroll_notifications',  name:'Payroll Notifications',      desc:'Timesheet approvals and payroll updates' },
    { key:'chat_messages',          name:'Chat Messages',              desc:'New direct messages and announcements' },
  ]

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Notification Preferences</div>
      {saved && <Toast msg="Preferences saved." type="ok" />}
      {ITEMS.map((item, i) => (
        <div key={item.key} style={{ ...s.toggle, borderBottom:i<ITEMS.length-1?'1px solid var(--border)':'none' }}>
          <div style={s.togLabel}>
            <span style={s.togName}>{item.name}</span>
            <span style={s.togDesc}>{item.desc}</span>
          </div>
          <Sw on={prefs[item.key]} onToggle={()=>tog(item.key)} />
        </div>
      ))}
      <button style={{ ...s.btn, marginTop:'18px' }} onClick={save}><Icon name="save" size={14}/>SAVE PREFERENCES</button>
    </div>
  )
}

// ── Tab 4 — Integrations ──────────────────────────────────────────────────────

function IntegrationsTab({ companyId }) {
  const KEY = `pc-integrations-${companyId}`
  const [form, setForm] = useState({
    payroll_provider:'', emp_id_col:'EmployeeID', hours_col:'RegularHours', ot_col:'OvertimeHours',
    states:['MD','DC','VA','PA'], new_state:'',
    report_automation:false, report_day:'Monday', report_time:'08:00', report_email:'',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { const s = getKey(KEY); if (Object.keys(s).length) setForm(p=>({...p,...s})) }, [KEY])
  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  function addState() { if (form.new_state.trim() && !form.states.includes(form.new_state.trim().toUpperCase())) { setF('states',[...form.states,form.new_state.trim().toUpperCase()]); setF('new_state','') } }
  function removeState(s) { setF('states',form.states.filter(x=>x!==s)) }
  function save() { setKey(KEY, form); setSaved(true); setTimeout(()=>setSaved(false),2500) }

  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Payroll Integration</div>
        {saved && <Toast msg="Integration settings saved." type="ok" />}
        <div style={s.fieldFull}>
          <div style={s.lbl}>Payroll Provider</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={form.payroll_provider} onChange={e=>setF('payroll_provider',e.target.value)}>
            <option value="">Select provider...</option>
            <option value="adp">ADP Workforce Now</option>
            <option value="paychex">Paychex Flex</option>
            <option value="gusto">Gusto</option>
            <option value="quickbooks">QuickBooks Payroll</option>
            <option value="custom">Custom / Other</option>
          </select>
        </div>
        {form.payroll_provider && (
          <>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'12px' }}>Column name mappings for CSV export:</div>
            <div style={s.row}>
              <div style={s.field}><div style={s.lbl}>Employee ID Column</div><input style={s.inp} value={form.emp_id_col} onChange={e=>setF('emp_id_col',e.target.value)} onFocus={foc} onBlur={blr}/></div>
              <div style={s.field}><div style={s.lbl}>Regular Hours Column</div><input style={s.inp} value={form.hours_col} onChange={e=>setF('hours_col',e.target.value)} onFocus={foc} onBlur={blr}/></div>
              <div style={s.field}><div style={s.lbl}>Overtime Column</div><input style={s.inp} value={form.ot_col} onChange={e=>setF('ot_col',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            </div>
          </>
        )}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>State Licensing</div>
        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>States where your company holds a security services license:</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
          {form.states.map(st => (
            <span key={st} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', color:'var(--accent)', borderRadius:'20px', padding:'3px 10px', fontSize:'12px', fontFamily:'var(--font-condensed)', fontWeight:700 }}>
              {st}
              <button style={{ background:'transparent', border:'none', color:'var(--accent)', cursor:'pointer', padding:'0', display:'flex' }} onClick={()=>removeState(st)}><Icon name="x" size={11}/></button>
            </span>
          ))}
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <input style={{ ...s.inp, width:'80px', textTransform:'uppercase' }} value={form.new_state} onChange={e=>setF('new_state',e.target.value.toUpperCase())} onFocus={foc} onBlur={blr} placeholder="MD" maxLength={2} onKeyDown={e=>e.key==='Enter'&&addState()}/>
          <button style={{ ...s.ghost, height:'44px', padding:'0 14px' }} onClick={addState}><Icon name="plus" size={14}/>ADD STATE</button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Report Automation</div>
        <div style={s.toggle}>
          <div style={s.togLabel}>
            <span style={s.togName}>Enable Weekly Reports</span>
            <span style={s.togDesc}>Automatically generate and email weekly site reports</span>
          </div>
          <Sw on={form.report_automation} onToggle={()=>setF('report_automation',!form.report_automation)} />
        </div>
        {form.report_automation && (
          <div style={{ paddingTop:'12px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
            <div style={s.field}>
              <div style={s.lbl}>Day</div>
              <select style={{ ...s.inp, cursor:'pointer' }} value={form.report_day} onChange={e=>setF('report_day',e.target.value)}>
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <div style={s.lbl}>Time</div>
              <input type="time" style={s.inp} value={form.report_time} onChange={e=>setF('report_time',e.target.value)} onFocus={foc} onBlur={blr}/>
            </div>
            <div style={{ ...s.field, flex:2 }}>
              <div style={s.lbl}>Send to Email</div>
              <input type="email" style={s.inp} value={form.report_email} onChange={e=>setF('report_email',e.target.value)} onFocus={foc} onBlur={blr} placeholder="admin@company.com"/>
            </div>
          </div>
        )}
        <button style={{ ...s.btn, marginTop:'14px' }} onClick={save}><Icon name="save" size={14}/>SAVE INTEGRATIONS</button>
      </div>
    </>
  )
}

// ── Tab 5 — Security ──────────────────────────────────────────────────────────

function SecurityTab({ profile, companyId }) {
  const [newPass, setNewPass]     = useState('')
  const [confirmPass, setConfirm] = useState('')
  const [passSaving, setPassSaving] = useState(false)
  const [passMsg, setPassMsg]     = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetErr, setResetErr]   = useState(null)

  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  async function changePassword() {
    if (!newPass || newPass.length < 8) { setPassMsg({ type:'err', text:'Password must be at least 8 characters.' }); return }
    if (newPass !== confirmPass) { setPassMsg({ type:'err', text:'Passwords do not match.' }); return }
    setPassSaving(true); setPassMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setPassSaving(false)
    if (error) setPassMsg({ type:'err', text:error.message })
    else { setPassMsg({ type:'ok', text:'Password updated successfully.' }); setNewPass(''); setConfirm('') }
    setTimeout(()=>setPassMsg(null), 4000)
  }

  async function sendReset() {
    setResetSent(false); setResetErr(null)
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo:`${window.location.origin}/login` })
    if (error) setResetErr(error.message)
    else setResetSent(true)
  }

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Change Password</div>
        <Toast msg={passMsg?.text} type={passMsg?.type} />
        <div style={s.fieldFull}>
          <div style={s.lbl}>New Password</div>
          <input type="password" style={s.inp} value={newPass} onChange={e=>setNewPass(e.target.value)} onFocus={foc} onBlur={blr} placeholder="At least 8 characters" />
        </div>
        <div style={s.fieldFull}>
          <div style={s.lbl}>Confirm Password</div>
          <input type="password" style={s.inp} value={confirmPass} onChange={e=>setConfirm(e.target.value)} onFocus={foc} onBlur={blr} placeholder="Re-enter new password" />
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.btn, opacity:passSaving?0.6:1 }} onClick={changePassword} disabled={passSaving}>
            <Icon name="lock" size={14}/>{passSaving?'SAVING...':'UPDATE PASSWORD'}
          </button>
          <button style={s.ghost} onClick={sendReset}>
            <Icon name="mail" size={14}/>SEND RESET EMAIL
          </button>
        </div>
        {resetSent && <Toast msg={`Reset link sent to ${profile?.email}`} type="ok" />}
        {resetErr  && <Toast msg={resetErr} type="err" />}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Session</div>
        <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
          {[
            { label:'Signed In As', value:profile?.email },
            { label:'User ID', value:profile?.id?.slice(0,12)+'...' },
            { label:'Role', value:ROLE_LABELS[profile?.role]||profile?.role },
          ].map(item=>(
            <div key={item.label}><div style={s.lbl}>{item.label}</div><div style={{ fontSize:'13px', color:'var(--text-primary)', marginTop:'4px' }}>{item.value}</div></div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Audit Log — Last 30 Days</div>
        <AuditLogEmbed companyId={companyId} />
      </div>
    </>
  )
}

// Embedded mini audit log for Security tab
function AuditLogEmbed({ companyId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    const since = new Date(Date.now() - 30*86400000).toISOString()
    Promise.all([
      supabase.from('timesheet').select('id,employee_id,status,clock_in').eq('company_id',companyId).gte('clock_in',since).order('clock_in',{ascending:false}).limit(15),
      supabase.from('incident_report').select('id,cad_number,incident_type,status,created_at').eq('company_id',companyId).gte('created_at',since).order('created_at',{ascending:false}).limit(15),
      supabase.from('sos_alert').select('id,employee_id,status,triggered_at').eq('company_id',companyId).gte('triggered_at',since).order('triggered_at',{ascending:false}).limit(10),
    ]).then(([{data:ts},{data:inc},{data:sos}]) => {
      const all = [
        ...(ts||[]).map(t=>({ id:'ts-'+t.id, icon:'clock', color:'var(--color-info)', label:`Timesheet ${t.status}`, time:t.clock_in })),
        ...(inc||[]).map(i=>({ id:'inc-'+i.id, icon:'file-check', color:'var(--color-danger)', label:`Incident: ${i.incident_type} (${i.cad_number})`, time:i.created_at })),
        ...(sos||[]).map(s=>({ id:'sos-'+s.id, icon:'alert-triangle', color:'#e05555', label:`SOS ${s.status}`, time:s.triggered_at })),
      ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,20)
      setEvents(all); setLoading(false)
    })
  }, [companyId])

  function fmtTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso), now = new Date(), diff = (now-d)/1000
    if (diff<60) return 'Just now'
    if (diff<3600) return `${Math.floor(diff/60)}m ago`
    if (diff<86400) return `${Math.floor(diff/3600)}h ago`
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  }

  if (loading) return <div style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>
  if (!events.length) return <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No activity in the last 30 days.</div>

  return (
    <div>
      {events.map((ev,i) => (
        <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:i<events.length-1?'1px solid var(--border)':'none' }}>
          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:`${ev.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon name={ev.icon} size={12} color={ev.color}/>
          </div>
          <div style={{ flex:1, fontSize:'12px', color:'var(--text-secondary)' }}>{ev.label}</div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', flexShrink:0 }}>{fmtTime(ev.time)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Tab 6 — AI Settings ───────────────────────────────────────────────────────

function AITab({ companyId }) {
  const KEY = `pc-ai-${companyId}`
  const [prefs, setPrefs] = useState({
    ai_incident_writing:true,
    ai_training_builder:true,
    ccw_monthly_updater:true,
    ai_report_generation:false,
    model:'claude-sonnet-4-6',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { const p=getKey(KEY); if (Object.keys(p).length) setPrefs(prev=>({...prev,...p})) }, [KEY])
  function tog(k) { setPrefs(p=>({...p,[k]:!p[k]})) }
  function save() { setKey(KEY,prefs); setSaved(true); setTimeout(()=>setSaved(false),2500) }

  const FEATURES = [
    { key:'ai_incident_writing',  name:'AI Incident Writing',     desc:'Claude assists officers in writing incident reports' },
    { key:'ai_training_builder',  name:'AI Training Builder',     desc:'Generate full courses from a topic using Claude' },
    { key:'ccw_monthly_updater',  name:'CCW Map Monthly Updater', desc:'Claude checks for state law changes and updates CCW data' },
    { key:'ai_report_generation', name:'AI Report Generation',    desc:'Automated AI-generated weekly analytics reports' },
  ]

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Anthropic API</div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', marginBottom:'14px' }}>
          <Icon name="zap" size={16} color="var(--color-success)"/>
          <div>
            <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>API Key Configured via Supabase Secrets</div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>Set ANTHROPIC_API_KEY in Supabase Dashboard → Edge Functions → Secrets</div>
          </div>
        </div>
        <div style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6 }}>
          AI features use your Supabase Edge Function secrets — no keys are stored in the frontend. Configure at <strong style={{ color:'var(--text-secondary)' }}>supabase.com/dashboard</strong>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>AI Feature Toggles</div>
        {saved && <Toast msg="AI settings saved." type="ok" />}
        {FEATURES.map((item,i) => (
          <div key={item.key} style={{ ...s.toggle, borderBottom:i<FEATURES.length-1?'1px solid var(--border)':'none' }}>
            <div style={s.togLabel}>
              <span style={s.togName}>{item.name}</span>
              <span style={s.togDesc}>{item.desc}</span>
            </div>
            <Sw on={prefs[item.key]} onToggle={()=>tog(item.key)}/>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Model Preference</div>
        <div style={s.fieldFull}>
          <div style={s.lbl}>Default Claude Model</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={prefs.model} onChange={e=>setPrefs(p=>({...p,model:e.target.value}))}>
            <option value="claude-sonnet-4-6">claude-sonnet-4-6 (Recommended — fast, capable)</option>
            <option value="claude-opus-4-8">claude-opus-4-8 (Most capable — slower, higher cost)</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001 (Fastest — lower cost)</option>
          </select>
        </div>
        <button style={s.btn} onClick={save}><Icon name="save" size={14}/>SAVE AI SETTINGS</button>
      </div>
    </>
  )
}
