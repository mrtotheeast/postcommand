import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'

const TABS = [
  { id: 'profile',     label: 'Profile',      icon: 'user' },
  { id: 'appearance',  label: 'Appearance',   icon: 'monitor' },
  { id: 'operational', label: 'Operational',  icon: 'sliders' },
  { id: 'company',     label: 'Company',      icon: 'briefcase' },
  { id: 'roles',       label: 'Roles',        icon: 'shield' },
  { id: 'audit',       label: 'Audit Log',    icon: 'activity' },
  { id: 'security',    label: 'Security',     icon: 'lock' },
]

const s = {
  page:    { padding: '24px', maxWidth: '900px', animation: 'fadeIn 200ms ease' },
  heading: { fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '4px' },
  sub:     { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '28px' },
  layout:  { display: 'flex', gap: '20px', alignItems: 'flex-start' },
  tabs:    { width: '180px', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px' },
  tab:     { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 14px', fontSize: '13px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', textAlign: 'left', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font-condensed)', letterSpacing: '0.5px' },
  tabActive: { color: 'var(--accent)', background: 'var(--accent-bg)', fontWeight: 600 },
  panel:   { flex: 1, minWidth: 0 },
  card:    { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '16px' },
  cardTitle: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'var(--font-condensed)', marginBottom: '18px' },
  row:     { display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' },
  field:   { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' },
  label:   { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)' },
  input:   { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontFamily: 'var(--font-body)', transition: 'border-color 150ms ease' },
  inputRo: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '14px', color: 'var(--text-muted)', width: '100%', fontFamily: 'var(--font-body)', cursor: 'not-allowed' },
  btn:     { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 20px', height: '42px', fontFamily: 'var(--font-condensed)', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer', transition: 'opacity 150ms ease' },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 20px', height: '42px', fontFamily: 'var(--font-condensed)', fontSize: '13px', letterSpacing: '1px', cursor: 'pointer', transition: 'all 150ms ease' },
  btnDanger: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius-sm)', padding: '0 20px', height: '42px', fontFamily: 'var(--font-condensed)', fontSize: '13px', letterSpacing: '1px', cursor: 'pointer' },
  toast:   { fontSize: '13px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  toastOk: { background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid rgba(58,170,106,0.3)' },
  toastErr:{ background: 'var(--color-danger-bg)',  color: 'var(--color-danger)',  border: '1px solid rgba(192,57,43,0.3)' },
  toggle:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' },
  toggleLabel: { display: 'flex', flexDirection: 'column', gap: '2px' },
  toggleName:  { fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 },
  toggleDesc:  { fontSize: '12px', color: 'var(--text-muted)' },
  switch:  { position: 'relative', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 },
  switchTrack: { position: 'absolute', inset: 0, borderRadius: '12px', transition: 'background 200ms ease' },
  switchThumb: { position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'left 200ms ease' },
  themeCard: { display: 'flex', gap: '12px', marginTop: '4px' },
  themeOpt: { flex: 1, borderRadius: 'var(--radius-md)', padding: '16px 14px', cursor: 'pointer', border: '2px solid transparent', transition: 'all 150ms ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  sliderRow: { display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' },
  slider:  { flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: '4px' },
  sliderVal: { fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--accent)', letterSpacing: '1px', minWidth: '60px', textAlign: 'right' },
}

function Toast({ msg, type }) {
  if (!msg) return null
  return <div style={{ ...s.toast, ...(type === 'ok' ? s.toastOk : s.toastErr) }}><Icon name={type === 'ok' ? 'check-circle' : 'alert-circle'} size={15} />{msg}</div>
}

function Switch({ on, onToggle }) {
  return (
    <div style={s.switch} role="switch" aria-checked={on} tabIndex={0} onClick={onToggle} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>
      <div style={{ ...s.switchTrack, background: on ? 'var(--accent)' : 'var(--border)' }} />
      <div style={{ ...s.switchThumb, left: on ? '22px' : '2px' }} />
    </div>
  )
}

function getOpsKey(companyId) { return `pc-ops-${companyId}` }
function loadOps(companyId) {
  try { return JSON.parse(localStorage.getItem(getOpsKey(companyId)) || '{}') } catch { return {} }
}
function saveOps(companyId, ops) {
  localStorage.setItem(getOpsKey(companyId), JSON.stringify(ops))
}

export default function Settings() {
  const { profile, companyId } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab] = useState('profile')

  // Profile tab
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  // Operational tab
  const [ops, setOps] = useState({ geofenceRadius: 150, requirePhotos: true, earlyClockIn: 15 })
  const [opsSaved, setOpsSaved] = useState(false)

  // Security tab
  const [resetSent, setResetSent] = useState(false)
  const [resetErr, setResetErr] = useState(null)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setPhone(profile.phone || '')
    }
    if (companyId) {
      const saved = loadOps(companyId)
      setOps(prev => ({ ...prev, ...saved }))
    }
  }, [profile, companyId])

  async function saveProfile() {
    setProfileSaving(true)
    setProfileMsg(null)
    const { error } = await supabase
      .from('user_profile')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() })
      .eq('id', profile.id)
    setProfileSaving(false)
    setProfileMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Profile updated.' })
    setTimeout(() => setProfileMsg(null), 3000)
  }

  function saveOperational() {
    saveOps(companyId, ops)
    setOpsSaved(true)
    setTimeout(() => setOpsSaved(false), 2500)
  }

  function updateOps(key, val) { setOps(prev => ({ ...prev, [key]: val })) }

  async function sendPasswordReset() {
    setResetSent(false)
    setResetErr(null)
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/login`
    })
    if (error) setResetErr(error.message)
    else setResetSent(true)
  }

  const inputFocus = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const inputBlur  = e => { e.target.style.borderColor = 'var(--border)' }

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>SETTINGS</h2>
      <p style={s.sub}>Manage your profile, appearance, and system configuration.</p>

      <div style={s.layout}>
        {/* Tab list */}
        <div style={s.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div style={s.panel}>

          {/* ── Profile ── */}
          {tab === 'profile' && (
            <>
              <div style={s.card}>
                <div style={s.cardTitle}>Personal Info</div>
                {profileMsg && <Toast msg={profileMsg.text} type={profileMsg.type} />}
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>First Name</label>
                    <input style={s.input} value={firstName} onChange={e => setFirstName(e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Last Name</label>
                    <input style={s.input} value={lastName} onChange={e => setLastName(e.target.value)} onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Email</label>
                    <div style={s.inputRo}>{profile?.email}</div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Phone</label>
                    <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} onFocus={inputFocus} onBlur={inputBlur} placeholder="(555) 000-0000" />
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button style={{ ...s.btn, opacity: profileSaving ? 0.6 : 1 }} onClick={saveProfile} disabled={profileSaving}>
                    <Icon name="save" size={14} />{profileSaving ? 'SAVING...' : 'SAVE PROFILE'}
                  </button>
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Account Info</div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Role', value: profile?.role?.replace(/_/g, ' ').toUpperCase() ?? '—' },
                    { label: 'Company', value: profile?.company_slug?.toUpperCase() ?? '—' },
                    { label: 'User ID', value: profile?.id?.slice(0, 8) + '...' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={s.label}>{item.label}</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px', fontFamily: item.label === 'Role' ? 'var(--font-condensed)' : 'var(--font-body)', letterSpacing: item.label === 'Role' ? '0.5px' : 0 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Appearance ── */}
          {tab === 'appearance' && (
            <div style={s.card}>
              <div style={s.cardTitle}>Theme</div>
              <div style={s.themeCard}>
                {[
                  { id: 'dark',  label: 'Dark',  bg: '#0d0f14', surface: '#1a1d2a', accent: '#c8a84b', text: '#f0f2f8' },
                  { id: 'light', label: 'Light', bg: '#f0f4f8', surface: '#ffffff', accent: '#a8841e', text: '#0d1f35' },
                ].map(opt => {
                  const active = theme === opt.id
                  return (
                    <button key={opt.id} style={{ ...s.themeOpt, background: opt.bg, border: `2px solid ${active ? opt.accent : 'transparent'}`, boxShadow: active ? `0 0 0 1px ${opt.accent}` : 'none' }} onClick={() => { if (theme !== opt.id) toggleTheme() }}>
                      <div style={{ width: '100%', height: '56px', borderRadius: '6px', background: opt.surface, border: `1px solid ${opt.accent}22`, display: 'flex', alignItems: 'center', padding: '10px', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.accent }} />
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: opt.accent + '44' }} />
                      </div>
                      <div style={{ fontSize: '12px', color: opt.text, fontFamily: 'var(--font-condensed)', letterSpacing: '1px', fontWeight: active ? 700 : 400 }}>
                        {opt.label.toUpperCase()}{active ? ' ✓' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Operational ── */}
          {tab === 'operational' && (
            <div style={s.card}>
              <div style={s.cardTitle}>Field Operations</div>
              {opsSaved && <Toast msg="Settings saved." type="ok" />}

              <div style={{ ...s.toggle, borderBottom: 'none', paddingTop: 0 }}>
                <div style={s.toggleLabel}>
                  <span style={s.toggleName}>Geofence Radius</span>
                  <span style={s.toggleDesc}>Max distance from site for clock-in</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '200px' }}>
                  <div style={s.sliderRow}>
                    <input type="range" min={50} max={500} step={10} value={ops.geofenceRadius} onChange={e => updateOps('geofenceRadius', Number(e.target.value))} style={s.slider} />
                    <span style={s.sliderVal}>{ops.geofenceRadius}m</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>50m — 500m</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />

              <div style={{ ...s.toggle, borderBottom: '1px solid var(--border)' }}>
                <div style={s.toggleLabel}>
                  <span style={s.toggleName}>Require Clock-In Photo</span>
                  <span style={s.toggleDesc}>Officers must submit a photo when clocking in</span>
                </div>
                <Switch on={ops.requirePhotos} onToggle={() => updateOps('requirePhotos', !ops.requirePhotos)} />
              </div>

              <div style={{ ...s.toggle, borderBottom: '1px solid var(--border)' }}>
                <div style={s.toggleLabel}>
                  <span style={s.toggleName}>Require Clock-Out Photo</span>
                  <span style={s.toggleDesc}>Officers must submit a photo when clocking out</span>
                </div>
                <Switch on={ops.requireClockOutPhoto ?? true} onToggle={() => updateOps('requireClockOutPhoto', !(ops.requireClockOutPhoto ?? true))} />
              </div>

              <div style={{ ...s.toggle, borderBottom: 'none', paddingBottom: 0 }}>
                <div style={s.toggleLabel}>
                  <span style={s.toggleName}>Early Clock-In Window</span>
                  <span style={s.toggleDesc}>Minutes before shift start that officers can clock in</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '200px' }}>
                  <div style={s.sliderRow}>
                    <input type="range" min={0} max={60} step={5} value={ops.earlyClockIn} onChange={e => updateOps('earlyClockIn', Number(e.target.value))} style={s.slider} />
                    <span style={s.sliderVal}>{ops.earlyClockIn}m</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0 — 60 min</div>
                </div>
              </div>

              <div style={{ marginTop: '22px' }}>
                <button style={s.btn} onClick={saveOperational}>
                  <Icon name="save" size={14} />SAVE SETTINGS
                </button>
              </div>
            </div>
          )}

          {/* ── Company ── */}
          {tab === 'company' && (
            <CompanyTab profile={profile} companyId={companyId} />
          )}

          {/* ── Roles ── */}
          {tab === 'roles' && (
            <RolesPanel companyId={companyId} />
          )}

          {/* ── Audit Log ── */}
          {tab === 'audit' && (
            <AuditLog companyId={companyId} />
          )}

          {/* ── Security ── */}
          {tab === 'security' && (
            <div style={s.card}>
              <div style={s.cardTitle}>Security</div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>Change Password</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                  A password reset link will be sent to <strong style={{ color: 'var(--text-secondary)' }}>{profile?.email}</strong>.
                </div>
                {resetSent && <Toast msg="Reset link sent — check your email." type="ok" />}
                {resetErr  && <Toast msg={resetErr} type="err" />}
                <button style={s.btnGhost} onClick={sendPasswordReset}>
                  <Icon name="mail" size={14} />SEND RESET LINK
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>Session</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>Signed in as {profile?.email}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Company Tab ───────────────────────────────────────────────────────────────

function CompanyTab({ profile, companyId }) {
  const STORAGE_KEY = `pc-company-${companyId}`
  const [form, setForm]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
  })
  const [saved, setSaved] = useState(false)

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
  const inputF = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor = 'var(--border)' }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    if (form.primaryColor) {
      document.documentElement.style.setProperty('--accent', form.primaryColor)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function resetColor() {
    document.documentElement.style.removeProperty('--accent')
    setF('primaryColor', '')
  }

  const s2 = {
    card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'24px', marginBottom:'16px' },
    cardTitle:{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'18px' },
    label:   { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
    input:   { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'14px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
    row:     { display:'flex', gap:'14px', marginBottom:'14px', flexWrap:'wrap' },
    field:   { display:'flex', flexDirection:'column', gap:'6px', flex:1, minWidth:'180px' },
    fieldFull:{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px' },
    btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
    ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
    toast:   { fontSize:'13px', padding:'10px 14px', borderRadius:'var(--radius-sm)', marginBottom:'16px', display:'flex', alignItems:'center', gap:'8px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)' },
  }

  return (
    <>
      <div style={s2.card}>
        <div style={s2.cardTitle}>Company Identity</div>
        {saved && <div style={s2.toast}><Icon name="check-circle" size={15} />Branding saved.</div>}
        <div style={s2.row}>
          <div style={s2.field}>
            <div style={s2.label}>Company Slug</div>
            <div style={{ ...s2.input, color:'var(--text-muted)', cursor:'not-allowed', background:'var(--bg-input)' }}>{profile?.company_slug?.toUpperCase() ?? '—'}</div>
          </div>
          <div style={s2.field}>
            <div style={s2.label}>Display Name (override)</div>
            <input style={s2.input} value={form.displayName || ''} onChange={e => setF('displayName', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder={profile?.company_slug?.toUpperCase()} />
          </div>
        </div>
        <div style={s2.fieldFull}>
          <div style={s2.label}>Logo URL</div>
          <input style={s2.input} value={form.logoUrl || ''} onChange={e => setF('logoUrl', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="https://your-cdn.com/logo.png" />
        </div>
        {form.logoUrl && (
          <div style={{ marginTop:'4px', marginBottom:'14px' }}>
            <img src={form.logoUrl} alt="Company logo preview" style={{ maxHeight:'60px', maxWidth:'200px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', padding:'6px', background:'var(--bg-surface)' }} onError={e => { e.target.style.display='none' }} />
          </div>
        )}
        <div style={s2.row}>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <div style={s2.label}>Primary / Accent Color</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <input type="color" value={form.primaryColor || '#c8a84b'} onChange={e => setF('primaryColor', e.target.value)} style={{ width:'44px', height:'44px', padding:'2px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer', background:'var(--bg-input)' }} />
              <input style={{ ...s2.input, width:'120px' }} value={form.primaryColor || ''} onChange={e => setF('primaryColor', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="#c8a84b" />
              <button style={s2.ghost} onClick={resetColor}><Icon name="refresh-cw" size={13} />RESET</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop:'8px' }}>
          <button style={s2.btn} onClick={save}>
            <Icon name="save" size={14} />SAVE BRANDING
          </button>
        </div>
      </div>

      <div style={s2.card}>
        <div style={s2.cardTitle}>Account Info</div>
        <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
          {[
            { label:'Company ID', value: companyId?.slice(0,8)+'...' },
            { label:'Plan',       value: 'Enterprise' },
            { label:'Region',     value: 'US-East' },
          ].map(item => (
            <div key={item.label}>
              <div style={s2.label}>{item.label}</div>
              <div style={{ fontSize:'13px', color:'var(--text-secondary)', marginTop:'4px' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLog({ companyId }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    // Aggregate recent activity across tables
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [{ data: ts }, { data: inc }, { data: sos }, { data: patrols }, { data: emps }, { data: inv }] = await Promise.all([
      supabase.from('timesheet').select('id,employee_id,status,date,clock_in,clock_out').eq('company_id', companyId).gte('clock_in', since).order('clock_in', { ascending:false }).limit(30),
      supabase.from('incident_report').select('id,cad_number,incident_type,status,created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending:false }).limit(30),
      supabase.from('sos_alert').select('id,employee_id,status,triggered_at,resolved_at').eq('company_id', companyId).gte('triggered_at', since).order('triggered_at', { ascending:false }).limit(20),
      supabase.from('patrol_log').select('id,employee_id,site_id,status,started_at,ended_at').eq('company_id', companyId).gte('started_at', since).order('started_at', { ascending:false }).limit(20),
      supabase.from('employee').select('id,first_name,last_name,created_at,status').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending:false }).limit(20),
      supabase.from('invoice').select('id,invoice_number,client_name,status,created_at').eq('company_id', companyId).gte('created_at', since).order('created_at', { ascending:false }).limit(20),
    ])

    const all = [
      ...(ts||[]).map(t => ({ id:'ts-'+t.id, type:'timesheet', icon:'clock', color:'var(--color-info)', label:`Timesheet ${t.status}`, detail:`${t.date}`, time: t.clock_in, category:'timesheets' })),
      ...(inc||[]).map(i => ({ id:'inc-'+i.id, type:'incident', icon:'file-check', color:'var(--color-danger)', label:`Incident: ${i.incident_type}`, detail:`${i.cad_number} · ${i.status}`, time: i.created_at, category:'incidents' })),
      ...(sos||[]).map(s => ({ id:'sos-'+s.id, type:'sos', icon:'alert-triangle', color:'#e05555', label:`SOS ${s.status === 'resolved' ? 'Resolved' : 'Triggered'}`, detail: s.resolved_at ? `Resolved` : 'Active', time: s.status === 'resolved' ? s.resolved_at : s.triggered_at, category:'sos' })),
      ...(patrols||[]).map(p => ({ id:'pat-'+p.id, type:'patrol', icon:'activity', color:'var(--accent)', label:`Patrol ${p.status}`, detail: p.ended_at ? `Completed` : 'In progress', time: p.started_at, category:'patrol' })),
      ...(emps||[]).map(e => ({ id:'emp-'+e.id, type:'employee', icon:'user', color:'var(--color-success)', label:`Employee added`, detail:`${e.first_name} ${e.last_name}`, time: e.created_at, category:'employees' })),
      ...(inv||[]).map(i => ({ id:'inv-'+i.id, type:'invoice', icon:'credit-card', color:'var(--color-warning)', label:`Invoice ${i.status}`, detail:`${i.invoice_number} · ${i.client_name}`, time: i.created_at, category:'invoices' })),
    ].sort((a,b) => new Date(b.time) - new Date(a.time))

    setEvents(all)
    setLoading(false)
  }

  const visible = filter === 'all' ? events : events.filter(e => e.category === filter)

  const s2 = {
    card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'16px' },
    toolbar: { display:'flex', gap:'10px', marginBottom:'16px', alignItems:'center' },
    sel:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' },
    row:     { display:'flex', alignItems:'flex-start', gap:'12px', padding:'12px 18px', borderBottom:'1px solid var(--border)', fontSize:'13px' },
    dot:     { width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' },
    label:   { fontSize:'13px', color:'var(--text-primary)', fontWeight:500 },
    detail:  { fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' },
    time:    { fontSize:'11px', color:'var(--text-muted)', flexShrink:0, marginLeft:'auto', textAlign:'right', paddingTop:'1px' },
  }

  function fmtTime(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
  }

  return (
    <>
      <div style={s2.toolbar}>
        <select style={s2.sel} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Activity</option>
          <option value="timesheets">Timesheets</option>
          <option value="incidents">Incidents</option>
          <option value="sos">SOS</option>
          <option value="patrol">Patrol</option>
          <option value="employees">Employees</option>
          <option value="invoices">Invoices</option>
        </select>
        <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Last 30 days · {visible.length} events</span>
      </div>
      <div style={s2.card}>
        {loading ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontSize:'12px' }}>LOADING...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--text-muted)', fontSize:'13px' }}>No activity in the last 30 days.</div>
        ) : visible.slice(0, 80).map((ev, i) => (
          <div key={ev.id} style={{ ...s2.row, borderBottom: i < Math.min(visible.length, 80) - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ ...s2.dot, background: `${ev.color}22` }}>
              <Icon name={ev.icon} size={14} color={ev.color} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={s2.label}>{ev.label}</div>
              <div style={s2.detail}>{ev.detail}</div>
            </div>
            <div style={s2.time}>{fmtTime(ev.time)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Roles & Permissions Panel ─────────────────────────────────────────────────

const ROLE_LABELS_MAP = { super_admin:'Chief App Admin', chief:'Chief', lieutenant:'Lieutenant', sergeant:'Sergeant', corporal:'Corporal', officer:'Officer', hr:'HR', accounting:'Accounting', office_staff:'Office Staff', client:'Client' }
const ROLE_COLORS_MAP = {
  super_admin:{bg:'rgba(201,162,39,0.15)',color:'#c9a227'},chief:{bg:'rgba(201,162,39,0.15)',color:'#c9a227'},
  lieutenant:{bg:'rgba(91,159,224,0.15)',color:'#5b9fe0'},sergeant:{bg:'rgba(91,159,224,0.12)',color:'#4a8ec0'},
  corporal:{bg:'rgba(58,170,106,0.12)',color:'#3aaa6a'},officer:{bg:'rgba(58,170,106,0.12)',color:'#3aaa6a'},
  hr:{bg:'rgba(160,122,224,0.15)',color:'#a07ae0'},accounting:{bg:'rgba(160,122,224,0.15)',color:'#a07ae0'},
  office_staff:{bg:'rgba(130,130,130,0.15)',color:'#8899aa'},client:{bg:'rgba(232,148,58,0.15)',color:'#e8943a'},
}
const ROLE_ORDER = ['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff','client']

function RolesPanel({ companyId }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [saving, setSaving]       = useState(null)
  const [filterRole, setFilterRole] = useState('all')

  useEffect(() => { if (companyId) loadR() }, [companyId])

  async function loadR() {
    setLoading(true)
    const { data } = await supabase.from('employee')
      .select('id,first_name,last_name,role,status,position_title,email')
      .eq('company_id', companyId).eq('status','active').order('last_name')
    setEmployees(data || []); setLoading(false)
  }

  async function changeRole(empId, newRole) {
    setSaving(empId)
    await supabase.from('employee').update({ role: newRole }).eq('id', empId)
    setSaving(null); loadR()
  }

  const filtered = employees.filter(e => {
    if (filterRole !== 'all' && e.role !== filterRole) return false
    if (search) { const q=search.toLowerCase(); if (!`${e.first_name} ${e.last_name}`.toLowerCase().includes(q)) return false }
    return true
  })
  const roleCounts = {}
  for (const e of employees) { roleCounts[e.role] = (roleCounts[e.role]||0)+1 }

  if (loading) return <div style={{ padding:'20px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontSize:'12px' }}>LOADING...</div>

  return (
    <>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'14px' }}>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' }}>Role Distribution — {employees.length} Active</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'8px', marginBottom:'18px' }}>
          {ROLE_ORDER.filter(r=>roleCounts[r]).map(role => {
            const rc = ROLE_COLORS_MAP[role]||{}
            return (
              <button key={role} onClick={()=>setFilterRole(filterRole===role?'all':role)} style={{ background:filterRole===role?rc.bg:'var(--bg-surface)', border:`1px solid ${filterRole===role?rc.color+'44':'var(--border)'}`, borderRadius:'var(--radius-sm)', padding:'10px 12px', cursor:'pointer', transition:'all 150ms ease', textAlign:'left' }}>
                <div style={{ fontSize:'22px', fontFamily:'var(--font-display)', color:rc.color, letterSpacing:'1px', lineHeight:1 }}>{roleCounts[role]}</div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'var(--font-condensed)', marginTop:'2px' }}>{ROLE_LABELS_MAP[role]?.split(' ')[0]}</div>
              </button>
            )
          })}
        </div>

        <input
          style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', marginBottom:'14px', transition:'border-color 150ms ease' }}
          placeholder="Search employees..."
          value={search} onChange={e=>setSearch(e.target.value)}
          onFocus={e=>e.target.style.borderColor='var(--border-focus)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />

        {filtered.map(emp => {
          const rc = ROLE_COLORS_MAP[emp.role]||{}
          return (
            <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                {emp.first_name?.[0]}{emp.last_name?.[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{emp.first_name} {emp.last_name}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'1px' }}>{emp.position_title||emp.email||'—'}</div>
              </div>
              <select
                value={emp.role}
                onChange={e=>changeRole(emp.id,e.target.value)}
                disabled={saving===emp.id}
                style={{ background:rc.bg, border:`1px solid ${rc.color}44`, color:rc.color, borderRadius:'var(--radius-sm)', padding:'5px 8px', fontSize:'12px', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px', cursor:'pointer', outline:'none', opacity:saving===emp.id?0.5:1, flexShrink:0 }}
              >
                {ROLE_ORDER.map(r=><option key={r} value={r}>{ROLE_LABELS_MAP[r]}</option>)}
              </select>
            </div>
          )
        })}
        {filtered.length===0&&<div style={{ padding:'20px 0', textAlign:'center', fontSize:'13px', color:'var(--text-muted)' }}>No employees found.</div>}
      </div>
    </>
  )
}
