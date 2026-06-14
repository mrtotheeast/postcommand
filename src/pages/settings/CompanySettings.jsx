import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import { useToast } from '../../components/ui/Toast'
import Icon from '../../components/ui/Icon'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const inp = { width:'100%', padding:'10px 12px', background:'var(--bg-input)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'13px', outline:'none', boxSizing:'border-box', height:'44px' }
const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', display:'block', marginBottom:'6px' }
const card = { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'16px' }
const sectionTitle = { fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'16px', paddingBottom:'10px', borderBottom:'1px solid var(--border)' }

function Toggle({ label, sub, checked, onChange, disabled }) {
  return (
    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <div>
        <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:600 }}>{label}</div>
        {sub && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{sub}</div>}
      </div>
      <div onClick={() => !disabled && onChange(!checked)}
        style={{ width:'44px', height:'24px', borderRadius:'12px', background: checked ? 'var(--accent)' : 'var(--border-subtle)', position:'relative', transition:'background 200ms ease', flexShrink:0, marginLeft:'16px' }}>
        <div style={{ position:'absolute', top:'3px', left: checked ? '23px' : '3px', width:'18px', height:'18px', borderRadius:'50%', background:'white', transition:'left 200ms ease', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
      </div>
    </label>
  )
}

function Field({ label, sub, children }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <label style={lbl}>{label}</label>
      {sub && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'8px' }}>{sub}</div>}
      {children}
    </div>
  )
}

export default function CompanySettings() {
  const { profile } = useAuth()
  const toast = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('ot')

  const canEdit = atLeast(profile?.role, 'chief')

  useEffect(() => {
    if (!profile?.company_id) return
    loadSettings()
  }, [profile?.company_id])

  async function loadSettings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (error) { toast('Failed to load settings', 'error'); setLoading(false); return }

    if (!data) {
      // Create default settings row
      const { data: newData } = await supabase
        .from('company_settings')
        .insert({ company_id: profile.company_id })
        .select()
        .single()
      setSettings(newData)
    } else {
      setSettings(data)
    }
    setLoading(false)
  }

  function update(field, value) {
    setSettings(s => ({ ...s, [field]: value }))
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    const { error } = await supabase
      .from('company_settings')
      .update({
        ot_weekly_hours: settings.ot_weekly_hours,
        ot_week_start: settings.ot_week_start,
        pay_period_type: settings.pay_period_type,
        pay_period_start_date: settings.pay_period_start_date,
        shift_swap_min_hours_before: settings.shift_swap_min_hours_before,
        shift_drop_min_hours_before: settings.shift_drop_min_hours_before,
        shift_swap_requires_approval: settings.shift_swap_requires_approval,
        desktop_clockin_enabled: settings.desktop_clockin_enabled,
        mobile_geofence_enabled: settings.mobile_geofence_enabled,
        geofence_check_interval_minutes: settings.geofence_check_interval_minutes,
        geofence_clock_in_required: settings.geofence_clock_in_required,
        geofence_allow_poor_signal: settings.geofence_allow_poor_signal,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', profile.company_id)

    if (error) { toast('Failed to save settings', 'error') }
    else { toast('Settings saved') }
    setSaving(false)
  }

  const TABS = [
    { id:'ot', label:'Overtime', icon:'clock' },
    { id:'swaps', label:'Shift Swaps', icon:'repeat' },
    { id:'clockin', label:'Clock-In & Geofence', icon:'map-pin' },
  ]

  if (loading) return (
    <div style={{ padding:'24px' }}>
      <div style={{ height:'32px', width:'200px', borderRadius:'8px' }} className="skeleton"/>
      <div style={{ height:'200px', borderRadius:'12px', marginTop:'16px' }} className="skeleton"/>
    </div>
  )

  if (!settings) return null

  return (
    <div style={{ padding:'24px', maxWidth:'720px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>COMPANY SETTINGS</h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>Overtime rules, shift policies, and clock-in configuration</p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
            <Icon name="save" size={16}/>{saving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        )}
      </div>

      {!canEdit && (
        <div style={{ padding:'12px 16px', background:'rgba(91,159,224,0.1)', border:'1px solid rgba(91,159,224,0.3)', borderRadius:'var(--radius-md)', fontSize:'13px', color:'var(--color-info)', marginBottom:'20px' }}>
          You have read-only access to these settings. Contact your Chief or Admin to make changes.
        </div>
      )}

      <div style={{ display:'flex', gap:'2px', marginBottom:'20px', borderBottom:'1px solid var(--border)', paddingBottom:'0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'12px', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:`2px solid ${activeTab===t.id?'var(--accent)':'transparent'}`, color: activeTab===t.id ? 'var(--accent)' : 'var(--text-muted)', transition:'all 150ms ease', fontWeight: activeTab===t.id ? 700 : 400, marginBottom:'-1px' }}>
            <Icon name={t.icon} size={13}/>{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ot' && (
        <div>
          <div style={card}>
            <div style={sectionTitle}>Overtime Threshold</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <Field label="Weekly OT Threshold (hours)" sub="Hours per week before overtime kicks in">
                <input type="number" min="1" max="168" value={settings.ot_weekly_hours}
                  onChange={e => update('ot_weekly_hours', parseInt(e.target.value))}
                  style={inp} disabled={!canEdit}/>
              </Field>
              <Field label="Work Week Start Day" sub="Day your work week begins">
                <select value={settings.ot_week_start} onChange={e => update('ot_week_start', parseInt(e.target.value))} style={inp} disabled={!canEdit}>
                  {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>Pay Period</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <Field label="Pay Period Type">
                <select value={settings.pay_period_type} onChange={e => update('pay_period_type', e.target.value)} style={inp} disabled={!canEdit}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly (every 2 weeks)</option>
                  <option value="semimonthly">Semi-Monthly (1st & 15th)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Pay Period Start Date" sub="First day of your current pay period">
                <input type="date" value={settings.pay_period_start_date || ''} onChange={e => update('pay_period_start_date', e.target.value)} style={inp} disabled={!canEdit}/>
              </Field>
            </div>
            <div style={{ padding:'12px', background:'rgba(91,159,224,0.08)', border:'1px solid rgba(91,159,224,0.2)', borderRadius:'var(--radius-sm)', fontSize:'12px', color:'var(--color-info)' }}>
              OT warnings in the scheduler are based on your weekly threshold. Pay period is used for timesheet summaries and payroll export.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'swaps' && (
        <div>
          <div style={card}>
            <div style={sectionTitle}>Shift Swap Rules</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px' }}>
              <Field label="Minimum Hours Before Shift to Request Swap" sub="Officers cannot post a swap request after this window closes">
                <input type="number" min="1" max="168" value={settings.shift_swap_min_hours_before}
                  onChange={e => update('shift_swap_min_hours_before', parseInt(e.target.value))}
                  style={inp} disabled={!canEdit}/>
              </Field>
              <Field label="Minimum Hours Before Shift to Drop" sub="Officers cannot drop a shift after this window closes">
                <input type="number" min="1" max="168" value={settings.shift_drop_min_hours_before}
                  onChange={e => update('shift_drop_min_hours_before', parseInt(e.target.value))}
                  style={inp} disabled={!canEdit}/>
              </Field>
            </div>
            <Toggle
              label="Require Sergeant Approval for Swaps"
              sub="If enabled, swaps must be approved by a sergeant or above before finalizing. If disabled, swaps are officer-to-officer with management notification only."
              checked={settings.shift_swap_requires_approval}
              onChange={v => update('shift_swap_requires_approval', v)}
              disabled={!canEdit}
            />
          </div>

          <div style={{ padding:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:'var(--text-primary)', marginBottom:'8px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'1px', textTransform:'uppercase' }}>How Shift Swaps Work</div>
            Officer posts a swap or drop request. If posted to the pool, all eligible officers are notified. Sergeants and above are always notified when a swap or drop is posted. If the window closes with no accepted swap, the original officer remains responsible for the shift.
          </div>
        </div>
      )}

      {activeTab === 'clockin' && (
        <div>
          <div style={card}>
            <div style={sectionTitle}>Clock-In Methods</div>
            <Toggle
              label="Allow Desktop Clock-In (Company-Wide)"
              sub="When enabled, officers can clock in from a web browser on desktop. Individual sites can override this setting."
              checked={settings.desktop_clockin_enabled}
              onChange={v => update('desktop_clockin_enabled', v)}
              disabled={!canEdit}
            />
            <Toggle
              label="Require Geofence for Mobile Clock-In"
              sub="When enabled, officers must be within the site geofence to clock in on mobile."
              checked={settings.geofence_clock_in_required}
              onChange={v => update('geofence_clock_in_required', v)}
              disabled={!canEdit}
            />
            <Toggle
              label="Allow Clock-In with Poor GPS Signal"
              sub="When enabled, officers with poor or unavailable GPS signal can still clock in but the attempt is flagged for review."
              checked={settings.geofence_allow_poor_signal}
              onChange={v => update('geofence_allow_poor_signal', v)}
              disabled={!canEdit}
            />
          </div>

          <div style={card}>
            <div style={sectionTitle}>Geofence Monitoring</div>
            <Toggle
              label="Enable Periodic Geofence Checks"
              sub="While an officer is clocked in on mobile, their location is checked periodically. Violations notify the officer and their supervisors."
              checked={settings.mobile_geofence_enabled}
              onChange={v => update('mobile_geofence_enabled', v)}
              disabled={!canEdit}
            />
            {settings.mobile_geofence_enabled && (
              <Field label="Check Interval (minutes)" sub="How often to verify the officer is within the geofence. Recommended: 30-60 minutes.">
                <select value={settings.geofence_check_interval_minutes} onChange={e => update('geofence_check_interval_minutes', parseInt(e.target.value))} style={inp} disabled={!canEdit}>
                  <option value={30}>Every 30 minutes</option>
                  <option value={45}>Every 45 minutes</option>
                  <option value={60}>Every 60 minutes</option>
                  <option value={90}>Every 90 minutes</option>
                  <option value={120}>Every 2 hours</option>
                </select>
              </Field>
            )}
            <div style={{ padding:'12px', background:'rgba(232,148,58,0.08)', border:'1px solid rgba(232,148,58,0.25)', borderRadius:'var(--radius-sm)', fontSize:'12px', color:'var(--color-warning)', marginTop:'8px' }}>
              Geofence monitoring uses background location on mobile devices. Officers are notified when monitoring is active. Violations are logged and supervisors are alerted — officers are never automatically clocked out.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
