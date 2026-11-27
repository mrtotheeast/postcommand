import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { dbErrorMessage } from '../../lib/dbErrors'
import { addMonths } from '../../lib/contractMath'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' },
  modal:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', width:'100%', maxWidth:'480px', boxShadow:'var(--shadow-modal)' },
  title:   { fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'12px' },
  body:    { fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'14px' },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' },
  danger:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
  warn:    { display:'flex', gap:'10px', alignItems:'flex-start', padding:'12px', borderRadius:'var(--radius-sm)', fontSize:'13px', lineHeight:1.5, marginBottom:'14px' },
}

export const todayUTC = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (d) => d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', ...(d.length === 10 ? { timeZone:'UTC' } : {}) }) : '—'
// Same rule as the service_contract_guard trigger: 7 years after the contract ends.
const retentionFromToday = () => addMonths(todayUTC(), 84)

export const VOIDABLE = ['sent', 'signed']
export const IN_FORCE = ['sent', 'signed', 'active', 'suspended']

// ── Void ──────────────────────────────────────────────────────────────────────

export function VoidContractDialog({ contract, clientName, onClose, onDone }) {
  const { user } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('service_contract')
        .update({ status:'voided', void_reason: reason.trim() })
        .eq('id', contract.id).eq('company_id', contract.company_id)
        .select('retention_until').single()
      if (error) throw error
      // Status change and audit entry are separate writes; report if the log fails.
      const { error: evErr } = await supabase.from('service_contract_event').insert({
        company_id: contract.company_id, contract_id: contract.id, event_type:'voided', note: reason.trim(), actor_user_id: user?.id,
      })
      if (evErr) toast(`Contract voided, but the audit log entry failed: ${dbErrorMessage(evErr)}`, 'error')
      else toast(`Contract voided. Records kept until ${fmtDate(data?.retention_until)}.`)
      onDone()
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div style={s.modal}>
        <div style={s.title}>VOID CONTRACT</div>
        <div style={s.body}>
          Void the <strong>{contract.jurisdiction_code}</strong> contract for <strong>{clientName}</strong>? It stays on file as voided and can't be reopened.
          The record must be kept until <strong>{fmtDate(retentionFromToday())}</strong> (7 years).
        </div>
        <div style={s.lbl}>Reason *</div>
        <textarea style={{ ...s.inp, minHeight:'80px', resize:'vertical', marginBottom:'16px' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Client chose not to sign; terms renegotiated" />
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.danger, opacity:(!reason.trim() || saving) ? 0.5 : 1 }} disabled={!reason.trim() || saving} onClick={submit}><Icon name="minus-circle" size={13}/>{saving ? 'VOIDING...' : 'VOID CONTRACT'}</button>
          <button style={s.ghost} onClick={onClose} disabled={saving}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Permanent delete ──────────────────────────────────────────────────────────

export function PurgeContractDialog({ contract, clientName, onClose, onDone }) {
  const toast = useToast()
  const [typed,  setTyped]  = useState('')
  const [saving, setSaving] = useState(false)

  const isDraft = contract.status === 'draft'
  const inForce = IN_FORCE.includes(contract.status)
  const withinRetention = !isDraft && (contract.retention_until == null || contract.retention_until > todayUTC())

  async function submit() {
    if (typed !== 'DELETE') return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('purge_service_contract', { p_contract: contract.id, p_confirm: typed })
      if (error) throw error
      toast('Contract permanently deleted. The deletion was logged.')
      onDone()
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div style={s.modal}>
        <div style={s.title}>PERMANENTLY DELETE CONTRACT</div>
        <div style={s.body}>
          This permanently deletes the <strong>{contract.jurisdiction_code}</strong> contract for <strong>{clientName}</strong> (status: {contract.status}), its posts, and its event history. This cannot be undone.
        </div>

        {isDraft && (
          <div style={{ ...s.warn, background:'var(--bg-surface)', color:'var(--text-secondary)' }}>
            <Icon name="check-circle" size={15} color="var(--color-success)" />Draft contract. No retention requirement applies.
          </div>
        )}
        {withinRetention && (
          <div style={{ ...s.warn, background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)' }}>
            <Icon name="alert-triangle" size={16} />
            <div>
              {inForce
                ? <><strong>This contract is still in force.</strong> Its records must be kept until 7 years after it ends.</>
                : <><strong>This contract must be kept until {fmtDate(contract.retention_until)}.</strong></>}
              {' '}Deleting it now is inside the retention period. The deletion will be logged with your name and the date.
            </div>
          </div>
        )}
        {!isDraft && !withinRetention && (
          <div style={{ ...s.warn, background:'var(--bg-surface)', color:'var(--text-secondary)' }}>
            <Icon name="check-circle" size={15} color="var(--color-success)" />Retention period ended {fmtDate(contract.retention_until)}. The deletion will be logged.
          </div>
        )}

        <div style={s.lbl}>Type DELETE to confirm</div>
        <input style={{ ...s.inp, marginBottom:'16px', fontFamily:'var(--font-condensed)', letterSpacing:'2px' }} value={typed} onChange={e => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" />
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.danger, opacity:(typed !== 'DELETE' || saving) ? 0.5 : 1 }} disabled={typed !== 'DELETE' || saving} onClick={submit}><Icon name="trash-2" size={13}/>{saving ? 'DELETING...' : 'DELETE PERMANENTLY'}</button>
          <button style={s.ghost} onClick={onClose} disabled={saving}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
