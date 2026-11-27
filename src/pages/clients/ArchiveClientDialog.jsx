import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { dbErrorMessage } from '../../lib/dbErrors'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { IN_FORCE } from '../contracts/ContractDialogs'

// Archive = status 'inactive' + deletion_date set (client_status_check only
// allows active / inactive / suspended). Used when a client can't be hard-
// deleted: service_contract.client_id is ON DELETE RESTRICT, and contract
// records must be kept for 7 years. deleted_by_client is never touched here.

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' },
  modal:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', width:'100%', maxWidth:'480px', boxShadow:'var(--shadow-modal)' },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
}

// contracts: [{ id, status, jurisdiction_code }]; reason: why delete was refused
export default function ArchiveClientDialog({ client, contracts, reason, onClose, onArchived }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [why,    setWhy]    = useState('')
  const [saving, setSaving] = useState(false)
  const live = contracts.filter(c => IN_FORCE.includes(c.status))

  async function archive() {
    if (!why.trim() || live.length) return
    setSaving(true)
    try {
      const { error } = await supabase.from('client').update({
        status: 'inactive',
        deletion_date: new Date().toISOString(),
        deletion_reason: why.trim(),
        deletion_initiated_by: user?.email || null,
      }).eq('id', client.id).eq('company_id', profile.company_id)
      if (error) throw error
      toast(`${client.name} archived. Restore it any time from Archived → Clients.`)
      onArchived()
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div style={s.modal}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'12px' }}>ARCHIVE CLIENT</div>
        <div style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'14px' }}>
          {contracts.length > 0
            ? <><strong>{client.name}</strong> has {contracts.length} contract{contracts.length !== 1 ? 's' : ''}. Contract records must be kept for 7 years, so this client can't be permanently deleted. You can archive it instead.</>
            : <><strong>{client.name}</strong> can't be permanently deleted: {reason || 'it is linked to other records'}. You can archive it instead.</>}
        </div>

        {live.length > 0 ? (
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', padding:'12px', borderRadius:'var(--radius-sm)', background:'var(--color-warning-bg)', color:'var(--text-primary)', fontSize:'13px', lineHeight:1.5, marginBottom:'16px' }}>
            <Icon name="alert-triangle" size={16} color="var(--color-warning)" />
            <div>
              These contracts are still in force. Void, terminate, or let them expire on the Contracts page before archiving:
              {live.map(c => <div key={c.id}>• {c.jurisdiction_code} contract ({c.status})</div>)}
            </div>
          </div>
        ) : (
          <>
            <div style={s.lbl}>Reason *</div>
            <textarea style={{ ...s.inp, minHeight:'70px', resize:'vertical', marginBottom:'16px' }} value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. Contract ended, client no longer served" />
          </>
        )}

        <div style={{ display:'flex', gap:'10px' }}>
          {!live.length && <button style={{ ...s.btn, opacity:(!why.trim() || saving) ? 0.5 : 1 }} disabled={!why.trim() || saving} onClick={archive}><Icon name="archive" size={13}/>{saving ? 'ARCHIVING...' : 'ARCHIVE CLIENT'}</button>}
          <button style={s.ghost} onClick={onClose} disabled={saving}>{live.length ? 'CLOSE' : 'CANCEL'}</button>
        </div>
      </div>
    </div>
  )
}
