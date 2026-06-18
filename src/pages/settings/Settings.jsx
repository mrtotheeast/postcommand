import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, ROLE_LEVELS, atLeast, ROLE_TITLES } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import CompanySettings from './CompanySettings'

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
  { id:'ops',           label:'Operations',        icon:'sliders' },
  { id:'notifications', label:'Notifications',     icon:'bell' },
  { id:'integrations',  label:'Integrations',      icon:'link' },
  { id:'security',      label:'Security',          icon:'lock' },
  { id:'ai',            label:'AI Settings',       icon:'zap' },
  { id:'licensing',     label:'State Licensing',   icon:'map-pin' },
  { id:'supervisors',   label:'Supervisors',        icon:'users' },
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
          {tab === 'ops'           && <CompanySettings  embedded />}
          {tab === 'notifications' && <NotificationsTab profile={profile} companyId={companyId} />}
          {tab === 'integrations'  && <IntegrationsTab  companyId={companyId} />}
          {tab === 'security'      && <SecurityTab      profile={profile} companyId={companyId} />}
          {tab === 'ai'            && <AITab            companyId={companyId} />}
          {tab === 'licensing'     && <StateLicensingTab companyId={companyId} />}
          {tab === 'supervisors'   && <SupervisorAssignmentTab companyId={companyId} />}
        </div>
      </div>
    </div>
  )
}

// ── Tab 1 — Company Profile ───────────────────────────────────────────────────

function CompanyTab({ profile, companyId }) {
  const toast = useToast()
  const [form, setForm]   = useState({ name:'', logo_url:'', primary_color:'#c8a84b', address:'', phone:'', email:'', license_number:'', role_style:'military' })
  const [customRanks, setCustomRanks] = useState([])
  const [newRank, setNewRank]         = useState({ title:'', level:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]     = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('company').select('*').eq('id', companyId).single().then(({ data }) => {
      if (data) {
        setForm(f => ({ ...f, name:data.name||'', logo_url:data.logo_url||'', primary_color:data.primary_color||'#c8a84b', address:data.address||'', phone:data.phone||'', email:data.email||'', license_number:data.license_number||'', role_style:data.role_style||'military' }))
        setCustomRanks(data.custom_ranks||[])
      }
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
    const { error } = await supabase.from('company').upsert({ id:companyId, name:form.name.trim()||null, logo_url:form.logo_url.trim()||null, primary_color:form.primary_color, address:form.address.trim()||null, phone:form.phone.trim()||null, email:form.email.trim()||null, license_number:form.license_number.trim()||null, role_style:form.role_style, custom_ranks:customRanks }, { onConflict:'id' })
    setSaving(false)
    if (!error) toast('Settings saved')
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

      {/* Role Style */}
      <div style={s.card}>
        <div style={s.cardTitle}>Role Display Style</div>
        <div style={{ fontSize:'13px', color:'var(--text-secondary)', marginBottom:'14px', lineHeight:1.6 }}>Choose how role titles are displayed throughout the app.</div>
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
          {[['military','Military — Officer, Corporal, Sergeant, Lieutenant, Chief'],['standard','Standard — Employee, Lead, Supervisor, Manager, Admin']].map(([v,l])=>(
            <label key={v} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',padding:'12px 16px',border:`2px solid ${form.role_style===v?'var(--accent)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',background:form.role_style===v?'var(--accent-bg)':'transparent',flex:1,minWidth:'220px',transition:'all 150ms ease'}}>
              <input type="radio" value={v} checked={form.role_style===v} onChange={()=>setForm(p=>({...p,role_style:v}))} style={{accentColor:'var(--accent)'}}/>
              <span style={{fontSize:'13px',color:form.role_style===v?'var(--accent)':'var(--text-primary)',fontWeight:form.role_style===v?600:400}}>{l}</span>
            </label>
          ))}
        </div>
        <div style={{marginTop:'14px',fontSize:'11px',color:'var(--text-muted)'}}>
          Current titles: {Object.entries(ROLE_TITLES[form.role_style]||ROLE_TITLES.military).filter(([k])=>k!=='0'&&k!=='6').map(([,v])=>v).join(' → ')}
        </div>
      </div>

      {/* Custom Ranks */}
      <div style={s.card}>
        <div style={s.cardTitle}>Custom Ranks</div>
        <div style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'14px',lineHeight:1.6}}>
          Add intermediate ranks between standard levels. Example: Captain (level 3.5) sits between Sergeant and Lieutenant.
        </div>
        {customRanks.sort((a,b)=>a.level-b.level).map((r,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',flex:1}}>{r.title}</span>
            <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)'}}>Level {r.level}</span>
            <button onClick={()=>setCustomRanks(prev=>prev.filter((_,j)=>j!==i))} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'2px',display:'flex'}}><Icon name="x" size={13}/></button>
          </div>
        ))}
        <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
          <input placeholder="Rank title (e.g. Captain)" value={newRank.title} onChange={e=>setNewRank(p=>({...p,title:e.target.value}))} style={{...s.inp,flex:1}}/>
          <input type="number" min="1" max="5.9" step="0.1" placeholder="Level (1-5.9)" value={newRank.level} onChange={e=>setNewRank(p=>({...p,level:e.target.value}))} style={{...s.inp,width:'130px'}}/>
          <button onClick={()=>{ if(!newRank.title||!newRank.level)return; setCustomRanks(p=>[...p,{title:newRank.title.trim(),level:parseFloat(newRank.level)}]); setNewRank({title:'',level:''}) }} style={{...s.ghost,height:'44px',padding:'0 14px',flexShrink:0}}>ADD</button>
        </div>
        <div style={{marginTop:'10px',fontSize:'11px',color:'var(--text-muted)'}}>Custom ranks are saved when you click Save Changes above.</div>
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

      <PositionsSection companyId={companyId} />

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

      <RolePermissionsMatrix companyId={companyId} profile={profile} />
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

      {/* PTO Configuration */}
      <PTOSettingsSection companyId={companyId} />
    </>
  )
}

function PTOSettingsSection({ companyId }) {
  const KEY = `pc-pto-settings-${companyId}`
  const [form, setForm] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)||'{}') } catch { return {} } })
  const [saved, setSaved] = useState(false)
  const defaults = { accrual_method:'Manual', accrual_rate:0, max_carryover:40, max_balance:160, types:['Vacation','Sick','Personal','Bereavement','Unpaid','Holiday'] }
  const vals = { ...defaults, ...form }
  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  function toggleType(t) { const ts=vals.types; setF('types',ts.includes(t)?ts.filter(x=>x!==t):[...ts,t]) }
  function save() { localStorage.setItem(KEY,JSON.stringify({...defaults,...form})); setSaved(true); setTimeout(()=>setSaved(false),2500) }
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>PTO Configuration</div>
      {saved && <div style={{ fontSize:'13px', padding:'9px 12px', borderRadius:'var(--radius-sm)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)' }}><Icon name="check-circle" size={14}/>PTO settings saved.</div>}
      <div style={s.row}>
        <div style={s.field}>
          <div style={s.lbl}>Accrual Method</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={vals.accrual_method} onChange={e=>setF('accrual_method',e.target.value)}>
            {['Manual','Hours Worked','Per Pay Period'].map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Accrual Rate (hours per period)</div>
          <Inp value={vals.accrual_rate} onChange={e=>setF('accrual_rate',Number(e.target.value))} type="number" placeholder="0" />
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Max Carryover (hours)</div>
          <Inp value={vals.max_carryover} onChange={e=>setF('max_carryover',Number(e.target.value))} type="number" placeholder="40" />
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Max Balance (hours)</div>
          <Inp value={vals.max_balance} onChange={e=>setF('max_balance',Number(e.target.value))} type="number" placeholder="160" />
        </div>
      </div>
      <div style={{ marginBottom:'14px' }}>
        <div style={s.lbl}>Available PTO Types</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'8px' }}>
          {['Vacation','Sick','Personal','Bereavement','Unpaid','Holiday'].map(t=>(
            <label key={t} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'var(--text-primary)', cursor:'pointer' }}>
              <input type="checkbox" checked={vals.types.includes(t)} onChange={()=>toggleType(t)} style={{ accentColor:'var(--accent)', width:'15px', height:'15px', cursor:'pointer' }}/>{t}
            </label>
          ))}
        </div>
      </div>
      <button style={s.btn} onClick={save}><Icon name="save" size={14}/>SAVE PTO SETTINGS</button>
    </div>
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

// ── Positions Section ─────────────────────────────────────────────────────────

function PositionsSection({ companyId }) {
  const [positions, setPositions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [form,      setForm]      = useState({ title:'', department:'', pay_type:'hourly', pay_rate:'', description:'' })
  const [editId,    setEditId]    = useState(null)
  const [saving,    setSaving]    = useState(false)
  useEffect(() => { if (companyId) load() }, [companyId])
  async function load() { setLoading(true); const { data } = await supabase.from('position').select('*').eq('company_id',companyId).order('title'); setPositions(data||[]); setLoading(false) }
  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    if (editId) await supabase.from('position').update({...form,pay_rate:Number(form.pay_rate)||null}).eq('id',editId)
    else await supabase.from('position').insert({company_id:companyId,...form,pay_rate:Number(form.pay_rate)||null})
    setSaving(false); setForm({title:'',department:'',pay_type:'hourly',pay_rate:'',description:''}); setEditId(null); load()
  }
  async function del(id) { if (!window.confirm('Delete this position?')) return; await supabase.from('position').delete().eq('id',id); load() }
  function startEdit(p) { setForm({title:p.title,department:p.department||'',pay_type:p.pay_type||'hourly',pay_rate:String(p.pay_rate||''),description:p.description||''}); setEditId(p.id) }
  const foc=e=>e.target.style.borderColor='var(--border-focus)'; const blr=e=>e.target.style.borderColor='var(--border)'
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Position Management</div>
      {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={s.lbl}>Job Title *</div><Inp value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Security Officer"/></div>
            <div><div style={s.lbl}>Department</div><Inp value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value}))} placeholder="Operations"/></div>
            <div><div style={s.lbl}>Pay Type</div><select style={{...s.inp,cursor:'pointer'}} value={form.pay_type} onChange={e=>setForm(p=>({...p,pay_type:e.target.value}))} onFocus={foc} onBlur={blr}><option value="hourly">Hourly</option><option value="salary">Salary</option></select></div>
            <div><div style={s.lbl}>Pay Rate ($/hr or $/yr)</div><Inp value={form.pay_rate} onChange={e=>setForm(p=>({...p,pay_rate:e.target.value}))} type="number" placeholder="0"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={s.lbl}>Description</div><Inp value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Role responsibilities..."/></div>
          </div>
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            <button style={{...s.btn,height:'36px',fontSize:'12px',padding:'0 14px',opacity:(!form.title.trim()||saving)?0.6:1}} onClick={save} disabled={!form.title.trim()||saving}><Icon name="save" size={13}/>{saving?'SAVING...':editId?'UPDATE':'ADD POSITION'}</button>
            {editId && <button style={{...s.ghost,height:'36px',fontSize:'12px',padding:'0 12px'}} onClick={()=>{setEditId(null);setForm({title:'',department:'',pay_type:'hourly',pay_rate:'',description:''})}}>CANCEL</button>}
          </div>
          {positions.length===0 ? <div style={{fontSize:'13px',color:'var(--text-muted)'}}>No positions defined yet.</div>
            : <div style={{borderTop:'1px solid var(--border)'}}>
              {positions.map((p,i)=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 0',borderBottom:i<positions.length-1?'1px solid var(--border)':'none'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{p.title}</div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{p.department&&`${p.department} · `}{p.pay_type} {p.pay_rate?`· $${p.pay_rate}/${p.pay_type==='hourly'?'hr':'yr'}`:''}</div>
                  </div>
                  <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={()=>startEdit(p)}><Icon name="edit-2" size={14}/></button>
                  <button style={{background:'transparent',border:'none',color:'var(--color-danger)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={()=>del(p.id)}><Icon name="trash-2" size={14}/></button>
                </div>
              ))}
            </div>
          }
        </>
      )}
    </div>
  )
}

// ── Role Permissions Matrix ───────────────────────────────────────────────────

const PERM_GROUPS = [
  { group:'Operations', perms:[
    { id:'view_dashboard',     label:'View Dashboard' },
    { id:'manage_schedule',    label:'Manage Schedule' },
    { id:'approve_timesheets', label:'Approve Timesheets' },
    { id:'view_timesheets',    label:'View Timesheets' },
    { id:'clock_in_out',       label:'Clock In / Out' },
    { id:'view_incidents',     label:'View Incidents' },
    { id:'create_incidents',   label:'Create Incidents' },
    { id:'approve_incidents',  label:'Approve Incidents' },
    { id:'view_patrol',        label:'View Patrol' },
    { id:'create_patrol',      label:'Create Patrol' },
  ]},
  { group:'Personnel', perms:[
    { id:'view_personnel',        label:'View Personnel' },
    { id:'edit_personnel',        label:'Edit Personnel' },
    { id:'invite_employees',      label:'Invite Employees' },
    { id:'view_employee_profiles',label:'View Full Profiles' },
  ]},
  { group:'Admin', perms:[
    { id:'view_invoices',    label:'View Invoices' },
    { id:'create_invoices',  label:'Create Invoices' },
    { id:'view_reports',     label:'View Reports' },
    { id:'manage_sites',     label:'Manage Sites' },
    { id:'manage_clients',   label:'Manage Clients' },
    { id:'view_hr',          label:'View HR Docs' },
    { id:'manage_hr',        label:'Manage HR' },
    { id:'manage_settings',  label:'Manage Settings' },
    { id:'manage_billing',   label:'Manage Billing' },
  ]},
  { group:'Field', perms:[
    { id:'use_live_map', label:'Use Live Map' },
    { id:'use_sos',      label:'Use SOS' },
    { id:'view_ccw_map', label:'View CCW Map' },
  ]},
]
const PERM_ROLES = ['officer','corporal','sergeant','lieutenant','chief']
const PERM_ROLE_LABELS = { officer:'Officer', corporal:'Corporal', sergeant:'Sergeant', lieutenant:'Lieutenant', chief:'Chief' }

const DEFAULT_PERMS = {
  officer:    new Set(['view_dashboard','clock_in_out','view_timesheets','create_incidents','view_patrol','use_sos','view_ccw_map']),
  corporal:   new Set(['view_dashboard','clock_in_out','view_timesheets','approve_timesheets','create_incidents','view_incidents','view_patrol','use_sos','view_personnel','view_ccw_map']),
  sergeant:   new Set(['view_dashboard','clock_in_out','view_timesheets','approve_timesheets','manage_schedule','create_incidents','view_incidents','approve_incidents','view_patrol','create_patrol','use_sos','use_live_map','view_personnel','edit_personnel','invite_employees','view_employee_profiles','view_ccw_map']),
  lieutenant: new Set(['view_dashboard','view_timesheets','approve_timesheets','manage_schedule','view_incidents','approve_incidents','view_patrol','create_patrol','use_sos','use_live_map','view_personnel','edit_personnel','invite_employees','view_employee_profiles','view_invoices','view_reports','manage_sites','manage_clients','view_hr','view_ccw_map']),
  chief:      new Set(['view_dashboard','clock_in_out','view_timesheets','approve_timesheets','manage_schedule','view_incidents','create_incidents','approve_incidents','view_patrol','create_patrol','view_personnel','edit_personnel','invite_employees','view_employee_profiles','view_invoices','create_invoices','view_reports','manage_sites','manage_clients','view_hr','manage_hr','manage_settings','manage_billing','use_live_map','use_sos','view_ccw_map']),
}

function RolePermissionsMatrix({ companyId, profile }) {
  const toast = useToast()
  const [matrix, setMatrix] = useState(() => {
    const m = {}
    PERM_ROLES.forEach(r => { m[r] = new Set(DEFAULT_PERMS[r]) })
    return m
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('role_permission').select('role,permission,enabled').eq('company_id', companyId).then(({ data }) => {
      if (!data?.length) return
      const m = {}
      PERM_ROLES.forEach(r => { m[r] = new Set(DEFAULT_PERMS[r]) })
      for (const row of data) {
        if (!m[row.role]) m[row.role] = new Set()
        if (row.enabled) m[row.role].add(row.permission)
        else m[row.role].delete(row.permission)
      }
      setMatrix(m)
    })
  }, [companyId])

  function toggle(role, perm) {
    setMatrix(prev => {
      const m = { ...prev, [role]: new Set(prev[role]) }
      if (m[role].has(perm)) m[role].delete(perm)
      else m[role].add(perm)
      return m
    })
  }

  async function save() {
    setSaving(true); setMsg(null)
    const rows = []
    for (const role of PERM_ROLES) {
      const allPerms = PERM_GROUPS.flatMap(g => g.perms.map(p => p.id))
      for (const perm of allPerms) {
        rows.push({ company_id:companyId, role, permission:perm, enabled:matrix[role].has(perm), updated_at:new Date().toISOString() })
      }
    }
    const { error } = await supabase.from('role_permission').upsert(rows, { onConflict:'company_id,role,permission' })
    setSaving(false)
    if (!error) toast('Settings saved')
    setMsg(error ? { type:'err', text:error.message } : { type:'ok', text:'Permissions saved.' })
    setTimeout(() => setMsg(null), 3000)
  }

  function reset() {
    const m = {}
    PERM_ROLES.forEach(r => { m[r] = new Set(DEFAULT_PERMS[r]) })
    setMatrix(m)
    setMsg({ type:'ok', text:'Reset to defaults. Click SAVE to persist.' })
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div style={s.card}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <div style={s.cardTitle}>Roles & Permissions</div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button style={{ ...s.ghost, height:'34px', padding:'0 12px', fontSize:'11px' }} onClick={reset}>RESET TO DEFAULTS</button>
          <button style={{ ...s.btn, height:'34px', padding:'0 14px', fontSize:'11px', opacity:saving?0.6:1 }} onClick={save} disabled={saving}>
            <Icon name="save" size={12}/>{saving?'SAVING...':'SAVE PERMISSIONS'}
          </button>
        </div>
      </div>
      {msg && <Toast msg={msg.text} type={msg.type} />}
      <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'12px', lineHeight:1.5 }}>
        Your role is <strong style={{color:'var(--accent)'}}>{ROLE_LABELS[profile?.role]||profile?.role}</strong>. Changes here affect UI gating — Supabase RLS policies are the authoritative security layer.
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', fontSize:'12px', minWidth:'560px', width:'100%' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid var(--border)' }}>
              <th style={{ textAlign:'left', padding:'8px 10px', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', minWidth:'160px' }}>Permission</th>
              {PERM_ROLES.map(r => (
                <th key={r} style={{ textAlign:'center', padding:'8px 10px', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', minWidth:'76px' }}>{PERM_ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_GROUPS.map(group => (
              <>
                <tr key={`g-${group.group}`}>
                  <td colSpan={PERM_ROLES.length+1} style={{ padding:'10px 10px 4px', fontSize:'9px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'2px', fontFamily:'var(--font-condensed)', fontWeight:700, background:'var(--bg-surface)' }}>{group.group}</td>
                </tr>
                {group.perms.map(perm => (
                  <tr key={perm.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'7px 10px', color:'var(--text-secondary)', fontSize:'12px' }}>{perm.label}</td>
                    {PERM_ROLES.map(role => (
                      <td key={role} style={{ textAlign:'center', padding:'7px 10px' }}>
                        <input type="checkbox" checked={matrix[role]?.has(perm.id)||false} onChange={() => toggle(role, perm.id)}
                          style={{ width:'15px', height:'15px', accentColor:'var(--accent)', cursor:'pointer' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── State Licensing Tab ───────────────────────────────────────────────────────

const LICENSE_STATUSES = ['active','expired','pending','suspended']

function StateLicensingTab({ companyId }) {
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState(null)
  const [form, setForm] = useState({ state:'', license_type:'Security Services', license_number:'', issue_date:'', expiry_date:'', status:'active' })
  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('state_license').select('*').eq('company_id', companyId).order('state')
    setLicenses(data||[])
    setLoading(false)
  }

  async function save() {
    if (!form.state.trim()) return
    setSaving(true)
    const { error } = await supabase.from('state_license').insert({ company_id:companyId, ...form, state:form.state.toUpperCase().slice(0,2), issue_date:form.issue_date||null, expiry_date:form.expiry_date||null })
    setSaving(false)
    if (error) { setMsg({ type:'err', text:error.message }); return }
    setShowAdd(false); setForm({ state:'', license_type:'Security Services', license_number:'', issue_date:'', expiry_date:'', status:'active' }); load()
  }

  async function del(id) {
    if (!window.confirm('Remove this license?')) return
    await supabase.from('state_license').delete().eq('id', id)
    load()
  }

  function isExpired(date) { return date && new Date(date) < new Date() }
  function isExpiringSoon(date) {
    if (!date) return false
    const diff = (new Date(date) - new Date()) / 86400000
    return diff >= 0 && diff <= 60
  }

  if (loading) return <div style={{...s.card,color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <>
      <div style={s.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
          <div style={s.cardTitle}>State Licenses ({licenses.length})</div>
          <button style={{ ...s.btn, height:'34px', padding:'0 14px', fontSize:'12px' }} onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={13}/>ADD LICENSE
          </button>
        </div>
        {msg && <Toast msg={msg.text} type={msg.type} />}

        {showAdd && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'16px', marginBottom:'16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              <div><div style={s.lbl}>State (2-letter) *</div><input style={s.inp} maxLength={2} value={form.state} onChange={e=>setForm(p=>({...p,state:e.target.value.toUpperCase()}))} onFocus={foc} onBlur={blr} placeholder="MD"/></div>
              <div><div style={s.lbl}>License Type</div><input style={s.inp} value={form.license_type} onChange={e=>setForm(p=>({...p,license_type:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
              <div><div style={s.lbl}>License Number</div><input style={s.inp} value={form.license_number} onChange={e=>setForm(p=>({...p,license_number:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="MD-SEC-12345"/></div>
              <div><div style={s.lbl}>Status</div><select style={{...s.inp,cursor:'pointer'}} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{LICENSE_STATUSES.map(st=><option key={st} value={st}>{st}</option>)}</select></div>
              <div><div style={s.lbl}>Issue Date</div><input style={s.inp} type="date" value={form.issue_date} onChange={e=>setForm(p=>({...p,issue_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
              <div><div style={s.lbl}>Expiry Date</div><input style={s.inp} type="date" value={form.expiry_date} onChange={e=>setForm(p=>({...p,expiry_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={{ ...s.btn, height:'36px', fontSize:'12px', padding:'0 14px', opacity:saving?0.6:1 }} onClick={save} disabled={saving}><Icon name="save" size={13}/>{saving?'SAVING...':'SAVE'}</button>
              <button style={{ ...s.ghost, height:'36px', fontSize:'12px', padding:'0 12px' }} onClick={()=>setShowAdd(false)}>CANCEL</button>
            </div>
          </div>
        )}

        {licenses.length === 0 ? (
          <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'20px 0' }}>No state licenses on file. Add your first license above.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['State','Type','License #','Issue Date','Expiry Date','Status',''].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 10px', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {licenses.map(lic => {
                const expired = isExpired(lic.expiry_date)
                const soon = !expired && isExpiringSoon(lic.expiry_date)
                const statusColor = lic.status==='active'&&!expired ? 'var(--color-success)' : expired ? 'var(--color-danger)' : soon ? 'var(--color-warning)' : 'var(--text-muted)'
                const fmt = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
                return (
                  <tr key={lic.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--accent)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>{lic.state}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-secondary)' }}>{lic.license_type}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-primary)', fontFamily:'monospace', fontSize:'11px' }}>{lic.license_number||'—'}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{fmt(lic.issue_date)}</td>
                    <td style={{ padding:'8px 10px', color:expired?'var(--color-danger)':soon?'var(--color-warning)':'var(--text-muted)' }}>{fmt(lic.expiry_date)}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 7px', borderRadius:'10px', background:`${statusColor}22`, color:statusColor, fontFamily:'var(--font-condensed)', textTransform:'uppercase' }}>
                        {expired?'EXPIRED':soon?'EXPIRING':lic.status}
                      </span>
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <button onClick={()=>del(lic.id)} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'2px', display:'flex' }}><Icon name="trash-2" size={13}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Supervisor Assignment Tab ─────────────────────────────────────────────────

function SupervisorAssignmentTab({ companyId }) {
  const [employees, setEmployees]     = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [selectedSup, setSelectedSup] = useState('')
  const [assignments, setAssignments] = useState(new Set()) // employee IDs assigned to selectedSup
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState(null)

  const SUP_ROLES = ['sergeant','lieutenant','chief','super_admin','corporal']

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', companyId).eq('status','active').order('last_name')
    const emps = data||[]
    setEmployees(emps)
    setSupervisors(emps.filter(e => SUP_ROLES.includes(e.role)))
    setLoading(false)
  }

  useEffect(() => {
    if (!selectedSup || !companyId) return
    supabase.from('supervisor_assignment').select('employee_id').eq('company_id', companyId).eq('supervisor_id', selectedSup)
      .then(({ data }) => setAssignments(new Set((data||[]).map(r=>r.employee_id))))
  }, [selectedSup, companyId])

  function toggle(empId) {
    setAssignments(prev => {
      const next = new Set(prev)
      next.has(empId) ? next.delete(empId) : next.add(empId)
      return next
    })
  }

  async function save() {
    if (!selectedSup) return
    setSaving(true); setMsg(null)
    // Delete existing, re-insert selected
    await supabase.from('supervisor_assignment').delete().eq('company_id', companyId).eq('supervisor_id', selectedSup)
    if (assignments.size > 0) {
      const rows = [...assignments].map(empId => ({ company_id:companyId, supervisor_id:selectedSup, employee_id:empId }))
      await supabase.from('supervisor_assignment').insert(rows)
    }
    setSaving(false)
    setMsg({ type:'ok', text:'Assignments saved.' })
    setTimeout(()=>setMsg(null), 3000)
  }

  const sup = employees.find(e=>e.id===selectedSup)
  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  if (loading) return <div style={{...s.card,color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <>
      <div style={s.card}>
        <div style={s.cardTitle}>Supervisor Assignment</div>
        <div style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'16px',lineHeight:1.6}}>
          Assign employees to supervisors for reporting visibility and change log access. Sergeants and Corporals can only view records of employees assigned to them.
        </div>
        {msg && <Toast msg={msg.text} type={msg.type}/>}
        <div style={{marginBottom:'16px'}}>
          <div style={s.lbl}>Select Supervisor</div>
          <select style={{...s.inp,cursor:'pointer'}} value={selectedSup} onChange={e=>setSelectedSup(e.target.value)} onFocus={foc} onBlur={blr}>
            <option value="">Choose a supervisor...</option>
            {supervisors.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({ROLE_LABELS[e.role]||e.role})</option>)}
          </select>
        </div>

        {selectedSup && (
          <>
            <div style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>
              Employees assigned to {sup?.first_name} {sup?.last_name} ({assignments.size} selected)
            </div>
            <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-md)',maxHeight:'300px',overflowY:'auto',marginBottom:'16px'}}>
              {employees.filter(e=>e.id!==selectedSup).map((emp,i) => (
                <label key={emp.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',borderBottom:i<employees.length-2?'1px solid var(--border)':'none',cursor:'pointer',background:assignments.has(emp.id)?'var(--accent-bg)':'transparent',transition:'background 150ms ease'}}>
                  <input type="checkbox" checked={assignments.has(emp.id)} onChange={()=>toggle(emp.id)} style={{accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer',flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:500,color:'var(--text-primary)'}}>{emp.first_name} {emp.last_name}</div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{emp.position_title||ROLE_LABELS[emp.role]||emp.role}</div>
                  </div>
                </label>
              ))}
              {employees.filter(e=>e.id!==selectedSup).length===0 && (
                <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>No other active employees found.</div>
              )}
            </div>
            <button style={{...s.btn,opacity:saving?0.6:1}} onClick={save} disabled={saving}>
              <Icon name="save" size={14}/>{saving?'SAVING...':'SAVE ASSIGNMENTS'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
