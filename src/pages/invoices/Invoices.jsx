import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'
import { exportInvoicePDF } from '../../lib/pdfExport'

const STATUS = {
  draft:    { label:'Draft',    bg:'var(--border)',              color:'var(--text-muted)' },
  sent:     { label:'Sent',     bg:'var(--color-info-bg)',       color:'var(--color-info)' },
  paid:     { label:'Paid',     bg:'var(--color-success-bg)',    color:'var(--color-success)' },
  overdue:  { label:'Overdue',  bg:'var(--color-danger-bg)',     color:'var(--color-danger)' },
  void:     { label:'Void',     bg:'rgba(130,130,130,0.12)',     color:'#8899aa' },
}

const s = {
  page:      { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:   { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:       { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  stats:     { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'20px' },
  statCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
  statLbl:   { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
  statVal:   { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  toolbar:   { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  search:    { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'180px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  sel:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' },
  addBtn:    { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 },
  pill:      { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  table:     { width:'100%', borderCollapse:'collapse' },
  th:        { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 12px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  tr:        { borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 150ms ease' },
  td:        { padding:'12px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  tdName:    { padding:'12px', fontSize:'13px', color:'var(--text-primary)', fontWeight:600, verticalAlign:'middle' },
  // Modal / detail
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' },
  modal:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'680px', boxShadow:'var(--shadow-modal)', flexShrink:0 },
  modalHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'22px' },
  modalTitle:{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)' },
  closeBtn:  { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' },
  sectionLbl:{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', margin:'18px 0 10px', borderBottom:'1px solid var(--border)', paddingBottom:'6px' },
  row:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  field:     { display:'flex', flexDirection:'column', gap:'5px' },
  fieldFull: { display:'flex', flexDirection:'column', gap:'5px', marginBottom:'12px' },
  lbl:       { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' },
  inp:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  saveBtn:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghostBtn:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  dangerBtn: { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
}

function fmtMoney(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0) }
function fmtDate(d) { if (!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

function nextInvoiceNumber(invoices) {
  const d = new Date()
  const prefix = `INV-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-`
  const existing = invoices.filter(i => i.invoice_number?.startsWith(prefix)).map(i => parseInt(i.invoice_number?.split('-').pop() || '0'))
  const next = (Math.max(0, ...existing) + 1)
  return `${prefix}${String(next).padStart(3,'0')}`
}

export default function Invoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editing, setEditing]     = useState(null)
  const [viewing, setViewing]     = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('invoice').select('*, invoice_item(*)').eq('company_id', profile.company_id).order('created_at', { ascending:false })
    setInvoices(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!inv.invoice_number?.toLowerCase().includes(q) && !inv.client_name?.toLowerCase().includes(q)) return false
    }
    return true
  }), [invoices, search, filterStatus])

  async function updateStatus(id, status) {
    await supabase.from('invoice').update({ status }).eq('id', id)
    load()
  }

  async function deleteInvoice(id) {
    await supabase.from('invoice').delete().eq('id', id)
    setViewing(null); load()
  }

  const totalOutstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((a,b) => a + (b.total||0), 0)
  const totalPaid        = invoices.filter(i => i.status === 'paid').reduce((a,b) => a + (b.total||0), 0)
  const overdueCount     = invoices.filter(i => i.status === 'overdue').length

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:'52px', borderRadius:'8px', marginBottom:'10px' }} />)}</div>

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>INVOICES</h2>
      <p style={s.sub}>Create, send, and track client invoices.</p>

      <div style={s.stats}>
        {[
          { label:'Outstanding', value:fmtMoney(totalOutstanding), color: totalOutstanding > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' },
          { label:'Paid (All Time)', value:fmtMoney(totalPaid), color:'var(--color-success)' },
          { label:'Overdue', value:overdueCount, color: overdueCount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' },
          { label:'Total Invoices', value:invoices.length, color:'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color, fontSize: c.value.toString().length > 7 ? '18px' : '26px' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search client, invoice #..." value={search} onChange={e => setSearch(e.target.value)}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}
        />
        <select style={s.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button style={s.addBtn} onClick={() => setEditing('new')}><Icon name="plus" size={15} />NEW INVOICE</button>
      </div>

      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
        <table style={s.table}>
          <thead>
            <tr>{['Invoice #','Client','Date','Due','Amount','Status',''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} style={s.tr}
                onClick={() => setViewing(inv)}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <td style={s.tdName}>{inv.invoice_number}</td>
                <td style={s.td}>{inv.client_name}</td>
                <td style={s.td}>{fmtDate(inv.issue_date)}</td>
                <td style={{ ...s.td, color: inv.status === 'overdue' ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{fmtDate(inv.due_date)}</td>
                <td style={{ ...s.td, fontFamily:'var(--font-condensed)', color:'var(--text-primary)', fontWeight:600 }}>{fmtMoney(inv.total)}</td>
                <td style={s.td}>
                  <span style={{ ...s.pill, background:STATUS[inv.status]?.bg, color:STATUS[inv.status]?.color }}>
                    {STATUS[inv.status]?.label ?? inv.status}
                  </span>
                </td>
                <td style={s.td} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {inv.status === 'draft' && (
                      <button style={{ ...s.ghostBtn, height:'32px', padding:'0 10px', fontSize:'11px' }} onClick={() => updateStatus(inv.id,'sent')}>
                        MARK SENT
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button style={{ ...s.saveBtn, height:'32px', padding:'0 10px', fontSize:'11px' }} onClick={() => updateStatus(inv.id,'paid')}>
                        MARK PAID
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>No invoices found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <InvoiceFormModal invoices={invoices} mode={editing === 'new' ? 'new' : 'edit'} invoice={editing === 'new' ? null : editing} companyId={profile.company_id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {viewing && <InvoiceDetailModal invoice={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} onDelete={deleteInvoice} onStatusChange={(id,st) => { updateStatus(id,st); setViewing(null) }} />}
    </div>
  )
}

// ── Invoice Form ──────────────────────────────────────────────────────────────

const EMPTY_ITEM = { id: Date.now(), description:'', quantity:1, unit_price:0, amount:0 }

function InvoiceFormModal({ invoices, mode, invoice, companyId, onClose, onSaved }) {
  const [form, setForm] = useState(invoice ? {
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name || '',
    client_email: invoice.client_email || '',
    client_address: invoice.client_address || '',
    issue_date: invoice.issue_date || new Date().toISOString().slice(0,10),
    due_date: invoice.due_date || '',
    tax_rate: invoice.tax_rate || 0,
    notes: invoice.notes || '',
  } : {
    invoice_number: nextInvoiceNumber(invoices),
    client_name: '', client_email: '', client_address: '',
    issue_date: new Date().toISOString().slice(0,10),
    due_date: '', tax_rate: 0, notes: '',
  })
  const [items, setItems] = useState(invoice?.invoice_item?.length ? invoice.invoice_item : [{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)

  function setF(k,v) { setForm(prev => ({...prev,[k]:v})) }
  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }

  function updateItem(idx, k, v) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [k]: v }
      if (k === 'quantity' || k === 'unit_price') {
        next[idx].amount = parseFloat(next[idx].quantity || 0) * parseFloat(next[idx].unit_price || 0)
      }
      return next
    })
  }
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM, id: Date.now() }]) }
  function removeItem(idx) { setItems(prev => prev.filter((_,i) => i !== idx)) }

  const subtotal  = items.reduce((a,it) => a + (parseFloat(it.amount)||0), 0)
  const taxAmount = subtotal * (parseFloat(form.tax_rate)||0) / 100
  const total     = subtotal + taxAmount

  async function save() {
    if (!form.client_name.trim()) return
    setSaving(true)
    const payload = { company_id:companyId, invoice_number:form.invoice_number, client_name:form.client_name.trim(), client_email:form.client_email.trim()||null, client_address:form.client_address.trim()||null, issue_date:form.issue_date, due_date:form.due_date||null, tax_rate:parseFloat(form.tax_rate)||0, tax_amount:taxAmount, subtotal, total, notes:form.notes.trim()||null, status: invoice?.status || 'draft' }
    let invId = invoice?.id
    if (invoice?.id) {
      await supabase.from('invoice').update(payload).eq('id', invoice.id)
      await supabase.from('invoice_item').delete().eq('invoice_id', invoice.id)
    } else {
      const { data } = await supabase.from('invoice').insert(payload).select().single()
      invId = data.id
    }
    if (invId) {
      await supabase.from('invoice_item').insert(items.filter(it => it.description.trim()).map(it => ({ invoice_id:invId, description:it.description.trim(), quantity:parseFloat(it.quantity)||1, unit_price:parseFloat(it.unit_price)||0, amount:parseFloat(it.amount)||0 })))
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div style={s.modalTitle}>{mode === 'new' ? 'NEW INVOICE' : 'EDIT INVOICE'}</div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div style={s.sectionLbl}>Client & Invoice Info</div>
        <div style={s.row}>
          <div style={s.field}>
            <div style={s.lbl}>Invoice #</div>
            <input style={s.inp} value={form.invoice_number} onChange={e => setF('invoice_number',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Client Name *</div>
            <input style={s.inp} value={form.client_name} onChange={e => setF('client_name',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Company or individual name" />
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Client Email</div>
            <input style={s.inp} type="email" value={form.client_email} onChange={e => setF('client_email',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Client Address</div>
            <input style={s.inp} value={form.client_address} onChange={e => setF('client_address',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Issue Date</div>
            <input style={s.inp} type="date" value={form.issue_date} onChange={e => setF('issue_date',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
          <div style={s.field}>
            <div style={s.lbl}>Due Date</div>
            <input style={s.inp} type="date" value={form.due_date} onChange={e => setF('due_date',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
        </div>

        <div style={s.sectionLbl}>Line Items</div>
        <div style={{ marginBottom:'14px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 100px 36px', gap:'6px', marginBottom:'6px' }}>
            {['Description','Qty','Unit Price','Amount',''].map(h => <div key={h} style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' }}>{h}</div>)}
          </div>
          {items.map((item, idx) => (
            <div key={item.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 100px 100px 36px', gap:'6px', marginBottom:'6px' }}>
              <input style={s.inp} value={item.description} onChange={e => updateItem(idx,'description',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Security services..." />
              <input style={s.inp} type="number" min="0" step="0.5" value={item.quantity} onChange={e => updateItem(idx,'quantity',e.target.value)} onFocus={inputF} onBlur={inputB} />
              <input style={s.inp} type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx,'unit_price',e.target.value)} onFocus={inputF} onBlur={inputB} />
              <div style={{ ...s.inp, color:'var(--text-muted)', cursor:'default', display:'flex', alignItems:'center' }}>{fmtMoney(item.amount)}</div>
              <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'44px', borderRadius:'var(--radius-sm)' }} onClick={() => removeItem(idx)}><Icon name="x" size={14} /></button>
            </div>
          ))}
          <button style={{ ...s.ghostBtn, height:'36px', fontSize:'12px', marginTop:'4px' }} onClick={addItem}><Icon name="plus" size={13} />ADD LINE</button>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:'16px', marginBottom:'16px', padding:'12px 16px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <span style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>TAX %</span>
            <input style={{ ...s.inp, width:'70px', textAlign:'right' }} type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={e => setF('tax_rate',e.target.value)} onFocus={inputF} onBlur={inputB} />
          </div>
          <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>Subtotal: <strong style={{ color:'var(--text-primary)' }}>{fmtMoney(subtotal)}</strong></div>
          {taxAmount > 0 && <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>Tax: <strong>{fmtMoney(taxAmount)}</strong></div>}
          <div style={{ fontSize:'15px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700 }}>TOTAL: {fmtMoney(total)}</div>
        </div>

        <div style={s.fieldFull}>
          <div style={s.lbl}>Notes</div>
          <input style={s.inp} value={form.notes} onChange={e => setF('notes',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Payment terms, bank details, thank you note..." />
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.saveBtn, opacity:(!form.client_name.trim()||saving)?0.6:1 }} onClick={save} disabled={!form.client_name.trim()||saving}>
            <Icon name="save" size={14} />{saving ? 'SAVING...' : 'SAVE INVOICE'}
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Invoice Detail / Print ────────────────────────────────────────────────────

function InvoiceDetailModal({ invoice, onClose, onEdit, onDelete, onStatusChange }) {
  const items = invoice.invoice_item || []

  function print() {
    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>${invoice.invoice_number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:48px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
      .logo{font-size:28px;font-weight:900;letter-spacing:4px;color:#0d1f35}
      .logo span{color:#a8841e}
      .inv-num{font-size:22px;font-weight:700;letter-spacing:2px;color:#0d1f35}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px}
      .meta-section h4{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:6px}
      .meta-section p{font-size:14px;color:#1a1a2e;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;padding:8px 12px;border-bottom:2px solid #e0e0e0;text-align:left}
      td{padding:12px;border-bottom:1px solid #f0f0f0;font-size:13px}
      .totals{display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-bottom:32px}
      .totals-row{display:flex;gap:32px;font-size:13px}
      .totals-row.total{font-size:16px;font-weight:700;color:#0d1f35;border-top:2px solid #0d1f35;padding-top:8px}
      .notes{font-size:12px;color:#888;border-top:1px solid #f0f0f0;padding-top:16px}
      .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:#e8f5e9;color:#2e7d32}
    </style></head><body>
    <div class="header">
      <div><div class="logo">POST<span>COMMAND</span></div><div style="font-size:11px;color:#888;margin-top:4px">Security Workforce Management</div></div>
      <div style="text-align:right"><div class="inv-num">${invoice.invoice_number}</div><div class="status" style="margin-top:8px">${invoice.status}</div></div>
    </div>
    <div class="meta">
      <div class="meta-section"><h4>Bill To</h4><p><strong>${invoice.client_name}</strong>${invoice.client_email ? '<br>'+invoice.client_email : ''}${invoice.client_address ? '<br>'+invoice.client_address : ''}</p></div>
      <div class="meta-section"><h4>Invoice Details</h4><p>Issue Date: <strong>${fmtDate(invoice.issue_date)}</strong>${invoice.due_date ? '<br>Due Date: <strong>'+fmtDate(invoice.due_date)+'</strong>' : ''}</p></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${it.description}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${fmtMoney(it.unit_price)}</td><td style="text-align:right"><strong>${fmtMoney(it.amount)}</strong></td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${fmtMoney(invoice.subtotal)}</span></div>
      ${invoice.tax_amount > 0 ? `<div class="totals-row"><span>Tax (${invoice.tax_rate}%)</span><span>${fmtMoney(invoice.tax_amount)}</span></div>` : ''}
      <div class="totals-row total"><span>Total</span><span>${fmtMoney(invoice.total)}</span></div>
    </div>
    ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ''}
    </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div>
            <div style={s.modalTitle}>{invoice.invoice_number}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{invoice.client_name}</div>
          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            <button style={{ ...s.ghostBtn, height:'36px', padding:'0 12px', fontSize:'12px' }} onClick={() => exportInvoicePDF(invoice, items)}><Icon name="download" size={14} />PDF</button>
            <button style={{ ...s.ghostBtn, height:'36px', padding:'0 12px', fontSize:'12px' }} onClick={print}><Icon name="printer" size={14} />PRINT</button>
            <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
        </div>

        <div style={{ display:'flex', gap:'24px', flexWrap:'wrap', marginBottom:'18px' }}>
          {[
            { label:'Issue Date', value:fmtDate(invoice.issue_date) },
            { label:'Due Date',   value:fmtDate(invoice.due_date) },
            { label:'Status',     value: <span style={{ ...s.pill, background:STATUS[invoice.status]?.bg, color:STATUS[invoice.status]?.color }}>{STATUS[invoice.status]?.label}</span> },
            { label:'Total',      value: <span style={{ fontFamily:'var(--font-display)', fontSize:'18px', color:'var(--accent)' }}>{fmtMoney(invoice.total)}</span> },
          ].map(item => (
            <div key={item.label}>
              <div style={s.lbl}>{item.label}</div>
              <div style={{ fontSize:'13px', color:'var(--text-primary)', marginTop:'4px' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div style={{ marginBottom:'16px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            <table style={s.table}>
              <thead><tr>{['Description','Qty','Unit Price','Amount'].map(h => <th key={h} style={{ ...s.th, background:'var(--bg-surface)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {items.map((it,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={s.td}>{it.description}</td>
                    <td style={s.td}>{it.quantity}</td>
                    <td style={s.td}>{fmtMoney(it.unit_price)}</td>
                    <td style={{ ...s.td, fontWeight:600, color:'var(--text-primary)' }}>{fmtMoney(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:'16px', marginBottom:'16px', fontSize:'13px' }}>
          {invoice.tax_amount > 0 && <span style={{ color:'var(--text-muted)' }}>Tax {invoice.tax_rate}%: {fmtMoney(invoice.tax_amount)}</span>}
          <span style={{ fontFamily:'var(--font-condensed)', fontSize:'16px', fontWeight:700, color:'var(--accent)' }}>TOTAL: {fmtMoney(invoice.total)}</span>
        </div>

        {invoice.notes && <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'16px', padding:'12px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)' }}>{invoice.notes}</div>}

        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', borderTop:'1px solid var(--border)', paddingTop:'16px' }}>
          {invoice.status === 'draft'  && <button style={s.saveBtn}   onClick={() => onStatusChange(invoice.id,'sent')}><Icon name="send" size={13} />MARK SENT</button>}
          {invoice.status === 'sent'   && <button style={s.saveBtn}   onClick={() => onStatusChange(invoice.id,'paid')}><Icon name="check" size={13} />MARK PAID</button>}
          {invoice.status === 'sent'   && <button style={s.dangerBtn} onClick={() => onStatusChange(invoice.id,'overdue')}><Icon name="alert-circle" size={13} />MARK OVERDUE</button>}
          {invoice.status !== 'void'   && <button style={s.ghostBtn}  onClick={onEdit}><Icon name="edit-2" size={13} />EDIT</button>}
          <button style={s.dangerBtn} onClick={() => { if (window.confirm('Delete this invoice?')) onDelete(invoice.id) }}><Icon name="trash-2" size={13} />DELETE</button>
        </div>
      </div>
    </div>
  )
}
