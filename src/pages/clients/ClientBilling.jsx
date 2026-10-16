import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'
import { invokeBilling, fmtCents, describeSchedule } from '../../lib/billing'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

// Direct debit (ACH / card) for a client. Card and bank numbers are entered into
// Stripe's Payment Element iframe and never pass through PostCommand.

const s = {
  wrap:    { padding:'16px 20px' },
  section: { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', margin:'4px 0 10px' },
  box:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px', marginBottom:'18px' },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
  danger:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--color-danger)', border:'1px solid rgba(224,85,85,0.3)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' },
  pill:    { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  row:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
}

const PM_STATUS = {
  active:               { label:'Verified',             color:'var(--color-success)', bg:'var(--color-success-bg)' },
  pending_verification: { label:'Awaiting verification', color:'var(--color-warning)', bg:'var(--color-warning-bg)' },
  failed:               { label:'Verification failed',  color:'var(--color-danger)',  bg:'var(--color-danger-bg)' },
}
const PAY_STATUS = {
  processing: { label:'Processing', color:'var(--color-warning)', bg:'var(--color-warning-bg)' },
  succeeded:  { label:'Paid',       color:'var(--color-success)', bg:'var(--color-success-bg)' },
  failed:     { label:'Failed',     color:'var(--color-danger)',  bg:'var(--color-danger-bg)' },
}

// UI presets → stored schedule (frequency + days_of_month).
const PRESETS = [
  { id:'daily',       label:'Daily' },
  { id:'weekly',      label:'Weekly' },
  { id:'biweekly',    label:'Bi-weekly' },
  { id:'monthly',     label:'Monthly' },
  { id:'semimonthly', label:'1st & 15th' },
  { id:'custom',      label:'Custom days of month' },
]

function presetFromBilling(b) {
  if (!b?.frequency) return 'monthly'
  if (b.frequency !== 'days_of_month') return b.frequency
  const d = [...(b.days_of_month || [])].sort((a, c) => a - c)
  if (d.length === 1) return 'monthly'
  if (d.length === 2 && d[0] === 1 && d[1] === 15) return 'semimonthly'
  return 'custom'
}

const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => d ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone: d.length === 10 ? 'UTC' : undefined }) : '—'

export default function ClientBilling({ client }) {
  const toast = useToast()
  const [loading,   setLoading]   = useState(true)
  const [ready,     setReady]     = useState(false)  // company Stripe account can charge
  const [surchargePct, setSurchargePct] = useState(0)
  const [billing,   setBilling]   = useState(null)
  const [payments,  setPayments]  = useState([])
  const [openTotal, setOpenTotal] = useState(0)
  const [adding,    setAdding]    = useState(false)
  const [busy,      setBusy]      = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [{ data:acct }, { data:b }, { data:p }, { data:inv }] = await Promise.all([
        supabase.from('company_payment_account').select('charges_enabled, card_surcharge_pct').eq('company_id', client.company_id).maybeSingle(),
        supabase.from('client_billing').select('*').eq('client_id', client.id).maybeSingle(),
        supabase.from('client_payment').select('*').eq('client_id', client.id).order('created_at', { ascending:false }).limit(10),
        supabase.from('invoice').select('total, autopay_payment_id').eq('client_id', client.id).in('status', ['sent','overdue']),
      ])
      setReady(!!acct?.charges_enabled)
      setSurchargePct(Number(acct?.card_surcharge_pct || 0))
      setBilling(b || null)
      setPayments(p || [])
      setOpenTotal((inv || []).filter(i => !i.autopay_payment_id).reduce((a, i) => a + Number(i.total || 0), 0))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [client.id])

  async function removeMethod() {
    if (!window.confirm('Remove this payment method? Auto-pay will be turned off.')) return
    setBusy(true)
    try {
      await invokeBilling('client-billing', { action:'remove_method', client_id:client.id })
      toast('Payment method removed')
      load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  async function chargeNow() {
    if (!window.confirm(`Charge ${client.name} ${fmtCents(Math.round(openTotal * 100))} now for all open invoices?`)) return
    setBusy(true)
    try {
      const r = await invokeBilling('client-billing', { action:'charge_now', client_id:client.id })
      if (!r.charged) toast('No open invoices to charge')
      else toast(r.status === 'succeeded' ? `Charged ${fmtCents(r.amount_cents)}` : `${fmtCents(r.amount_cents)} submitted. ACH takes about 4 business days`)
      load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  if (loading) return <div style={s.wrap}><div className="skeleton" style={{ height:'120px', borderRadius:'8px' }} /></div>

  if (!ready) {
    return (
      <div style={s.wrap}>
        <div style={{ ...s.box, display:'flex', gap:'10px', alignItems:'flex-start' }}>
          <Icon name="alert-circle" size={16} color="var(--color-warning)" />
          <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>
            Connect your company's Stripe account before setting up direct billing.{' '}
            <Link to="/settings?tab=payments" style={{ color:'var(--accent)' }}>Go to Settings → Client Payments</Link>
          </div>
        </div>
      </div>
    )
  }

  const hasMethod = !!billing?.stripe_payment_method_id
  const pmSt = PM_STATUS[billing?.pm_status]

  return (
    <div style={s.wrap}>
      {/* ── Payment method ── */}
      <div style={s.section}>Payment Method</div>
      <div style={s.box}>
        {adding ? (
          <PaymentMethodForm client={client} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
        ) : hasMethod ? (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <Icon name={billing.pm_type === 'card' ? 'credit-card' : 'briefcase'} size={18} color="var(--accent)" />
                <div>
                  <div style={{ fontSize:'14px', color:'var(--text-primary)', fontWeight:600, textTransform:'capitalize' }}>
                    {billing.pm_brand || (billing.pm_type === 'card' ? 'Card' : 'Bank account')} •••• {billing.pm_last4}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                    {billing.pm_type === 'card' ? `${billing.pm_funding || ''} card` : 'ACH bank debit'}
                    {billing.pm_type === 'card' && billing.pm_funding === 'credit' && surchargePct > 0 && ` · ${surchargePct}% surcharge applies`}
                  </div>
                </div>
              </div>
              {pmSt && <span style={{ ...s.pill, background:pmSt.bg, color:pmSt.color }}>{pmSt.label}</span>}
            </div>
            {billing.pm_status === 'pending_verification' && (
              <div style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.5, marginBottom:'12px' }}>
                Stripe sent two small deposits to this account. They arrive in 1–2 business days. The client verifies them from the email Stripe sends, and auto-pay starts once they do.
              </div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={s.ghost} onClick={() => setAdding(true)} disabled={busy}><Icon name="refresh-cw" size={12}/>REPLACE</button>
              <button style={s.danger} onClick={removeMethod} disabled={busy}><Icon name="trash-2" size={12}/>REMOVE</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'12px' }}>No payment method on file. Add a bank account (ACH) or a card to charge this client automatically.</div>
            <button style={s.btn} onClick={() => setAdding(true)}><Icon name="plus" size={13}/>ADD PAYMENT METHOD</button>
          </>
        )}
      </div>

      {/* ── Schedule ── */}
      {hasMethod && !adding && (
        <>
          <div style={s.section}>Auto-Pay Schedule</div>
          <div style={s.box}>
            <ScheduleForm client={client} billing={billing} onSaved={load} />
          </div>

          <div style={s.section}>Open Balance</div>
          <div style={{ ...s.box, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:'20px', color:'var(--text-primary)', fontWeight:700 }}>{fmtCents(Math.round(openTotal * 100))}</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>Sent + overdue invoices not already being collected</div>
            </div>
            <button style={{ ...s.btn, opacity:(busy || openTotal <= 0 || billing.pm_status !== 'active') ? 0.5 : 1 }} onClick={chargeNow} disabled={busy || openTotal <= 0 || billing.pm_status !== 'active'}>
              <Icon name="dollar-sign" size={13}/>CHARGE NOW
            </button>
          </div>
        </>
      )}

      {/* ── History ── */}
      {payments.length > 0 && (
        <>
          <div style={s.section}>Recent Payments</div>
          {payments.map(p => {
            const st = PAY_STATUS[p.status]
            return (
              <div key={p.id} style={s.row} title={p.failure_message || ''}>
                <div>
                  <div style={{ color:'var(--text-primary)' }}>{fmtCents(p.amount_cents)}{p.surcharge_cents > 0 && <span style={{ color:'var(--text-muted)', fontSize:'11px' }}> (incl. {fmtCents(p.surcharge_cents)} surcharge)</span>}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                    {fmtDate(p.created_at)} · {p.invoice_ids.length} invoice{p.invoice_ids.length !== 1 ? 's' : ''} · {p.trigger === 'manual' ? 'Manual' : 'Auto-pay'}
                    {p.status === 'failed' && p.failure_message && <> · <span style={{ color:'var(--color-danger)' }}>{p.failure_message}</span></>}
                  </div>
                </div>
                <span style={{ ...s.pill, background:st?.bg, color:st?.color }}>{st?.label || p.status}</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Stripe Payment Element (ACH + card) ───────────────────────────────────────

function PaymentMethodForm({ client, onCancel, onSaved }) {
  const toast = useToast()
  const { isDark } = useTheme()
  const mountRef = useRef(null)
  const stripeRef = useRef(null)
  const elementsRef = useRef(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    let cancelled = false
    let element
    ;(async () => {
      try {
        const { client_secret, stripe_account_id, publishable_key } = await invokeBilling('client-billing', { action:'setup_intent', client_id:client.id })
        const stripe = await loadStripe(publishable_key, { stripeAccount: stripe_account_id })
        if (cancelled || !stripe) return
        const css = getComputedStyle(document.documentElement)
        const elements = stripe.elements({
          clientSecret: client_secret,
          appearance: {
            theme: isDark ? 'night' : 'stripe',
            variables: { colorPrimary: css.getPropertyValue('--accent').trim() || undefined, borderRadius: '6px' },
          },
        })
        element = elements.create('payment', { layout:'tabs' })
        element.mount(mountRef.current)
        element.on('ready', () => !cancelled && setLoading(false))
        stripeRef.current = stripe
        elementsRef.current = elements
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    })()
    return () => { cancelled = true; element?.destroy() }
  }, [client.id])

  async function submit() {
    if (!authorized || !stripeRef.current) return
    setSaving(true); setError('')
    try {
      const { error: stripeErr, setupIntent } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      })
      if (stripeErr) throw new Error(stripeErr.message)
      const { pm_status } = await invokeBilling('client-billing', { action:'save_method', client_id:client.id, setup_intent_id:setupIntent.id })
      toast(pm_status === 'active' ? 'Payment method saved' : 'Bank account added. Waiting on micro-deposit verification')
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {loading && <div className="skeleton" style={{ height:'180px', borderRadius:'8px', marginBottom:'12px' }} />}
      <div ref={mountRef} style={{ marginBottom:'14px', display:loading ? 'none' : 'block' }} />
      {error && <div style={{ fontSize:'12px', color:'var(--color-danger)', marginBottom:'12px' }}>{error}</div>}
      <label style={{ display:'flex', gap:'8px', alignItems:'flex-start', fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:'14px', cursor:'pointer' }}>
        <input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} style={{ accentColor:'var(--accent)', marginTop:'2px' }} />
        <span>I have written authorization from <strong>{client.name}</strong> to debit this account or card on a recurring basis for invoiced services, and to keep a copy of that authorization on file.</span>
      </label>
      <div style={{ display:'flex', gap:'8px' }}>
        <button style={{ ...s.btn, opacity:(!authorized || saving || loading) ? 0.5 : 1 }} onClick={submit} disabled={!authorized || saving || loading}>
          <Icon name="lock" size={12}/>{saving ? 'SAVING...' : 'SAVE PAYMENT METHOD'}
        </button>
        <button style={s.ghost} onClick={onCancel} disabled={saving}>CANCEL</button>
      </div>
    </div>
  )
}

// ── Schedule editor ───────────────────────────────────────────────────────────

function ScheduleForm({ client, billing, onSaved }) {
  const toast = useToast()
  const initialDays = billing?.days_of_month?.length ? billing.days_of_month : [1]
  const [enabled,  setEnabled]  = useState(!!billing?.autopay_enabled)
  const [preset,   setPreset]   = useState(presetFromBilling(billing))
  const [start,    setStart]    = useState(billing?.start_date || today())
  const [monthDay, setMonthDay] = useState(initialDays[0])
  const [custom,   setCustom]   = useState(initialDays)
  const [saving,   setSaving]   = useState(false)

  function toggleDay(d) { setCustom(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort((a, b) => a - b)) }

  function toSchedule() {
    switch (preset) {
      case 'daily':       return { frequency:'daily', start_date:start }
      case 'weekly':      return { frequency:'weekly', start_date:start }
      case 'biweekly':    return { frequency:'biweekly', start_date:start }
      case 'monthly':     return { frequency:'days_of_month', start_date:start, days_of_month:[Number(monthDay)] }
      case 'semimonthly': return { frequency:'days_of_month', start_date:start, days_of_month:[1, 15] }
      case 'custom':      return { frequency:'days_of_month', start_date:start, days_of_month:custom }
    }
  }

  async function save() {
    setSaving(true)
    try {
      const sched = toSchedule()
      const { next_charge_date } = await invokeBilling('client-billing', { action:'save_schedule', client_id:client.id, autopay_enabled:enabled, ...sched })
      toast(enabled ? `Auto-pay on. Next charge ${fmtDate(next_charge_date)}` : 'Auto-pay off')
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setSaving(false) }
  }

  const preview = describeSchedule(toSchedule())

  return (
    <div>
      <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', cursor:'pointer' }}>
        <span style={{ fontSize:'14px', color:'var(--text-primary)', fontWeight:500 }}>Automatically charge open invoices</span>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ accentColor:'var(--accent)', width:'18px', height:'18px' }} />
      </label>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px', opacity:enabled ? 1 : 0.5 }}>
        <div>
          <div style={s.lbl}>Frequency</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={preset} onChange={e => setPreset(e.target.value)} disabled={!enabled}>
            {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <div style={s.lbl}>{preset === 'weekly' || preset === 'biweekly' ? 'First charge date' : 'Start on or after'}</div>
          <input type="date" style={s.inp} value={start} min={today()} onChange={e => setStart(e.target.value)} disabled={!enabled} />
        </div>
        {preset === 'monthly' && (
          <div>
            <div style={s.lbl}>Day of month</div>
            <select style={{ ...s.inp, cursor:'pointer' }} value={monthDay} onChange={e => setMonthDay(Number(e.target.value))} disabled={!enabled}>
              {Array.from({ length:31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d === 31 ? '31 (last day)' : d}</option>)}
            </select>
          </div>
        )}
      </div>

      {preset === 'custom' && enabled && (
        <div style={{ marginBottom:'12px' }}>
          <div style={s.lbl}>Charge on these days each month</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'4px' }}>
            {Array.from({ length:31 }, (_, i) => i + 1).map(d => {
              const on = custom.includes(d)
              return (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  style={{ height:'30px', fontSize:'12px', borderRadius:'4px', cursor:'pointer', fontFamily:'var(--font-condensed)',
                    border:`1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background:on ? 'var(--accent-bg)' : 'transparent', color:on ? 'var(--accent)' : 'var(--text-secondary)', fontWeight:on ? 700 : 400 }}>
                  {d}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'6px' }}>Days past the end of a short month (e.g. 30 or 31 in February) charge on the last day.</div>
        </div>
      )}

      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>
        {enabled ? <>Charges all open invoices: <strong style={{ color:'var(--text-secondary)' }}>{preview}</strong>.</> : 'Auto-pay is off. You can still charge manually.'}
        {billing?.autopay_enabled && billing.next_charge_date && <> Next charge: <strong style={{ color:'var(--text-secondary)' }}>{fmtDate(billing.next_charge_date)}</strong>.</>}
      </div>

      <button style={{ ...s.btn, opacity:(saving || (preset === 'custom' && !custom.length)) ? 0.5 : 1 }} onClick={save} disabled={saving || (preset === 'custom' && !custom.length)}>
        <Icon name="save" size={12}/>{saving ? 'SAVING...' : 'SAVE SCHEDULE'}
      </button>
    </div>
  )
}
