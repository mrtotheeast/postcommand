import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { CONTRACT_ROLES } from '../../config/roles'
import { dbErrorMessage } from '../../lib/dbErrors'
import { dollarsToCents, centsToDollars, percentToBps, bpsToPercent, decimalString, wholeNumber } from '../../lib/moneyInput'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

// Per-jurisdiction contract settings (company_contract_setting) and sales tax
// rates (tax_rate). Mounted in Settings → Contracts and /contracts → Rates & Terms.
//
// Tax rates are never edited: a confirmed rate is replaced by adding a new row
// with a new effective date. Confirming only sets confirmed_at; the database
// trigger records who confirmed it.

const s = {
  card:      { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'22px', marginBottom:'14px' },
  cardTitle: { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'16px' },
  grid:      { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px' },
  lbl:       { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' },
  btn:       { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
  danger:    { display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--color-danger)', border:'1px solid rgba(224,85,85,0.3)', borderRadius:'var(--radius-sm)', padding:'0 10px', height:'30px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'0.5px', cursor:'pointer' },
  pill:      { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  jurBtn:    { padding:'8px 16px', fontSize:'13px', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'1px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer' },
  jurAct:    { background:'var(--accent-bg)', borderColor:'var(--accent-border)', color:'var(--accent)' },
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' },
  modal:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', width:'100%', maxWidth:'460px', boxShadow:'var(--shadow-modal)' },
}

// kind: text | bool | cents | bps | int | decimal
const SECTIONS = [
  { title:'Identity', fields:[
    { key:'legal_name', label:'Legal name *', kind:'text', required:true },
    { key:'license_required', label:'License required', kind:'bool' },
    { key:'license_number', label:'License number', kind:'text' },
    { key:'license_authority', label:'License authority', kind:'text' },
    { key:'license_note', label:'License note', kind:'text' },
    { key:'notice_address', label:'Notice address', kind:'text', wide:true },
    { key:'signer_name', label:'Signer name', kind:'text' },
    { key:'signer_title', label:'Signer title', kind:'text' },
  ]},
  { title:'Contacts (Schedule A)', fields:[
    { key:'ops_contact_name', label:'Operations contact', kind:'text' },
    { key:'ops_contact_email', label:'Operations email', kind:'text' },
    { key:'ops_contact_phone', label:'Operations phone', kind:'text' },
    { key:'billing_contact_name', label:'Billing contact', kind:'text' },
    { key:'billing_contact_email', label:'Billing email', kind:'text' },
    { key:'billing_contact_phone', label:'Billing phone', kind:'text' },
  ]},
  { title:'Fees and Terms', fields:[
    { key:'deposit_weeks_standard', label:'Deposit (weeks)', kind:'int', required:true },
    { key:'deposit_weeks_post_suspension', label:'Deposit after suspension (weeks)', kind:'int', required:true },
    { key:'late_fee_min_cents', label:'Late fee minimum ($)', kind:'cents', required:true },
    { key:'late_fee_rate_bps', label:'Late fee rate (%)', kind:'bps', required:true },
    { key:'late_fee_interval_days', label:'Late fee interval (days)', kind:'int', required:true },
    { key:'returned_payment_fee_cents', label:'Returned payment fee ($)', kind:'cents', required:true },
    { key:'reinstatement_fee_cents', label:'Reinstatement fee ($)', kind:'cents' },
    { key:'placement_fee_cents', label:'Placement fee ($)', kind:'cents' },
    { key:'early_termination_pct_bps', label:'Early termination (%)', kind:'bps', required:true },
    { key:'minimum_shift_hours', label:'Minimum shift (hours)', kind:'decimal', required:true },
    { key:'crime_coverage_limit_cents', label:'Crime coverage limit ($)', kind:'cents' },
  ]},
  // Applied to each post's hourly rate (or the contract base rate) to pre-fill a
  // contract's derived rates, which can be overridden per contract.
  { title:'Rate Multipliers', note:'Each contract pre-fills its overtime, holiday, short-notice and emergency rates from the hourly rate × these multipliers. They can be overridden on each contract.', fields:[
    { key:'overtime_multiplier', label:'Overtime (×)', kind:'decimal', required:true, pending:true, suggest:'1.50' },
    { key:'holiday_multiplier', label:'Holiday (×)', kind:'decimal', required:true },
    { key:'short_notice_multiplier', label:'Short-notice (×)', kind:'decimal', required:true, pending:true, suggest:'1.70' },
    { key:'emergency_multiplier', label:'Emergency (×)', kind:'decimal', pending:true, suggest:'2.00' },
  ]},
]
const ALL_FIELDS = SECTIONS.flatMap(sec => sec.fields)
// `pending` fields need the proposed multiplier columns. Until that database
// change is applied the row won't have them, so they're shown but not saved.
const hasColumn = (row, key) => row != null && Object.prototype.hasOwnProperty.call(row, key)
const LABEL = Object.fromEntries(ALL_FIELDS.map(f => [f.key, f.label.replace(/ \*$/, '').replace(/ \(.*\)$/, '')]))

// Blank in the contract text until these are filled.
const NEEDED_FOR_CONTRACTS = ['placement_fee_cents', 'reinstatement_fee_cents', 'crime_coverage_limit_cents',
  'ops_contact_name', 'ops_contact_email', 'ops_contact_phone', 'billing_contact_name', 'billing_contact_email', 'billing_contact_phone']

const todayUTC = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', ...(d.length === 10 ? { timeZone:'UTC' } : {}) }) : '—'

function toForm(row) {
  const f = {}
  for (const fd of ALL_FIELDS) {
    const v = hasColumn(row, fd.key) ? row[fd.key] : null
    f[fd.key] = fd.kind === 'bool' ? !!v
      : fd.kind === 'cents' ? centsToDollars(v)
      : fd.kind === 'bps' ? bpsToPercent(v)
      : v == null ? '' : String(v)
  }
  return f
}

function fromForm(form, row) {
  const out = {}
  for (const fd of ALL_FIELDS) {
    if (fd.pending && !hasColumn(row, fd.key)) continue
    const raw = form[fd.key]
    const label = LABEL[fd.key]
    let v
    if (fd.kind === 'bool') v = !!raw
    else if (fd.kind === 'text') v = String(raw).trim() || null
    else if (fd.kind === 'cents') v = dollarsToCents(raw, label)
    else if (fd.kind === 'bps') v = percentToBps(raw, label)
    else if (fd.kind === 'int') v = wholeNumber(raw, label)
    else if (fd.kind === 'decimal') v = decimalString(raw, 2, label)
    if (fd.kind === 'decimal' && v != null && fd.key.endsWith('_multiplier') && Number(v) < 1) throw new Error(`${label} must be at least 1.00`)
    if (fd.required && (v == null || v === '')) throw new Error(`${label} is required`)
    out[fd.key] = v
  }
  return out
}

// The rate in effect on `date`: latest effective_date on or before it.
export function rateInEffect(rates, jurisdiction, date = todayUTC()) {
  return rates.filter(r => r.jurisdiction_code === jurisdiction && r.effective_date <= date)
    .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0] || null
}

export default function ContractSettingsTab() {
  const { profile, effectiveRole: role } = useAuth()   // View As aware
  const toast = useToast()
  const companyId = profile?.company_id
  const canEdit = CONTRACT_ROLES.includes(role)

  const [loading,  setLoading]  = useState(true)
  const [settings, setSettings] = useState([])
  const [rates,    setRates]    = useState([])
  const [names,    setNames]    = useState({})
  const [jur,      setJur]      = useState(null)
  const [form,     setForm]     = useState(null)
  const [dirty,    setDirty]    = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [adding,   setAdding]   = useState(null)   // { code, legal_name }
  const [newRate,  setNewRate]  = useState({ pct:'', effective_date: todayUTC() })
  const [confirming, setConfirming] = useState(null)

  async function load(keepJur) {
    setLoading(true)
    try {
      const [{ data:st, error:e1 }, { data:tr, error:e2 }] = await Promise.all([
        supabase.from('company_contract_setting').select('*').eq('company_id', companyId).order('jurisdiction_code'),
        supabase.from('tax_rate').select('*').eq('company_id', companyId).order('effective_date', { ascending:false }),
      ])
      if (e1 || e2) throw e1 || e2
      setSettings(st || [])
      setRates(tr || [])
      const ids = [...new Set((tr || []).map(r => r.confirmed_by).filter(Boolean))]
      if (ids.length) {
        const { data:people } = await supabase.from('user_profile').select('id,first_name,last_name').in('id', ids)
        setNames(Object.fromEntries((people || []).map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()])))
      }
      const next = (st || []).find(r => r.jurisdiction_code === (keepJur ?? jur)) || (st || [])[0] || null
      setJur(next?.jurisdiction_code || null)
      setForm(next ? toForm(next) : null)
      setDirty(false)
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { if (companyId) load() }, [companyId])

  const current = settings.find(r => r.jurisdiction_code === jur)

  // Everything still blank, per jurisdiction — drives the banner.
  const missing = useMemo(() => settings.map(row => {
    const items = NEEDED_FOR_CONTRACTS.filter(k => row[k] == null || row[k] === '').map(k => LABEL[k])
    if (row.license_required && !row.license_number) items.push('License number')
    if (!hasColumn(row, 'emergency_multiplier')) items.push('Rate multipliers (database update pending)')
    else if (row.emergency_multiplier == null) items.push('Emergency multiplier not set')
    const eff = rateInEffect(rates, row.jurisdiction_code)
    if (!eff) items.push('Sales tax rate')
    else if (!eff.confirmed_at) items.push('Confirmed sales tax rate')
    return { code: row.jurisdiction_code, items }
  }).filter(m => m.items.length), [settings, rates])

  function pickJur(code) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    const row = settings.find(r => r.jurisdiction_code === code)
    setJur(code); setForm(toForm(row)); setDirty(false)
  }

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })); setDirty(true) }

  async function save() {
    let payload
    try { payload = fromForm(form, current) } catch (e) { toast(e.message, 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('company_contract_setting').update(payload).eq('id', current.id).eq('company_id', companyId)
      if (error) throw error
      toast(`${jur} settings saved`)
      await load(jur)
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function addJurisdiction() {
    const code = (adding?.code || '').trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(code)) { toast('Jurisdiction must be a 2-letter code, e.g. VA', 'error'); return }
    if (!adding.legal_name.trim()) { toast('Legal name is required', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('company_contract_setting').insert({ company_id: companyId, jurisdiction_code: code, legal_name: adding.legal_name.trim() })
      if (error) throw error
      toast(`${code} added`)
      setAdding(null)
      await load(code)
    } catch (e) {
      toast(dbErrorMessage(e, { 23505: `${code} already exists` }), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function addRate() {
    let bps
    try { bps = percentToBps(newRate.pct, 'Rate') } catch (e) { toast(e.message, 'error'); return }
    if (bps == null) { toast('Enter a rate', 'error'); return }
    if (bps > 10000) { toast('Rate cannot exceed 100%', 'error'); return }
    if (!newRate.effective_date) { toast('Enter an effective date', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('tax_rate').insert({ company_id: companyId, jurisdiction_code: jur, rate_bps: bps, effective_date: newRate.effective_date })
      if (error) throw error
      toast(`${jur} rate added. Confirm it before contracts can use it.`)
      setNewRate({ pct:'', effective_date: todayUTC() })
      await load(jur)
    } catch (e) {
      toast(dbErrorMessage(e, { 23505: `${jur} already has a rate effective ${fmtDate(newRate.effective_date)}. Pick a different date.` }), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRate(rate) {
    setSaving(true)
    try {
      const { error } = await supabase.from('tax_rate').update({ confirmed_at: new Date().toISOString() }).eq('id', rate.id).eq('company_id', companyId)
      if (error) throw error
      toast(`${rate.jurisdiction_code} ${bpsToPercent(rate.rate_bps)}% confirmed`)
      setConfirming(null)
      await load(jur)
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRate(rate) {
    if (!window.confirm(`Delete the unconfirmed ${bpsToPercent(rate.rate_bps)}% rate effective ${fmtDate(rate.effective_date)}?`)) return
    const { error } = await supabase.from('tax_rate').delete().eq('id', rate.id).eq('company_id', companyId)
    if (error) toast(dbErrorMessage(error), 'error')
    else { toast('Rate deleted'); load(jur) }
  }

  if (loading) return <div className="skeleton" style={{ height:'200px', borderRadius:'8px' }} />

  const jurRates = rates.filter(r => r.jurisdiction_code === jur)
  const effective = jur ? rateInEffect(rates, jur) : null
  const foc = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const blr = e => { e.target.style.borderColor = 'var(--border)' }

  return (
    <>
      {missing.length > 0 && (
        <div style={{ ...s.card, borderColor:'rgba(230,160,40,0.4)', background:'var(--color-warning-bg)' }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
            <Icon name="alert-triangle" size={16} color="var(--color-warning)" />
            <div style={{ fontSize:'13px', color:'var(--text-primary)', lineHeight:1.6 }}>
              <strong>Contracts can't be generated until these are filled in:</strong>
              {missing.map(m => <div key={m.code}><strong>{m.code}:</strong> {m.items.join(', ')}</div>)}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px', alignItems:'center' }}>
        {settings.map(r => (
          <button key={r.id} style={{ ...s.jurBtn, ...(jur === r.jurisdiction_code ? s.jurAct : {}) }} onClick={() => pickJur(r.jurisdiction_code)}>{r.jurisdiction_code}</button>
        ))}
        {canEdit && !adding && <button style={s.ghost} onClick={() => setAdding({ code:'', legal_name: settings[0]?.legal_name || '' })}><Icon name="plus" size={12}/>ADD JURISDICTION</button>}
      </div>

      {adding && (
        <div style={s.card}>
          <div style={s.cardTitle}>New Jurisdiction</div>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div style={{ width:'110px' }}><div style={s.lbl}>Code</div><input style={{ ...s.inp, textTransform:'uppercase' }} maxLength={2} value={adding.code} onChange={e => setAdding(p => ({ ...p, code:e.target.value.toUpperCase() }))} onFocus={foc} onBlur={blr} placeholder="VA" /></div>
            <div style={{ flex:1, minWidth:'200px' }}><div style={s.lbl}>Legal name</div><input style={s.inp} value={adding.legal_name} onChange={e => setAdding(p => ({ ...p, legal_name:e.target.value }))} onFocus={foc} onBlur={blr} /></div>
            <button style={{ ...s.btn, opacity:saving ? 0.6 : 1 }} onClick={addJurisdiction} disabled={saving}><Icon name="plus" size={13}/>ADD</button>
            <button style={s.ghost} onClick={() => setAdding(null)}>CANCEL</button>
          </div>
        </div>
      )}

      {!current ? (
        <div style={{ ...s.card, color:'var(--text-muted)', fontSize:'13px' }}>No jurisdictions set up yet.{canEdit ? ' Add one to get started.' : ''}</div>
      ) : (
        <>
          {SECTIONS.map(sec => (
            <div key={sec.title} style={s.card}>
              <div style={s.cardTitle}>{jur} · {sec.title}</div>
              {sec.note && <div style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6, marginTop:'-8px', marginBottom:'14px' }}>{sec.note}</div>}
              {sec.fields.some(fd => fd.pending && !hasColumn(current, fd.key)) && (
                <div style={{ fontSize:'12px', color:'var(--color-warning)', marginBottom:'12px' }}>
                  Overtime, short-notice and emergency multipliers can be saved once the database update for rate multipliers is applied.
                </div>
              )}
              <div style={s.grid}>
                {sec.fields.map(fd => (
                  <div key={fd.key} style={fd.wide ? { gridColumn:'1/-1' } : undefined}>
                    <div style={s.lbl}>{fd.label}</div>
                    {fd.kind === 'bool' ? (
                      <label style={{ display:'flex', alignItems:'center', gap:'8px', height:'38px', fontSize:'13px', color:'var(--text-primary)', cursor:canEdit ? 'pointer' : 'default' }}>
                        <input type="checkbox" checked={form[fd.key]} disabled={!canEdit} onChange={e => setF(fd.key, e.target.checked)} style={{ accentColor:'var(--accent)', width:'16px', height:'16px' }} />
                        {form[fd.key] ? 'Yes' : 'No'}
                      </label>
                    ) : (
                      <input style={{ ...s.inp, ...((NEEDED_FOR_CONTRACTS.includes(fd.key) || fd.key === 'emergency_multiplier') && form[fd.key] === '' && hasColumn(current, fd.key) ? { borderColor:'rgba(230,160,40,0.6)' } : {}), ...(fd.pending && !hasColumn(current, fd.key) ? { opacity:0.5 } : {}) }}
                        inputMode={fd.kind === 'text' ? undefined : 'decimal'} value={form[fd.key]} placeholder={fd.suggest ? `e.g. ${fd.suggest}` : undefined}
                        readOnly={!canEdit || (fd.pending && !hasColumn(current, fd.key))}
                        onChange={e => setF(fd.key, e.target.value)} onFocus={foc} onBlur={blr} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {canEdit && (
            <div style={{ display:'flex', gap:'10px', marginBottom:'22px' }}>
              <button style={{ ...s.btn, opacity:(saving || !dirty) ? 0.5 : 1 }} onClick={save} disabled={saving || !dirty}><Icon name="save" size={13}/>{saving ? 'SAVING...' : `SAVE ${jur} SETTINGS`}</button>
              {dirty && <button style={s.ghost} onClick={() => { setForm(toForm(current)); setDirty(false) }}>DISCARD</button>}
            </div>
          )}

          <div style={s.card}>
            <div style={s.cardTitle}>{jur} · Sales Tax Rates</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6, marginBottom:'14px' }}>
              Rates can't be edited. To change a rate, add a new one with a new effective date. A rate must be confirmed by an admin before any contract can use it.
            </div>
            {jurRates.length === 0 && <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'14px' }}>No rates yet.</div>}
            {jurRates.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
                <div style={{ fontSize:'15px', fontWeight:700, color:'var(--text-primary)', minWidth:'70px' }}>{bpsToPercent(r.rate_bps)}%</div>
                <div style={{ flex:1, minWidth:'160px', fontSize:'12px', color:'var(--text-muted)' }}>
                  Effective {fmtDate(r.effective_date)}
                  {r.confirmed_at && <> · Confirmed by {names[r.confirmed_by] || 'an admin'} on {fmtDate(r.confirmed_at)}</>}
                </div>
                {effective?.id === r.id && <span style={{ ...s.pill, background:'var(--accent-bg)', color:'var(--accent)' }}>IN EFFECT</span>}
                {r.effective_date > todayUTC() && <span style={{ ...s.pill, background:'var(--border)', color:'var(--text-muted)' }}>FUTURE</span>}
                {r.confirmed_at
                  ? <span style={{ ...s.pill, background:'var(--color-success-bg)', color:'var(--color-success)' }}><Icon name="lock" size={10}/>&nbsp;CONFIRMED</span>
                  : <span style={{ ...s.pill, background:'var(--color-warning-bg)', color:'var(--color-warning)' }}>UNCONFIRMED</span>}
                {canEdit && !r.confirmed_at && (
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button style={{ ...s.ghost, height:'30px' }} onClick={() => setConfirming(r)}><Icon name="check" size={12}/>CONFIRM</button>
                    <button style={s.danger} onClick={() => deleteRate(r)}><Icon name="trash-2" size={11}/></button>
                  </div>
                )}
              </div>
            ))}
            {canEdit && (
              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end', marginTop:'16px' }}>
                <div style={{ width:'120px' }}><div style={s.lbl}>Rate (%)</div><input style={s.inp} inputMode="decimal" value={newRate.pct} onChange={e => setNewRate(p => ({ ...p, pct:e.target.value }))} onFocus={foc} onBlur={blr} placeholder="6.00" /></div>
                <div style={{ width:'170px' }}><div style={s.lbl}>Effective date</div><input type="date" style={s.inp} value={newRate.effective_date} onChange={e => setNewRate(p => ({ ...p, effective_date:e.target.value }))} onFocus={foc} onBlur={blr} /></div>
                <button style={{ ...s.btn, opacity:saving ? 0.6 : 1 }} onClick={addRate} disabled={saving}><Icon name="plus" size={13}/>ADD RATE</button>
              </div>
            )}
          </div>
        </>
      )}

      {confirming && <ConfirmRateDialog rate={confirming} saving={saving} onCancel={() => setConfirming(null)} onConfirm={() => confirmRate(confirming)} />}
    </>
  )
}

function ConfirmRateDialog({ rate, saving, onCancel, onConfirm }) {
  const [checked, setChecked] = useState(false)
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={s.modal}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'12px' }}>CONFIRM TAX RATE</div>
        <div style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'14px' }}>
          <strong>{rate.jurisdiction_code}: {bpsToPercent(rate.rate_bps)}%</strong>, effective {fmtDate(rate.effective_date)}.
          Once confirmed, this rate is locked and contracts will use it. It can't be edited or un-confirmed.
        </div>
        <label style={{ display:'flex', gap:'8px', alignItems:'flex-start', fontSize:'13px', color:'var(--text-primary)', lineHeight:1.5, marginBottom:'18px', cursor:'pointer' }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ accentColor:'var(--accent)', marginTop:'3px' }} />
          I verified this rate against the official tax authority source.
        </label>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.btn, opacity:(!checked || saving) ? 0.5 : 1 }} disabled={!checked || saving} onClick={onConfirm}><Icon name="lock" size={12}/>{saving ? 'CONFIRMING...' : 'CONFIRM RATE'}</button>
          <button style={s.ghost} onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
