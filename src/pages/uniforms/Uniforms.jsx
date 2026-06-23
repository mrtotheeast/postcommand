import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { atLeast, ROLE_LABELS } from '../../config/roles'
import { scopeToOwnEmployee } from '../../lib/scoping'
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
  const [mainTab, setMainTab]     = useState('requests')
  const [employee, setEmployee]   = useState(null)
  const [requests, setRequests]   = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showNew, setShowNew]     = useState(false)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState(isAdmin ? 'pending' : 'all')
  const [acting, setActing]       = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const [{ data: empData }, { data: allEmp }, { data: reqData }] = await Promise.all([
        supabase.from('employee').select('id,first_name,last_name,role').eq('user_id', profile.id).single(),
        supabase.from('employee').select('id,first_name,last_name,role').eq('company_id', profile.company_id).eq('status','active'),
        scopeToOwnEmployee(supabase.from('uniform_request').select('*').eq('company_id', profile.company_id).order('created_at', { ascending:false }), profile),
      ])
      setEmployee(empData)
      setEmployees(allEmp || [])
      setRequests(reqData || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  const empMap = Object.fromEntries((employees||[]).map(e => [e.id,e]))

  const filtered = useMemo(() => requests.filter(r => {
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
      <h2 style={s.heading}>EQUIPMENT & UNIFORMS</h2>
      <p style={s.sub}>{isAdmin ? 'Manage inventory, requests, and equipment tracking.' : 'Request uniform items and track your orders.'}</p>

      <div style={{display:'flex',gap:'2px',marginBottom:'20px',borderBottom:'1px solid var(--border)',paddingBottom:0}}>
        {[['requests','Uniform Requests'],...(isAdmin?[['inventory','Inventory'],['scan','QR Scanner']]:[])]
          .map(([v,l])=>(<button key={v} onClick={()=>setMainTab(v)} style={{padding:'10px 18px',fontSize:'13px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',borderBottom:`2px solid ${mainTab===v?'var(--accent)':'transparent'}`,color:mainTab===v?'var(--accent)':'var(--text-muted)',transition:'all 150ms ease',fontWeight:mainTab===v?700:400,marginBottom:'-1px'}}>{l}</button>))}
      </div>

      {mainTab==='inventory' && <InventoryTab companyId={profile.company_id} />}
      {mainTab==='scan'      && <ScanTab companyId={profile.company_id} employee={employee} />}
      {mainTab==='requests' && <>

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
      </>}
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

// ── Equipment Inventory Tab ───────────────────────────────────────────────────

const EQUIP_CATEGORIES = ['Uniform','Equipment','Firearm Accessory','Safety Gear','Electronics','Other']
const EQUIP_CONDITIONS = ['New','Good','Fair','Poor']

function generateQRSVG(text, size=200) {
  // Simple visual QR placeholder using item ID — real QR encoding requires a library
  // This generates a styled card with the ID for printing
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white"/>
    <rect x="10" y="10" width="60" height="60" fill="none" stroke="black" stroke-width="3"/>
    <rect x="20" y="20" width="40" height="40" fill="black"/>
    <rect x="30" y="30" width="20" height="20" fill="white"/>
    <rect x="${size-70}" y="10" width="60" height="60" fill="none" stroke="black" stroke-width="3"/>
    <rect x="${size-60}" y="20" width="40" height="40" fill="black"/>
    <rect x="${size-50}" y="30" width="20" height="20" fill="white"/>
    <rect x="10" y="${size-70}" width="60" height="60" fill="none" stroke="black" stroke-width="3"/>
    <rect x="20" y="${size-60}" width="40" height="40" fill="black"/>
    <rect x="30" y="${size-50}" width="20" height="20" fill="white"/>
    <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" font-family="monospace" font-size="9" fill="black">${text.slice(0,8)}</text>
    <text x="${size/2}" y="${size/2+14}" text-anchor="middle" font-family="monospace" font-size="8" fill="#666">${text.slice(8,16)}</text>
  </svg>`
}

function InventoryTab({ companyId }) {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)
  const [qrItem, setQrItem]   = useState(null)
  const [form, setForm] = useState({ name:'', category:'Equipment', quantity:1, issued_quantity:0, condition:'New', serial_number:'', notes:'' })
  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  useEffect(() => { if (companyId) load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('equipment_item').select('*').eq('company_id', companyId).order('category').order('name')
      setItems(data||[])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const { error: err } = await supabase.from('equipment_item').insert({ company_id:companyId, ...form, quantity:Number(form.quantity), issued_quantity:Number(form.issued_quantity)||0 })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAdd(false); setForm({ name:'', category:'Equipment', quantity:1, issued_quantity:0, condition:'New', serial_number:'', notes:'' }); load()
  }

  async function del(id) {
    if (!window.confirm('Delete this item?')) return
    await supabase.from('equipment_item').delete().eq('id', id); load()
  }

  function printQR(item) {
    const w = window.open('', '_blank', 'width=400,height=400')
    const svg = generateQRSVG(item.id)
    w.document.write(`<!DOCTYPE html><html><head><title>QR — ${item.name}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:monospace}h2{font-size:14px;margin:10px 0}</style></head><body>${svg}<h2>${item.name}</h2><p style="font-size:11px;color:#666">${item.id.slice(0,16)}...</p></body></html>`)
    w.document.close(); setTimeout(()=>w.print(), 300)
  }

  if (loading) return <div style={{color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  const inpS = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 10px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' }
  const lblS = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }

  const grouped = EQUIP_CATEGORIES.map(cat => ({ cat, items: items.filter(i=>i.category===cat) })).filter(g=>g.items.length>0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{items.length} item{items.length!==1?'s':''} in inventory</div>
        <button onClick={()=>setShowAdd(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}>
          <Icon name="plus" size={13}/>ADD ITEM
        </button>
      </div>

      {error && <div style={{ padding:'8px 12px', borderRadius:'var(--radius-sm)', marginBottom:'12px', fontSize:'12px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)' }}>{error}</div>}

      {showAdd && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'16px', marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><div style={lblS}>Item Name *</div><input style={inpS} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="Taser X26P"/></div>
            <div><div style={lblS}>Category</div><select style={{...inpS,cursor:'pointer'}} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{EQUIP_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><div style={lblS}>Qty on Hand</div><input type="number" min="0" style={inpS} value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
            <div><div style={lblS}>Condition</div><select style={{...inpS,cursor:'pointer'}} value={form.condition} onChange={e=>setForm(p=>({...p,condition:e.target.value}))}>{EQUIP_CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><div style={lblS}>Serial # (optional)</div><input style={inpS} value={form.serial_number} onChange={e=>setForm(p=>({...p,serial_number:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
            <div><div style={lblS}>Notes</div><input style={inpS} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={save} disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:saving?0.6:1 }}><Icon name="save" size={13}/>{saving?'SAVING...':'SAVE'}</button>
            <button onClick={()=>setShowAdd(false)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', cursor:'pointer' }}>CANCEL</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-muted)', fontSize:'13px' }}>No inventory items yet. Add your first item above.</div>
      ) : (
        grouped.map(({ cat, items: catItems }) => (
          <div key={cat} style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'8px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>{cat} ({catItems.length})</div>
            {catItems.map(item => (
              <div key={item.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'2px' }}>{item.name}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    <span>Qty: <strong style={{color:'var(--text-primary)'}}>{item.quantity}</strong></span>
                    <span>Issued: {item.issued_quantity||0}</span>
                    <span>Condition: {item.condition}</span>
                    {item.serial_number && <span>S/N: {item.serial_number}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={()=>printQR(item)} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-sm)', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, cursor:'pointer', padding:'0 10px', height:'30px' }}>
                    <Icon name="printer" size={11}/>QR CODE
                  </button>
                  <button onClick={()=>del(item.id)} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }}><Icon name="trash-2" size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ── QR Scanner Tab ────────────────────────────────────────────────────────────

function ScanTab({ companyId, employee }) {
  const [scannedItem, setScannedItem] = useState(null)
  const [scanning, setScanning]       = useState(false)
  const [manualId, setManualId]       = useState('')
  const [log, setLog]                 = useState([])
  const [acting, setActing]           = useState(false)

  useEffect(() => { if (companyId) loadLog() }, [companyId])

  async function loadLog() {
    const { data } = await supabase.from('equipment_log').select('*,equipment_item(name,category)').eq('company_id', companyId).order('scanned_at', {ascending:false}).limit(20)
    setLog(data||[])
  }

  async function lookupItem(id) {
    const { data } = await supabase.from('equipment_item').select('*').eq('id', id).eq('company_id', companyId).single()
    setScannedItem(data||null)
    if (!data) alert('Item not found in inventory.')
  }

  async function logAction(action) {
    if (!scannedItem || !employee) return
    setActing(true)
    await supabase.from('equipment_log').insert({ company_id:companyId, item_id:scannedItem.id, employee_id:employee.id, action, scanned_at:new Date().toISOString() })
    const delta = action === 'checkout' ? 1 : -1
    await supabase.from('equipment_item').update({ issued_quantity: Math.max(0, (scannedItem.issued_quantity||0)+delta) }).eq('id', scannedItem.id)
    setActing(false); setScannedItem(null); setManualId(''); loadLog()
  }

  return (
    <div>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', marginBottom:'16px' }}>
        <div style={{ fontFamily:'var(--font-condensed)', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'12px' }}>Manual Lookup (paste item ID)</div>
        <div style={{ display:'flex', gap:'8px' }}>
          <input value={manualId} onChange={e=>setManualId(e.target.value)} placeholder="Paste equipment item ID..." style={{ flex:1, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', fontFamily:'var(--font-body)' }} onKeyDown={e=>e.key==='Enter'&&manualId.trim()&&lookupItem(manualId.trim())}/>
          <button onClick={()=>manualId.trim()&&lookupItem(manualId.trim())} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>LOOK UP</button>
        </div>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'8px' }}>Enter an equipment item ID above to look up and check in or check out an item.</div>
      </div>

      {scannedItem && (
        <div style={{ background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-md)', padding:'18px 20px', marginBottom:'16px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'1px', color:'var(--accent)', marginBottom:'6px' }}>{scannedItem.name}</div>
          <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:'12px' }}>{scannedItem.category} · Condition: {scannedItem.condition} · On hand: {scannedItem.quantity} · Issued: {scannedItem.issued_quantity||0}</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>logAction('checkout')} disabled={acting} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:acting?0.6:1 }}><Icon name="arrow-right" size={13}/>CHECK OUT</button>
            <button onClick={()=>logAction('checkin')} disabled={acting} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:acting?0.6:1 }}><Icon name="arrow-left" size={13}/>CHECK IN</button>
            <button onClick={()=>setScannedItem(null)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', cursor:'pointer', padding:'0 12px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px' }}>CANCEL</button>
          </div>
        </div>
      )}

      <div style={{ fontFamily:'var(--font-condensed)', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'8px' }}>Recent Activity</div>
      {log.length === 0 ? <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>No activity yet.</div> :
        log.map((entry, i) => (
          <div key={entry.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:i<log.length-1?'1px solid var(--border)':'none', fontSize:'12px' }}>
            <span style={{ fontWeight:700, color:entry.action==='checkout'?'var(--color-warning)':'var(--color-success)', fontFamily:'var(--font-condensed)', minWidth:'70px' }}>{entry.action?.toUpperCase()}</span>
            <span style={{ color:'var(--text-primary)', flex:1 }}>{entry.equipment_item?.name||'Unknown'}</span>
            <span style={{ color:'var(--text-muted)' }}>{entry.scanned_at?new Date(entry.scanned_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}</span>
          </div>
        ))
      }
    </div>
  )
}
