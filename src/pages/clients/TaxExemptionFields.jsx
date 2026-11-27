import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'

// Tax-exempt editor for the client form, plus a read-only summary for the
// client panel. Data: client.is_tax_exempt + one client_tax_exemption row per
// jurisdiction (unique on client_id + jurisdiction_code).
// Certificate upload is deferred until a private storage bucket exists.

const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }
const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' }
const pill = { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' }

const todayUTC = () => new Date().toISOString().slice(0, 10)
const addDaysUTC = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const fmtDate = (d) => d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }) : null

export function expiryState(expiresOn) {
  if (!expiresOn) return null
  if (expiresOn < todayUTC()) return { text:'EXPIRED', color:'var(--color-danger)', bg:'var(--color-danger-bg)' }
  if (expiresOn <= addDaysUTC(todayUTC(), 30)) return { text:'EXPIRES SOON', color:'var(--color-warning)', bg:'var(--color-warning-bg)' }
  return null
}

// Jurisdictions the company has contract settings for (no hard-coded list).
export function useCompanyJurisdictions(companyId) {
  const [codes, setCodes] = useState([])
  useEffect(() => {
    if (!companyId) return
    supabase.from('company_contract_setting').select('jurisdiction_code').eq('company_id', companyId).order('jurisdiction_code')
      .then(({ data }) => setCodes((data || []).map(r => r.jurisdiction_code)))
  }, [companyId])
  return codes
}

export async function loadExemptions(clientId) {
  const { data, error } = await supabase.from('client_tax_exemption').select('*').eq('client_id', clientId).order('jurisdiction_code')
  if (error) throw error
  return (data || []).map(r => ({ id:r.id, jurisdiction_code:r.jurisdiction_code, certificate_number:r.certificate_number, expires_on:r.expires_on || '' }))
}

export function validateExemptions(isTaxExempt, rows) {
  if (!isTaxExempt) return
  if (!rows.length) throw new Error('Add at least one exemption certificate, or untick Tax exempt')
  const seen = new Set()
  for (const r of rows) {
    if (!/^[A-Z]{2}$/.test(r.jurisdiction_code)) throw new Error('Each certificate needs a 2-letter jurisdiction')
    if (seen.has(r.jurisdiction_code)) throw new Error(`Only one certificate per jurisdiction (${r.jurisdiction_code})`)
    seen.add(r.jurisdiction_code)
    if (!r.certificate_number.trim()) throw new Error(`Certificate number is required for ${r.jurisdiction_code}`)
  }
}

// Make client_tax_exemption match the form. Unticked → all certificates removed.
export async function saveExemptions({ clientId, companyId, userId, isTaxExempt, rows }) {
  const keep = isTaxExempt ? rows : []
  const keepCodes = keep.map(r => r.jurisdiction_code)
  let del = supabase.from('client_tax_exemption').delete().eq('client_id', clientId)
  if (keepCodes.length) del = del.not('jurisdiction_code', 'in', `(${keepCodes.join(',')})`)
  const { error: delErr } = await del
  if (delErr) throw delErr
  if (!keep.length) return
  const { error } = await supabase.from('client_tax_exemption').upsert(keep.map(r => ({
    company_id: companyId,
    client_id: clientId,
    jurisdiction_code: r.jurisdiction_code,
    certificate_number: r.certificate_number.trim(),
    expires_on: r.expires_on || null,
    ...(r.id ? {} : { created_by: userId }),
  })), { onConflict:'client_id,jurisdiction_code' })
  if (error) throw error
}

// value: { isTaxExempt, rows }
export default function TaxExemptionFields({ value, onChange, jurisdictions }) {
  const { isTaxExempt, rows } = value
  const set = (patch) => onChange({ ...value, ...patch })
  const setRow = (i, k, v) => set({ rows: rows.map((r, j) => j === i ? { ...r, [k]: v } : r) })
  const unused = jurisdictions.filter(j => !rows.some(r => r.jurisdiction_code === j))

  function toggle(checked) {
    if (!checked && rows.some(r => r.id) && !window.confirm('Remove all tax-exemption certificates for this client when you save?')) return
    set({ isTaxExempt: checked, rows: checked && !rows.length ? [{ jurisdiction_code: jurisdictions[0] || '', certificate_number:'', expires_on:'' }] : rows })
  }

  return (
    <div style={{ gridColumn:'1/-1' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'var(--text-primary)', cursor:'pointer' }}>
        <input type="checkbox" checked={isTaxExempt} onChange={e => toggle(e.target.checked)} style={{ accentColor:'var(--accent)', width:'15px', height:'15px' }} />
        Tax exempt
      </label>
      {isTaxExempt && (
        <div style={{ marginTop:'10px', padding:'12px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)' }}>
          {rows.map((r, i) => (
            <div key={r.id || i} style={{ display:'grid', gridTemplateColumns:'90px 1fr 140px 32px', gap:'8px', alignItems:'end', marginBottom:'8px' }}>
              <div>
                <div style={lbl}>Jurisdiction</div>
                {jurisdictions.length ? (
                  <select style={{ ...inp, cursor:'pointer' }} value={r.jurisdiction_code} onChange={e => setRow(i, 'jurisdiction_code', e.target.value)}>
                    {!r.jurisdiction_code && <option value="">—</option>}
                    {[r.jurisdiction_code, ...unused].filter(Boolean).map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                ) : (
                  <input style={{ ...inp, textTransform:'uppercase' }} maxLength={2} value={r.jurisdiction_code} onChange={e => setRow(i, 'jurisdiction_code', e.target.value.toUpperCase())} placeholder="MD" />
                )}
              </div>
              <div><div style={lbl}>Certificate number *</div><input style={inp} value={r.certificate_number} onChange={e => setRow(i, 'certificate_number', e.target.value)} /></div>
              <div><div style={lbl}>Expires</div><input type="date" style={inp} value={r.expires_on} onChange={e => setRow(i, 'expires_on', e.target.value)} /></div>
              <button type="button" title="Remove" onClick={() => set({ rows: rows.filter((_, j) => j !== i) })} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', height:'38px', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="trash-2" size={13}/></button>
            </div>
          ))}
          {(!jurisdictions.length || unused.length > 0) && (
            <button type="button" onClick={() => set({ rows: [...rows, { jurisdiction_code: unused[0] || '', certificate_number:'', expires_on:'' }] })}
              style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', padding:'0 10px', height:'30px', fontSize:'11px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', cursor:'pointer' }}>
              <Icon name="plus" size={11}/>ADD JURISDICTION
            </button>
          )}
          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'8px' }}>Keep the signed exemption certificate on file. Certificate upload is coming later.</div>
        </div>
      )}
    </div>
  )
}

// Read-only display for the client panel's Overview tab.
export function TaxExemptionSummary({ client }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!client.is_tax_exempt) { setRows([]); return }
    loadExemptions(client.id).then(setRows).catch(() => setRows([]))
  }, [client.id, client.is_tax_exempt])

  if (!client.is_tax_exempt || rows == null) return null
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:'12px', padding:'9px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
      <span style={{ color:'var(--text-muted)', fontFamily:'var(--font-condensed)', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Tax Exempt</span>
      <div style={{ textAlign:'right' }}>
        {rows.length === 0 && <span style={{ ...pill, background:'var(--color-warning-bg)', color:'var(--color-warning)' }}>NO CERTIFICATE ON FILE</span>}
        {rows.map(r => {
          const exp = expiryState(r.expires_on)
          return (
            <div key={r.id} style={{ color:'var(--text-primary)', marginBottom:'2px' }}>
              {r.jurisdiction_code} #{r.certificate_number}{r.expires_on ? `, expires ${fmtDate(r.expires_on)}` : ''}
              {exp && <span style={{ ...pill, background:exp.bg, color:exp.color, marginLeft:'6px' }}>{exp.text}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
