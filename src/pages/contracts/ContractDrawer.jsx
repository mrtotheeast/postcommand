import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CONTRACT_ADMIN_ROLES } from '../../config/roles'
import { dbErrorMessage } from '../../lib/dbErrors'
import { daysBetween, formatCents } from '../../lib/contractMath'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { VoidContractDialog, PurgeContractDialog, VOIDABLE, todayUTC, fmtDate } from './ContractDialogs'

// Contract details drawer, shared by /contracts and the client panel's Contracts tab.

const s = {
  pill:    { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  panel:   { position:'fixed', top:0, right:0, bottom:0, width:'min(560px,100vw)', background:'var(--bg-surface)', borderLeft:'1px solid var(--border)', zIndex:250, display:'flex', flexDirection:'column', overflow:'hidden' },
  section: { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', margin:'18px 0 8px' },
  row:     { display:'flex', justifyContent:'space-between', gap:'12px', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
  danger:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--color-danger)', border:'1px solid rgba(224,85,85,0.3)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
}

export const STATUS = {
  draft:      { label:'Draft',      color:'var(--text-muted)',     bg:'var(--border)' },
  sent:       { label:'Sent',       color:'var(--accent)',         bg:'var(--accent-bg)' },
  signed:     { label:'Signed',     color:'var(--color-success)',  bg:'var(--color-success-bg)' },
  active:     { label:'Active',     color:'var(--color-success)',  bg:'var(--color-success-bg)' },
  suspended:  { label:'Suspended',  color:'var(--color-warning)',  bg:'var(--color-warning-bg)' },
  terminated: { label:'Terminated', color:'var(--color-danger)',   bg:'var(--color-danger-bg)' },
  expired:    { label:'Expired',    color:'var(--text-muted)',     bg:'var(--border)' },
  voided:     { label:'Voided',     color:'var(--color-danger)',   bg:'var(--color-danger-bg)' },
}
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const RENEWAL_STATUSES = ['signed', 'active', 'suspended']
const NOTICE_DAYS = 60     // non-renewal notice deadline (Section 1.2)
const FLAG_DAYS   = 75     // start flagging 15 days before that deadline

// Client name when RLS hides the client row (embed comes back null).
export const clientLabel = (c) => c.client?.legal_name || c.client?.name || 'Client (no access)'

export function renewalFlag(c) {
  if (!RENEWAL_STATUSES.includes(c.status) || !c.term_end_date) return null
  const days = daysBetween(todayUTC(), c.term_end_date)
  if (days < 0 || days > FLAG_DAYS) return null
  return days > NOTICE_DAYS
    ? { text:`Non-renewal notice due in ${days - NOTICE_DAYS}d`, color:'var(--color-warning)', bg:'var(--color-warning-bg)' }
    : { text:`Notice deadline passed · renews in ${days}d`, color:'var(--color-danger)', bg:'var(--color-danger-bg)' }
}

export default function ContractDrawer({ contract: c, role, onClose, onChanged }) {
  const toast = useToast()
  const [posts,   setPosts]   = useState([])
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog,  setDialog]  = useState(null)   // 'void' | 'purge'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data:p, error:e1 }, { data:ev, error:e2 }] = await Promise.all([
        supabase.from('service_contract_post').select('*').eq('contract_id', c.id).order('sort_order'),
        supabase.from('service_contract_event').select('*').eq('contract_id', c.id).order('event_date', { ascending:false }).order('created_at', { ascending:false }),
      ])
      if (cancelled) return
      if (e1 || e2) toast(dbErrorMessage(e1 || e2), 'error')
      setPosts(p || []); setEvents(ev || []); setLoading(false)
    })()
    return () => { cancelled = true }
  }, [c.id])

  const st = STATUS[c.status] || STATUS.draft
  const name = clientLabel(c)
  const snap = c.calculator_snapshot || {}
  const details = [
    ['Template', c.template?.name ? `${c.template.name} (v${c.template_version})` : `v${c.template_version}`],
    ['Effective date', fmtDate(c.effective_date)],
    ['Initial term', c.initial_term_months ? `${c.initial_term_months} months` : '—'],
    ['Term end', fmtDate(c.term_end_date)],
    ['Personal guaranty', c.requires_guaranty ? 'Required' : 'No'],
    ['Tax exempt', c.tax_exempt ? 'Yes' : 'No'],
    ['Sent', fmtDate(c.sent_at)],
    ['Signed', fmtDate(c.signed_at)],
    ...(c.status === 'voided' ? [['Voided', fmtDate(c.voided_at)], ['Void reason', c.void_reason || '—']] : []),
    ...(c.retention_until ? [['Keep records until', fmtDate(c.retention_until)]] : []),
  ]

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:249 }} />
      <div style={s.panel}>
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>{name}</div>
            <div style={{ marginTop:'6px', display:'flex', gap:'6px', alignItems:'center' }}>
              <span style={{ ...s.pill, background:st.bg, color:st.color }}>{st.label}</span>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{c.jurisdiction_code}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', minHeight:'44px', minWidth:'44px', alignItems:'center', justifyContent:'center' }}><Icon name="x" size={18}/></button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 20px 20px' }}>
          <div style={s.section}>Details</div>
          {details.map(([l, v]) => <div key={l} style={s.row}><span style={{ color:'var(--text-muted)' }}>{l}</span><span style={{ color:'var(--text-primary)', textAlign:'right' }}>{v}</span></div>)}

          {Number.isInteger(snap.weeklyTotalCents) && (
            <>
              <div style={s.section}>Charges (frozen at send)</div>
              {[['Weekly subtotal', snap.subtotalCents], ['Sales tax', snap.taxCents], ['Weekly total', snap.weeklyTotalCents], ['Security deposit', snap.depositCents]]
                .filter(([, v]) => Number.isInteger(v))
                .map(([l, v]) => <div key={l} style={s.row}><span style={{ color:'var(--text-muted)' }}>{l}</span><span style={{ color:'var(--text-primary)' }}>{formatCents(v)}</span></div>)}
            </>
          )}

          <div style={s.section}>Posts ({posts.length})</div>
          {loading ? <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Loading…</div> : posts.length === 0 ? (
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No posts.</div>
          ) : posts.map(p => (
            <div key={p.id} style={{ ...s.row, flexDirection:'column', gap:'2px' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{p.post_name}</span>
                <span style={{ color:'var(--text-primary)' }}>{formatCents(p.weekly_charge_cents)}/wk</span>
              </div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                {[p.premises_address, (p.days_of_week || []).map(d => DAY[d]).join(', '), p.start_time && p.end_time ? `${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)}` : null, `${p.hours_per_week} h/wk @ ${formatCents(p.hourly_rate_cents)}`].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}

          <div style={s.section}>History</div>
          {events.length === 0 && !loading && <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No events logged.</div>}
          {events.map(ev => (
            <div key={ev.id} style={s.row}>
              <div>
                <div style={{ color:'var(--text-primary)', textTransform:'capitalize' }}>{ev.event_type.replace(/_/g, ' ')}</div>
                {ev.note && <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{ev.note}</div>}
              </div>
              <div style={{ textAlign:'right', fontSize:'12px', color:'var(--text-muted)' }}>
                {fmtDate(ev.event_date)}
                {Number.isInteger(ev.amount_cents) && <div style={{ color:'var(--text-primary)' }}>{formatCents(ev.amount_cents)}</div>}
              </div>
            </div>
          ))}
        </div>

        {(VOIDABLE.includes(c.status) || CONTRACT_ADMIN_ROLES.includes(role)) && (
          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {VOIDABLE.includes(c.status) && <button style={s.ghost} onClick={() => setDialog('void')}><Icon name="minus-circle" size={13}/>VOID</button>}
            {CONTRACT_ADMIN_ROLES.includes(role) && <button style={s.danger} onClick={() => setDialog('purge')}><Icon name="trash-2" size={13}/>DELETE PERMANENTLY</button>}
          </div>
        )}
      </div>

      {dialog === 'void'  && <VoidContractDialog  contract={c} clientName={name} onClose={() => setDialog(null)} onDone={onChanged} />}
      {dialog === 'purge' && <PurgeContractDialog contract={c} clientName={name} onClose={() => setDialog(null)} onDone={onChanged} />}
    </>
  )
}
