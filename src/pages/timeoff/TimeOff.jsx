import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const PTO_STATUSES = {
  pending:  { bg:'var(--color-warning-bg)',  color:'var(--color-warning)',  label:'Pending' },
  approved: { bg:'var(--color-success-bg)',  color:'var(--color-success)',  label:'Approved' },
  denied:   { bg:'var(--color-danger-bg)',   color:'var(--color-danger)',   label:'Denied' },
}

const BANK_LABELS = { paid:'PTO / Vacation', sick:'Sick Leave', personal:'Personal Days', unpaid:'Unpaid Leave' }

function calcDays(start, end) {
  if (!start || !end) return 0
  return Math.round((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000) + 1
}

export default function TimeOff() {
  const { profile } = useAuth()
  const toast = useToast()
  const canReview = atLeast(profile?.role, 'sergeant')

  const [myEmpId, setMyEmpId]         = useState(null)
  const [banks, setBanks]             = useState([])
  const [balances, setBalances]       = useState([])
  const [requests, setRequests]       = useState([])
  const [employees, setEmployees]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showNew, setShowNew]         = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmp, setFilterEmp]     = useState('all')
  const [denying, setDenying]         = useState(null) // request id
  const [denialReason, setDenialReason] = useState('')
  const [actioning, setActioning]     = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    try {
      const [{ data: empMe }, { data: bankData }, { data: balData }, { data: reqData }, { data: empAll }] = await Promise.all([
        supabase.from('employee').select('id').eq('user_id', profile.id).eq('company_id', profile.company_id).maybeSingle(),
        supabase.from('pto_bank_config').select('*').eq('company_id', profile.company_id),
        supabase.from('pto_balance').select('*').eq('company_id', profile.company_id),
        supabase.from('time_off_request').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('employee').select('id,first_name,last_name').eq('company_id', profile.company_id).order('last_name'),
      ])
      setMyEmpId(empMe?.id || null)
      setBanks(bankData || [])
      setBalances(balData || [])
      setRequests(reqData || [])
      setEmployees(empAll || [])
    } catch(e) {
    } finally {
      setLoading(false)
    }
  }

  function myBalance(bankType) {
    if (!myEmpId) return { balance_hours: 0, used_hours: 0, pending_hours: 0 }
    return balances.find(b => b.employee_id === myEmpId && b.bank_type === bankType) || { balance_hours: 0, used_hours: 0, pending_hours: 0 }
  }

  function empName(id) { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : '—' }

  const isOfficer = !canReview
  const visibleRequests = useMemo(() => requests.filter(r => {
    if (isOfficer && myEmpId && r.employee_id !== myEmpId) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterEmp !== 'all' && r.employee_id !== filterEmp) return false
    return true
  }), [requests, isOfficer, myEmpId, filterStatus, filterEmp])

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending' && !(isOfficer && myEmpId && r.employee_id !== myEmpId)), [requests, isOfficer, myEmpId])

  async function approve(req) {
    setActioning(req.id)
    try {
      const { error: reqErr } = await supabase.from('time_off_request').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id).eq('company_id', profile.company_id)
      if (reqErr) throw reqErr
      const bal = balances.find(b => b.employee_id === req.employee_id && b.bank_type === req.bank_type)
      if (bal) {
        const { error: balErr } = await supabase.from('pto_balance').update({
          balance_hours: Math.max(0, (bal.balance_hours || 0) - (req.hours_requested || 0)),
          pending_hours: Math.max(0, (bal.pending_hours || 0) - (req.hours_requested || 0)),
          used_hours:    (bal.used_hours || 0) + (req.hours_requested || 0),
        }).eq('company_id', profile.company_id).eq('employee_id', req.employee_id).eq('bank_type', req.bank_type)
        if (balErr) throw balErr
      }
      toast('Request approved')
      load()
    } catch(e) {
      toast(e?.message || 'Failed to approve request', 'error')
    } finally {
      setActioning(null)
    }
  }

  async function deny(req) {
    if (!denialReason.trim()) return
    setActioning(req.id)
    try {
      const { error: reqErr } = await supabase.from('time_off_request').update({ status: 'denied', denial_reason: denialReason.trim(), reviewed_at: new Date().toISOString() }).eq('id', req.id).eq('company_id', profile.company_id)
      if (reqErr) throw reqErr
      const bal = balances.find(b => b.employee_id === req.employee_id && b.bank_type === req.bank_type)
      if (bal) {
        const { error: balErr } = await supabase.from('pto_balance').update({
          pending_hours: Math.max(0, (bal.pending_hours || 0) - (req.hours_requested || 0)),
        }).eq('company_id', profile.company_id).eq('employee_id', req.employee_id).eq('bank_type', req.bank_type)
        if (balErr) throw balErr
      }
      toast('Request denied', 'info')
      setDenying(null)
      setDenialReason('')
      load()
    } catch(e) {
      toast(e?.message || 'Failed to deny request', 'error')
    } finally {
      setActioning(null)
    }
  }

  if (loading) return (
    <div style={{ padding: '24px' }}>
      {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '8px', marginBottom: '10px' }} />)}
    </div>
  )

  const selStyle = { padding:'0 10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'12px', height:'38px', cursor:'pointer', fontFamily:'var(--font-body)' }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', animation: 'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>TIME OFF</h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>Request and manage time off.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
        >
          <Icon name="plus" size={14} />REQUEST TIME OFF
        </button>
      </div>

      {/* Balance cards — only enabled banks */}
      {banks.filter(b => b.enabled).length > 0 && myEmpId && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'24px' }}>
          {banks.filter(b => b.enabled).map(bank => {
            const bal = myBalance(bank.bank_type)
            const available = Math.max(0, (bal.balance_hours || 0) - (bal.pending_hours || 0))
            return (
              <div key={bank.bank_type} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'16px' }}>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'8px' }}>{BANK_LABELS[bank.bank_type] || bank.bank_type}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'26px', color:'var(--accent)', letterSpacing:'1px', lineHeight:1, marginBottom:'6px' }}>{available.toFixed(1)}<span style={{ fontSize:'13px', color:'var(--text-muted)', fontFamily:'var(--font-body)', marginLeft:'4px' }}>hrs available</span></div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  <span>Used: {(bal.used_hours || 0).toFixed(1)}h</span>
                  <span>Pending: {(bal.pending_hours || 0).toFixed(1)}h</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {banks.length === 0 && !atLeast(profile?.role, 'lieutenant') && (
        <div style={{ background:'var(--color-warning-bg)', border:'1px solid rgba(232,148,58,0.3)', borderRadius:'var(--radius-md)', padding:'14px 18px', marginBottom:'20px', fontSize:'13px', color:'var(--color-warning)' }}>
          No PTO banks are configured for your company. A lieutenant or above can set them up in HR → PTO Settings.
        </div>
      )}

      {/* Pending requests queue — sergeant+ only */}
      {canReview && pendingRequests.length > 0 && (
        <div style={{ marginBottom:'24px' }}>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>Pending Approval ({pendingRequests.length})</div>
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            {pendingRequests.map((req, i) => {
              const days = calcDays(req.start_date, req.end_date)
              return (
                <div key={req.id} style={{ padding:'14px 18px', borderBottom: i < pendingRequests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'14px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'3px' }}>{empName(req.employee_id)}</div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                        {BANK_LABELS[req.bank_type] || req.bank_type} · {req.start_date} → {req.end_date} · {days} day{days !== 1 ? 's' : ''} ({req.hours_requested}h)
                        {req.notes ? ` · "${req.notes}"` : ''}
                      </div>
                    </div>
                    {denying === req.id ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:'8px', minWidth:'260px' }}>
                        <textarea
                          value={denialReason}
                          onChange={e => setDenialReason(e.target.value)}
                          placeholder="Reason for denial..."
                          rows={2}
                          style={{ width:'100%', padding:'8px 10px', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-primary)', fontSize:'12px', resize:'none', outline:'none', boxSizing:'border-box', fontFamily:'var(--font-body)' }}
                        />
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={() => { setDenying(null); setDenialReason('') }} style={{ flex:1, height:'34px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'11px', cursor:'pointer' }}>CANCEL</button>
                          <button onClick={() => deny(req)} disabled={!denialReason.trim() || actioning === req.id} style={{ flex:2, height:'34px', background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', color:'var(--color-danger)', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, cursor:'pointer', opacity:(!denialReason.trim()||actioning===req.id)?0.6:1 }}>
                            {actioning === req.id ? 'DENYING...' : 'CONFIRM DENY'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                        <button onClick={() => { setDenying(req.id); setDenialReason('') }} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', color:'var(--color-danger)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                          <Icon name="x" size={11} />DENY
                        </button>
                        <button onClick={() => approve(req)} disabled={actioning === req.id} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'var(--color-success-bg)', border:'1px solid rgba(58,170,106,0.3)', borderRadius:'var(--radius-sm)', color:'var(--color-success)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, cursor:'pointer', opacity:actioning===req.id?0.6:1 }}>
                          <Icon name="check" size={11} />{actioning === req.id ? '...' : 'APPROVE'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', flex:1 }}>
            {canReview ? 'All Requests' : 'My Requests'}
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
            <option value="all">All Status</option>
            {Object.entries(PTO_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {canReview && (
            <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={selStyle}>
              <option value="all">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          )}
        </div>

        {visibleRequests.length === 0 ? (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'40px', textAlign:'center', color:'var(--text-muted)', fontSize:'13px' }}>No requests found.</div>
        ) : (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            {visibleRequests.map((req, i) => {
              const st = PTO_STATUSES[req.status] || PTO_STATUSES.pending
              const days = calcDays(req.start_date, req.end_date)
              return (
                <div key={req.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom: i < visibleRequests.length - 1 ? '1px solid var(--border)' : 'none', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {canReview && <div style={{ fontSize:'12px', fontWeight:600, color:'var(--text-primary)', marginBottom:'2px' }}>{empName(req.employee_id)}</div>}
                    <div style={{ fontSize:'13px', color: canReview ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: canReview ? 400 : 600 }}>
                      {BANK_LABELS[req.bank_type] || req.bank_type}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>
                      {req.start_date} → {req.end_date} · {days} day{days !== 1 ? 's' : ''} ({req.hours_requested}h)
                      {req.notes ? ` · "${req.notes}"` : ''}
                    </div>
                    {req.denial_reason && <div style={{ fontSize:'11px', color:'var(--color-danger)', marginTop:'3px' }}>Reason: {req.denial_reason}</div>}
                  </div>
                  <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', background: st.bg, color: st.color }}>
                    {st.label.toUpperCase()}
                  </span>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', flexShrink:0 }}>
                    {new Date(req.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNew && (
        <TimeOffRequestModal
          banks={banks.filter(b => b.enabled)}
          balances={balances}
          myEmpId={myEmpId}
          companyId={profile.company_id}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}

function TimeOffRequestModal({ banks, balances, myEmpId, companyId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ bank_type: banks[0]?.bank_type || 'paid', start_date: '', end_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const selectedBank = banks.find(b => b.bank_type === form.bank_type)
  const bal = balances.find(b => b.employee_id === myEmpId && b.bank_type === form.bank_type) || { balance_hours: 0, pending_hours: 0 }
  const available = Math.max(0, (bal.balance_hours || 0) - (bal.pending_hours || 0))
  const days = calcDays(form.start_date, form.end_date)
  const hoursRequested = days * 8
  const overBalance = hoursRequested > available

  const inpStyle = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' }
  const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }

  async function submit() {
    if (!form.start_date || !form.end_date || !myEmpId) return
    if (!selectedBank) { setError('No PTO bank selected.'); return }
    if (overBalance) { setError(`Insufficient balance. You have ${available.toFixed(1)}h available but this request needs ${hoursRequested}h.`); return }
    setSaving(true); setError(null)
    try {
      const { error: insErr } = await supabase.from('time_off_request').insert({
        company_id: companyId,
        employee_id: myEmpId,
        bank_type: form.bank_type,
        start_date: form.start_date,
        end_date: form.end_date,
        hours_requested: hoursRequested,
        notes: form.notes || null,
        status: 'pending',
      })
      if (insErr) throw insErr
      if (bal.employee_id) {
        await supabase.from('pto_balance').update({ pending_hours: (bal.pending_hours || 0) + hoursRequested }).eq('company_id', companyId).eq('employee_id', myEmpId).eq('bank_type', form.bank_type)
      } else {
        await supabase.from('pto_balance').insert({ company_id: companyId, employee_id: myEmpId, bank_type: form.bank_type, balance_hours: 0, used_hours: 0, pending_hours: hoursRequested })
      }
      toast('Request submitted')
      onSaved()
    } catch(e) {
      setError(e.message || 'Failed to submit request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'var(--shadow-modal)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' }}>REQUEST TIME OFF</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }}><Icon name="x" size={18} /></button>
        </div>

        {error && <div style={{ background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--color-danger)', marginBottom:'14px' }}>{error}</div>}

        <div style={{ marginBottom:'14px' }}>
          <div style={lbl}>Leave Type</div>
          <select style={{ ...inpStyle, cursor:'pointer' }} value={form.bank_type} onChange={e => setForm(p => ({ ...p, bank_type: e.target.value }))}>
            {banks.map(b => <option key={b.bank_type} value={b.bank_type}>{BANK_LABELS[b.bank_type] || b.bank_type}</option>)}
          </select>
          {selectedBank && (
            <div style={{ marginTop:'6px', fontSize:'12px', color: overBalance ? 'var(--color-danger)' : 'var(--color-success)' }}>
              Available: {available.toFixed(1)}h {form.start_date && form.end_date ? `· This request: ${hoursRequested}h (${days} day${days !== 1 ? 's' : ''} × 8h)` : ''}
            </div>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
          <div>
            <div style={lbl}>Start Date *</div>
            <input style={inpStyle} type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <div style={lbl}>End Date *</div>
            <input style={inpStyle} type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} min={form.start_date} />
          </div>
        </div>

        <div style={{ marginBottom:'20px' }}>
          <div style={lbl}>Notes (optional)</div>
          <input style={inpStyle} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional details..." />
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, height:'44px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'13px', cursor:'pointer' }}>CANCEL</button>
          <button onClick={submit} disabled={!form.start_date || !form.end_date || saving || overBalance} style={{ flex:2, height:'44px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:(!form.start_date||!form.end_date||saving||overBalance)?0.6:1 }}>
            {saving ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
          </button>
        </div>
      </div>
    </div>
  )
}
