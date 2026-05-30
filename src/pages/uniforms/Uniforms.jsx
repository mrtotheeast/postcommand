import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast, ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const ITEMS = ['Duty Shirt','Polo Shirt','Pants / BDU','Jacket / Windbreaker','Rain Gear','Belt','Hat / Cap','Boots','Gloves','Body Armor Carrier','ID Badge / Holder','Patches','Hi-Vis Vest','Winter Coat','Other']
const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','28','30','32','34','36','38','40','42','N/A']

const STATUS = {
  pending:   { label:'Pending',   bg:'var(--color-warning-bg)', color:'var(--color-warning)' },
  approved:  { label:'Approved',  bg:'var(--color-info-bg)',    color:'var(--color-info)' },
  fulfilled: { label:'Fulfilled', bg:'var(--color-success-bg)', color:'var(--color-success)' },
  denied:    { label:'Denied',    bg:'var(--color-danger-bg)',  color:'var(--color-danger)' },
}

const s = {
  page:     { padding:'24px', maxWidth:'1000px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  stats:    { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'10px', marginBottom:'20px' },
  statCard: { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
  statLbl:  { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
  statVal:  { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  toolbar:  { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  search:   { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'160px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  sel:      { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' },
  addBtn:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 },
  pill:     { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  card:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  row:      { display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom:'1px solid var(--border)', transition:'background 150ms ease' },
  col:      { display:'flex', flexDirection:'column', gap:'2px' },
  name:     { fontSize:'13px', fontWeight:600, color:'var(--text-primary)' },
  meta:     { fontSize:'11px', color:'var(--text-muted)' },
  actionRow:{ display:'flex', gap:'6px', flexShrink:0 },
  btn:      { display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghost:    { display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'1px', cursor:'pointer' },
  deny:     { display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'1px', cursor:'pointer' },
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'460px', boxShadow:'var(--shadow-modal)' },
  mHead:    { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mTitle:   { fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' },
  closeBtn: { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' },
  field:    { marginBottom:'14px' },
  lbl:      { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:      { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  saveBtn:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghostBtn: { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
}

export default function Uniforms() {
  const { profile } = useAuth()
  const isAdmin = atLeast(profile?.role, 'sergeant')
  const [employee, setEmployee]   = useState(null)
  const [requests, setRequests]   = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showNew, setShowNew]     = useState(false)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState(isAdmin ? 'pending' : 'all')
  const [acting, setActing]       = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const [{ data: empData }, { data: allEmp }, { data: reqData }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role').eq('user_id', profile.id).single(),
      supabase.from('employee').select('id,first_name,last_name,role').eq('company_id', profile.company_id).eq('status','active'),
      supabase.from('uniform_request').select('*').eq('company_id', profile.company_id).order('created_at', { ascending:false }),
    ])
    setEmployee(empData)
    setEmployees(allEmp || [])
    setRequests(reqData || [])
    setLoading(false)
  }

  const empMap = Object.fromEntries((employees||[]).map(e => [e.id,e]))

  const filtered = useMemo(() => requests.filter(r => {
    if (!isAdmin && employee && r.employee_id !== employee.id) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const emp = empMap[r.employee_id]
      const q = search.toLowerCase()
      if (!r.item_type?.toLowerCase().includes(q) && !`${emp?.first_name} ${emp?.last_name}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [requests, employee, isAdmin, filterStatus, search])

  async function updateStatus(id, status) {
    setActing(id)
    await supabase.from('uniform_request').update({ status, reviewed_by: employee?.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    setActing(null); load()
  }

  const pending   = requests.filter(r => r.status === 'pending').length
  const approved  = requests.filter(r => r.status === 'approved').length
  const fulfilled = requests.filter(r => r.status === 'fulfilled').length

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:'68px', borderRadius:'8px', marginBottom:'10px' }} />)}</div>

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>UNIFORMS</h2>
      <p style={s.sub}>{isAdmin ? 'Review and fulfill uniform requests.' : 'Request uniform items and track your orders.'}</p>

      <div style={s.stats}>
        {[
          { label:'Pending',   value:pending,   color: pending   > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' },
          { label:'Approved',  value:approved,  color:'var(--color-info)' },
          { label:'Fulfilled', value:fulfilled, color:'var(--color-success)' },
          { label:'Total',     value:requests.length, color:'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search item or name..." value={search} onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
        />
        <select style={s.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button style={s.addBtn} onClick={() => setShowNew(true)}><Icon name="plus" size={15} />NEW REQUEST</button>
      </div>

      <div style={s.card}>
        {filtered.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>No requests found.</div>
        ) : filtered.map((req, i) => {
          const emp = empMap[req.employee_id]
          const st  = STATUS[req.status] || STATUS.pending
          const isActing = acting === req.id
          return (
            <div key={req.id} style={{ ...s.row, borderBottom: i < filtered.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon name="shield" size={18} color="var(--accent)" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={s.name}>{req.item_type} {req.size && req.size !== 'N/A' ? `· ${req.size}` : ''} {req.quantity > 1 ? `× ${req.quantity}` : ''}</div>
                <div style={s.meta}>
                  {emp ? `${emp.first_name} ${emp.last_name}` : '—'} · {ROLE_LABELS[emp?.role] ?? '—'}
                  {req.notes ? ` · "${req.notes}"` : ''}
                </div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>
                  {new Date(req.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                </div>
              </div>
              <span style={{ ...s.pill, background:st.bg, color:st.color }}>{st.label}</span>
              {isAdmin && req.status !== 'denied' && req.status !== 'fulfilled' && (
                <div style={s.actionRow}>
                  {req.status === 'pending'  && <button style={s.btn} onClick={() => updateStatus(req.id,'approved')} disabled={isActing}>{isActing ? '...' : 'APPROVE'}</button>}
                  {req.status === 'approved' && <button style={s.btn} onClick={() => updateStatus(req.id,'fulfilled')} disabled={isActing}><Icon name="check" size={12} />{isActing ? '...' : 'FULFILLED'}</button>}
                  {req.status !== 'denied'   && <button style={s.deny} onClick={() => updateStatus(req.id,'denied')} disabled={isActing}>{isActing ? '...' : 'DENY'}</button>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showNew && <NewRequestModal employee={employee} companyId={profile.company_id} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
    </div>
  )
}

function NewRequestModal({ employee, companyId, onClose, onSaved }) {
  const [form, setForm] = useState({ item_type: ITEMS[0], size: 'M', quantity: 1, notes: '' })
  const [saving, setSaving] = useState(false)
  function setF(k,v) { setForm(prev => ({...prev,[k]:v})) }
  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }

  async function save() {
    if (!employee?.id) return
    setSaving(true)
    await supabase.from('uniform_request').insert({
      company_id: companyId, employee_id: employee.id,
      item_type: form.item_type, size: form.size,
      quantity: parseInt(form.quantity)||1, notes: form.notes.trim()||null,
      status: 'pending',
    })
    setSaving(false); onSaved()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.mHead}>
          <div style={s.mTitle}>UNIFORM REQUEST</div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Item *</div>
          <select style={{ ...s.inp, cursor:'pointer' }} value={form.item_type} onChange={e => setF('item_type',e.target.value)}>
            {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div style={s.field}>
            <div style={s.lbl}>Size</div>
            <select style={{ ...s.inp, cursor:'pointer' }} value={form.size} onChange={e => setF('size',e.target.value)}>
              {SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Quantity</div>
            <input style={s.inp} type="number" min="1" max="10" value={form.quantity} onChange={e => setF('quantity',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
        </div>
        <div style={{ ...s.field, marginTop:'12px' }}>
          <div style={s.lbl}>Notes (optional)</div>
          <input style={s.inp} value={form.notes} onChange={e => setF('notes',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Special requirements, replacement reason..." />
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
          <button style={{ ...s.saveBtn, opacity:saving?0.6:1 }} onClick={save} disabled={saving}>
            <Icon name="send" size={14} />{saving ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
