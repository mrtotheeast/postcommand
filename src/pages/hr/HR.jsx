import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import SignaturePad from '../../components/ui/SignaturePad'

const DOC_TYPES = [
  { value: 'guard_license',    label: 'Guard License / SORA' },
  { value: 'background_check', label: 'Background Check' },
  { value: 'cpr_cert',         label: 'CPR Certification' },
  { value: 'first_aid',        label: 'First Aid Certification' },
  { value: 'firearms_cert',    label: 'Firearms Certification' },
  { value: 'id_badge',         label: 'ID / Badge' },
  { value: 'i9',               label: 'I-9 Employment Eligibility' },
  { value: 'w4',               label: 'W-4 Tax Form' },
  { value: 'other',            label: 'Other' },
]
const REQUIRED_DOCS = ['guard_license', 'background_check', 'i9', 'w4']

const s = {
  page:    { padding: '24px', maxWidth: '1100px', animation: 'fadeIn 200ms ease' },
  heading: { fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '2px', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '4px' },
  sub:     { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' },
  tabs:    { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '0' },
  tab:     { padding: '10px 18px', fontSize: '13px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-condensed)', letterSpacing: '0.5px', borderBottom: '2px solid transparent', marginBottom: '-1px', transition: 'all 150ms ease' },
  tabActive:{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)', fontWeight: 700 },
  stats:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginBottom: '20px' },
  statCard:{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px' },
  statLbl: { fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)', marginBottom: '4px' },
  statVal: { fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '1px', lineHeight: 1 },
  toolbar: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  search:  { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', flex: 1, minWidth: '200px', fontFamily: 'var(--font-body)' },
  select:  { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'var(--font-body)', cursor: 'pointer' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  tr:      { borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 150ms ease' },
  td:      { padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', verticalAlign: 'middle' },
  tdName:  { padding: '12px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, verticalAlign: 'middle' },
  pill:    { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-condensed)', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  card:    { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '16px' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' },
  modal:   { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '28px', width: '100%', maxWidth: '580px', boxShadow: 'var(--shadow-modal)', flexShrink: 0 },
  modalHead:{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle:{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '1.5px', color: 'var(--text-primary)' },
  closeBtn:  { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)' },
  docRow:  { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderBottom: '1px solid var(--border)', fontSize: '13px' },
  label:   { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)', marginBottom: '5px' },
  input:   { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontFamily: 'var(--font-body)', transition: 'border-color 150ms ease' },
  addBtn:  { display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 18px', height: '40px', fontFamily: 'var(--font-condensed)', fontSize: '13px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
  deleteBtn:{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)' },
}

function docStatus(expiry) {
  if (!expiry) return 'none'
  const d = new Date(expiry), now = new Date(), diff = (d - now) / 86400000
  if (diff < 0) return 'expired'
  if (diff < 30) return 'expiring'
  return 'ok'
}
function statusPill(status) {
  if (status === 'expired')  return { ...s.pill, background: 'var(--color-danger-bg)',  color: 'var(--color-danger)' }
  if (status === 'expiring') return { ...s.pill, background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }
  if (status === 'ok')       return { ...s.pill, background: 'var(--color-success-bg)', color: 'var(--color-success)' }
  return { ...s.pill, background: 'var(--border)', color: 'var(--text-muted)' }
}
function complianceScore(docs) {
  if (!REQUIRED_DOCS.length) return 100
  const have = REQUIRED_DOCS.filter(r => docs.some(d => d.doc_type === r && docStatus(d.expiry_date) !== 'expired'))
  return Math.round((have.length / REQUIRED_DOCS.length) * 100)
}

export default function HR() {
  const { profile } = useAuth()
  const [tab, setTab]             = useState('documents')
  const [employees, setEmployees]   = useState([])
  const [docs, setDocs]             = useState([])
  const [writeups, setWriteups]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [reminderResult, setReminderResult]     = useState(null)
  const [search, setSearch]       = useState('')
  const [filterCompliance, setFilterCompliance] = useState('all')
  const [selected, setSelected]   = useState(null)
  const [wuModal, setWuModal]     = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const [{ data: eData }, { data: dData }, { data: wData }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role,status,hire_date,invitation_status,position_title,email').eq('company_id', profile.company_id).order('last_name'),
      supabase.from('employee_document').select('*').eq('company_id', profile.company_id),
      supabase.from('employee_writeup').select('*').eq('company_id', profile.company_id).order('created_at', { ascending:false }),
    ])
    setEmployees(eData || [])
    setDocs(dData || [])
    setWriteups(wData || [])
    setLoading(false)
  }

  const empDocs = (empId) => docs.filter(d => d.employee_id === empId)

  const enriched = useMemo(() => (employees || []).map(e => {
    const d = empDocs(e.id)
    const expired  = d.filter(doc => docStatus(doc.expiry_date) === 'expired').length
    const expiring = d.filter(doc => docStatus(doc.expiry_date) === 'expiring').length
    const score    = complianceScore(d)
    return { ...e, _docs: d, _expired: expired, _expiring: expiring, _score: score }
  }), [employees, docs])

  const filtered = useMemo(() => enriched.filter(e => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase()) && !e.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCompliance === 'expired'  && e._expired === 0)      return false
    if (filterCompliance === 'expiring' && e._expiring === 0)     return false
    if (filterCompliance === 'missing'  && e._score === 100)      return false
    return true
  }), [enriched, search, filterCompliance])

  const totalDocs    = docs.length
  const expiredCount = docs.filter(d => docStatus(d.expiry_date) === 'expired').length
  const expiringCount= docs.filter(d => docStatus(d.expiry_date) === 'expiring').length
  const onboarding   = employees.filter(e => e.invitation_status === 'pending' || e.status === 'probation')
  const openWriteups = writeups.filter(w => w.type === 'write_up' || w.type === 'warning')

  if (loading) return <div style={{ padding: '24px' }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height: '50px', borderRadius: '8px', marginBottom: '10px' }} />)}</div>

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'4px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={s.heading}>HR & DOCUMENTS</h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>Employee documentation, compliance tracking, and onboarding.</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {reminderResult && <span style={{ fontSize:'12px', color:'var(--color-success)' }}>✓ {reminderResult}</span>}
          <button
            style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-warning-bg)', color:'var(--color-warning)', border:'1px solid rgba(232,148,58,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:sendingReminders?0.6:1 }}
            onClick={async () => {
              setSendingReminders(true); setReminderResult(null)
              try {
                const { data } = await supabase.functions.invoke('cert-reminders')
                setReminderResult(`${data?.sent||0} reminder${(data?.sent||0)!==1?'s':''} sent`)
              } catch { setReminderResult('Error — check Supabase logs') }
              setSendingReminders(false)
            }}
            disabled={sendingReminders}
          >
            <Icon name="bell" size={13}/>{sendingReminders ? 'SENDING...' : 'SEND CERT REMINDERS'}
          </button>
        </div>
      </div>

      <div style={s.stats}>
        {[
          { label: 'Total Documents', value: totalDocs, color: 'var(--text-primary)' },
          { label: 'Expired', value: expiredCount, color: expiredCount > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' },
          { label: 'Expiring Soon', value: expiringCount, color: expiringCount > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' },
          { label: 'Write-Ups', value: openWriteups.length, color: openWriteups.length > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' },
          { label: 'Onboarding', value: onboarding.length, color: onboarding.length > 0 ? 'var(--accent)' : 'var(--text-secondary)' },
        ].map(s2 => (
          <div key={s2.label} style={s.statCard}>
            <div style={s.statLbl}>{s2.label}</div>
            <div style={{ ...s.statVal, color: s2.color }}>{s2.value}</div>
          </div>
        ))}
      </div>

      <div style={s.tabs}>
        {[
          { id: 'documents',    label: 'Documents' },
          { id: 'writeups',     label: `Write-Ups (${writeups.length})` },
          { id: 'onboarding',   label: `Onboarding (${onboarding.length})` },
          { id: 'violations',   label: 'Geofence Violations' },
          { id: 'recognition',  label: 'Recognition' },
          { id: 'esignature',   label: 'E-Signature' },
          { id: 'policies',     label: 'Policy Management' },
          { id: 'company_docs', label: 'Company Docs' },
        ].map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'documents' && (
        <>
          <div style={s.toolbar}>
            <input style={s.search} placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={s.select} value={filterCompliance} onChange={e => setFilterCompliance(e.target.value)}>
              <option value="all">All Employees</option>
              <option value="expired">Has Expired Docs</option>
              <option value="expiring">Expiring Soon</option>
              <option value="missing">Missing Required</option>
            </select>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Employee', 'Role', 'Documents', 'Compliance', 'Status'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} style={s.tr}
                    onClick={() => setSelected(emp)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={s.tdName}>
                      {emp.first_name} {emp.last_name}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '1px' }}>{emp.email}</div>
                    </td>
                    <td style={s.td}>{ROLE_LABELS[emp.role] ?? emp.role}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {emp._expired > 0  && <span style={statusPill('expired')}><Icon name="x-circle" size={10} />{emp._expired} expired</span>}
                        {emp._expiring > 0 && <span style={statusPill('expiring')}><Icon name="clock" size={10} />{emp._expiring} expiring</span>}
                        {emp._docs.length > 0 && emp._expired === 0 && emp._expiring === 0 && <span style={statusPill('ok')}>{emp._docs.length} docs</span>}
                        {emp._docs.length === 0 && <span style={statusPill('none')}>No docs</span>}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--border)', maxWidth: '80px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${emp._score}%`, background: emp._score < 50 ? 'var(--color-danger)' : emp._score < 100 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px', transition: 'width 300ms ease' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp._score}%</span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.pill, ...(emp.status === 'active' ? { background: 'var(--color-success-bg)', color: 'var(--color-success)' } : { background: 'var(--border)', color: 'var(--text-muted)' }) }}>
                        {emp.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No employees match the filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'writeups' && (
        <WriteupsList writeups={writeups} employees={employees} companyId={profile.company_id} onAdd={() => setWuModal('new')} onSelect={setWuModal} onRefresh={load} />
      )}

      {tab === 'onboarding' && (
        <OnboardingList employees={onboarding} />
      )}

      {tab === 'violations' && (
        <ViolationsTab companyId={profile.company_id} />
      )}

      {tab === 'recognition' && (
        <RecognitionTab companyId={profile.company_id} profile={profile} employees={employees} />
      )}

      {tab === 'esignature' && (
        <ESignatureTab employees={employees} companyId={profile.company_id} />
      )}

      {tab === 'policies' && (
        <PolicyManagementTab companyId={profile.company_id} />
      )}

      {tab === 'company_docs' && (
        <CompanyDocsTab profile={profile} companyId={profile.company_id} canEdit={atLeast(profile?.role, 'lieutenant')} />
      )}

      {wuModal && (
        <WriteupModal
          mode={typeof wuModal === 'string' ? 'new' : 'view'}
          writeup={typeof wuModal === 'object' ? wuModal : null}
          employees={employees}
          companyId={profile.company_id}
          authorId={profile.id}
          onClose={() => setWuModal(null)}
          onSaved={() => { setWuModal(null); load() }}
        />
      )}

      {selected && (
        <EmployeeDocModal
          employee={selected}
          docs={empDocs(selected.id)}
          companyId={profile.company_id}
          onClose={() => setSelected(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}

function OnboardingList({ employees }) {
  if (employees.length === 0) {
    return (
      <div style={{ ...{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '40px', textAlign: 'center' } }}>
        <Icon name="check-circle" size={28} color="var(--color-success)" />
        <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>No employees currently in onboarding or probation.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {employees.map(e => (
        <div key={e.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-condensed)', fontSize: '14px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            {e.first_name?.[0]}{e.last_name?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{e.first_name} {e.last_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ROLE_LABELS[e.role]} · {e.position_title || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-condensed)', letterSpacing: '1px', fontWeight: 700, color: e.status === 'probation' ? 'var(--color-warning)' : 'var(--accent)', background: e.status === 'probation' ? 'var(--color-warning-bg)' : 'var(--accent-bg)', padding: '2px 8px', borderRadius: '10px' }}>
              {e.status === 'probation' ? 'PROBATION' : 'PENDING INVITE'}
            </div>
            {e.hire_date && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Hired {new Date(e.hire_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmployeeDocModal({ employee, docs, companyId, onClose, onRefresh }) {
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [form, setForm]       = useState({ doc_type: 'guard_license', doc_name: '', doc_number: '', issued_date: '', expiry_date: '', notes: '' })

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  async function addDoc() {
    if (!form.doc_name.trim() && !form.doc_type) return
    setSaving(true)
    const docName = form.doc_name.trim() || DOC_TYPES.find(d => d.value === form.doc_type)?.label || form.doc_type
    await supabase.from('employee_document').insert({
      company_id: companyId,
      employee_id: employee.id,
      doc_type: form.doc_type,
      doc_name: docName,
      doc_number: form.doc_number || null,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes || null,
    })
    setSaving(false)
    setAdding(false)
    setForm({ doc_type: 'guard_license', doc_name: '', doc_number: '', issued_date: '', expiry_date: '', notes: '' })
    onRefresh()
  }

  async function deleteDoc(id) {
    setDeleting(id)
    await supabase.from('employee_document').delete().eq('id', id)
    setDeleting(null)
    onRefresh()
  }

  const inputF = e => { e.target.style.borderColor = 'var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor = 'var(--border)' }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div>
            <div style={s.modalTitle}>{employee.first_name} {employee.last_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ROLE_LABELS[employee.role]} · Documents</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {/* Document list */}
        {docs.length === 0 && !adding && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No documents on file for this employee.</div>
        )}
        {docs.map(doc => {
          const status = docStatus(doc.expiry_date)
          return (
            <div key={doc.id} style={s.docRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{doc.doc_name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {doc.doc_number && <span>#{doc.doc_number}</span>}
                  {doc.issued_date && <span>Issued {new Date(doc.issued_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  {doc.expiry_date && <span>Exp {new Date(doc.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </div>
              </div>
              {doc.expiry_date && (
                <span style={statusPill(status)}>
                  {status === 'expired' ? 'EXPIRED' : status === 'expiring' ? 'EXPIRING' : 'VALID'}
                </span>
              )}
              <button style={s.deleteBtn} onClick={() => deleteDoc(doc.id)} disabled={deleting === doc.id} title="Remove">
                <Icon name="trash-2" size={14} />
              </button>
            </div>
          )
        })}

        {/* Add form */}
        {adding ? (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-condensed)', marginBottom: '14px' }}>New Document</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <div style={s.label}>Type</div>
                <select style={{ ...s.input, cursor: 'pointer' }} value={form.doc_type} onChange={e => setF('doc_type', e.target.value)}>
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <div style={s.label}>Document Name</div>
                <input style={s.input} value={form.doc_name} onChange={e => setF('doc_name', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder={DOC_TYPES.find(d => d.value === form.doc_type)?.label} />
              </div>
              <div>
                <div style={s.label}>Doc Number / ID</div>
                <input style={s.input} value={form.doc_number} onChange={e => setF('doc_number', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Optional" />
              </div>
              <div>
                <div style={s.label}>Issued Date</div>
                <input style={s.input} type="date" value={form.issued_date} onChange={e => setF('issued_date', e.target.value)} onFocus={inputF} onBlur={inputB} />
              </div>
              <div>
                <div style={s.label}>Expiry Date</div>
                <input style={s.input} type="date" value={form.expiry_date} onChange={e => setF('expiry_date', e.target.value)} onFocus={inputF} onBlur={inputB} />
              </div>
              <div>
                <div style={s.label}>Notes</div>
                <input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Optional" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={s.addBtn} onClick={addDoc} disabled={saving}>{saving ? 'SAVING...' : 'SAVE DOCUMENT'}</button>
              <button style={{ ...s.addBtn, background: 'var(--border)', color: 'var(--text-secondary)' }} onClick={() => setAdding(false)}>CANCEL</button>
            </div>
          </div>
        ) : (
          <button style={{ ...s.addBtn, marginTop: '16px', background: 'transparent', color: 'var(--accent)', border: '1px dashed var(--accent-border)' }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />ADD DOCUMENT
          </button>
        )}
      </div>
    </div>
  )
}

// ── Write-Ups ─────────────────────────────────────────────────────────────────

const WU_TYPES = [
  { value:'write_up',           label:'Write-Up',           color:'var(--color-danger)',  bg:'var(--color-danger-bg)' },
  { value:'warning',            label:'Verbal Warning',     color:'var(--color-warning)', bg:'var(--color-warning-bg)' },
  { value:'counseling',         label:'Counseling',         color:'var(--color-info)',    bg:'var(--color-info-bg)' },
  { value:'commendation',       label:'Commendation',       color:'var(--color-success)', bg:'var(--color-success-bg)' },
  { value:'termination_notice', label:'Termination Notice', color:'#e05555',              bg:'rgba(224,85,85,0.12)' },
]
const WU_SEVERITY = ['low','medium','high','critical']
function wuTypeMeta(type) { return WU_TYPES.find(t => t.value === type) || WU_TYPES[0] }

function WriteupsList({ writeups, employees, onAdd, onSelect }) {
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]))
  const [filter, setFilter] = useState('all')
  const visible = writeups.filter(w => filter === 'all' || w.type === filter)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'10px' }}>
        <select style={s.select} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Types</option>
          {WU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button style={s.addBtn} onClick={onAdd}><Icon name="plus" size={14} />ADD RECORD</button>
      </div>
      {visible.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'40px', textAlign:'center', color:'var(--text-muted)' }}>No records found.</div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          {visible.map((wu, i) => {
            const emp = empMap[wu.employee_id]
            const meta = wuTypeMeta(wu.type)
            return (
              <div key={wu.id}
                style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom: i < visible.length-1 ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 150ms ease' }}
                onClick={() => onSelect(wu)}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <span style={{ ...s.pill, background:meta.bg, color:meta.color, minWidth:'100px', justifyContent:'center' }}>{meta.label.toUpperCase()}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{emp ? `${emp.first_name} ${emp.last_name}` : '—'}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{wu.description?.slice(0,80)}{wu.description?.length > 80 ? '...' : ''}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{new Date(wu.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                  {wu.severity && wu.type !== 'commendation' && <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>{wu.severity}</div>}
                </div>
                <Icon name="chevron-right" size={14} color="var(--text-muted)" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WriteupModal({ mode, writeup, employees, companyId, onClose, onSaved }) {
  const EMPTY = { employee_id:'', type:'write_up', severity:'medium', description:'', incident_date:'', notes:'' }
  const [form, setForm] = useState(writeup ? { ...EMPTY, ...writeup } : EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function setF(k,v) { setForm(prev => ({ ...prev, [k]:v })) }
  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }
  const isView = mode === 'view'
  const meta = wuTypeMeta(form.type)

  async function save() {
    if (!form.employee_id || !form.description.trim()) return
    setSaving(true)
    const payload = { company_id:companyId, employee_id:form.employee_id, type:form.type, severity:form.severity, description:form.description.trim(), incident_date:form.incident_date||null, notes:form.notes.trim()||null }
    if (writeup?.id) await supabase.from('employee_writeup').update(payload).eq('id', writeup.id)
    else await supabase.from('employee_writeup').insert(payload)
    setSaving(false); onSaved()
  }

  async function del() {
    if (!writeup?.id) return
    setDeleting(true)
    await supabase.from('employee_writeup').delete().eq('id', writeup.id)
    setDeleting(false); onSaved()
  }

  const viewEmp = writeup ? employees.find(e => e.id === writeup.employee_id) : null

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <div>
            <div style={s.modalTitle}>{isView ? meta.label.toUpperCase() : 'NEW RECORD'}</div>
            {isView && viewEmp && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{viewEmp.first_name} {viewEmp.last_name}</div>}
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        {isView ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {[
              { label:'Date',        value: writeup.incident_date ? new Date(writeup.incident_date+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date(writeup.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) },
              { label:'Type',        value: meta.label },
              { label:'Severity',    value: writeup.type !== 'commendation' ? (writeup.severity?.toUpperCase() ?? '—') : 'N/A' },
              { label:'Description', value: writeup.description },
              { label:'Notes',       value: writeup.notes || '—' },
            ].map(item => (
              <div key={item.label}>
                <div style={s.label}>{item.label}</div>
                <div style={{ fontSize:'13px', color:'var(--text-primary)', lineHeight:1.6, marginTop:'3px' }}>{item.value}</div>
              </div>
            ))}
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button style={{ ...s.addBtn, background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', opacity:deleting?0.6:1 }} onClick={del} disabled={deleting}>
                <Icon name="trash-2" size={13} />{deleting ? 'DELETING...' : 'DELETE'}
              </button>
              <button style={{ ...s.addBtn, background:'var(--border)', color:'var(--text-secondary)' }} onClick={onClose}>CLOSE</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div>
                <div style={s.label}>Employee *</div>
                <select style={{ ...s.input, cursor:'pointer' }} value={form.employee_id} onChange={e => setF('employee_id',e.target.value)} onFocus={inputF} onBlur={inputB}>
                  <option value="">Select employee...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </div>
              <div>
                <div style={s.label}>Type *</div>
                <select style={{ ...s.input, cursor:'pointer' }} value={form.type} onChange={e => setF('type',e.target.value)} onFocus={inputF} onBlur={inputB}>
                  {WU_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={s.label}>Incident Date</div>
                <input style={s.input} type="date" value={form.incident_date} onChange={e => setF('incident_date',e.target.value)} onFocus={inputF} onBlur={inputB} />
              </div>
              {form.type !== 'commendation' && (
                <div>
                  <div style={s.label}>Severity</div>
                  <select style={{ ...s.input, cursor:'pointer' }} value={form.severity} onChange={e => setF('severity',e.target.value)}>
                    {WU_SEVERITY.map(sv => <option key={sv} value={sv}>{sv.charAt(0).toUpperCase()+sv.slice(1)}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginBottom:'12px' }}>
              <div style={s.label}>Description *</div>
              <textarea style={{ ...s.input, height:'90px', resize:'vertical', lineHeight:1.5, marginTop:'5px' }} value={form.description} onChange={e => setF('description',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Describe the incident or recognition..." />
            </div>
            <div style={{ marginBottom:'18px' }}>
              <div style={s.label}>Internal Notes (optional)</div>
              <input style={s.input} value={form.notes} onChange={e => setF('notes',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Follow-up actions, supervisor notes..." />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button style={{ ...s.addBtn, opacity:(!form.employee_id||!form.description.trim()||saving)?0.6:1 }} onClick={save} disabled={!form.employee_id||!form.description.trim()||saving}>
                {saving ? 'SAVING...' : 'SAVE RECORD'}
              </button>
              <button style={{ ...s.addBtn, background:'var(--border)', color:'var(--text-secondary)' }} onClick={onClose}>CANCEL</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── E-Signature Tab ───────────────────────────────────────────────────────────

const SIG_DOCS = [
  { id:'offer_letter',    label:'Offer Letter',              required:true },
  { id:'handbook',        label:'Employee Handbook',         required:true },
  { id:'code_of_conduct', label:'Code of Conduct',           required:true },
  { id:'drug_policy',     label:'Drug & Alcohol Policy',     required:true },
  { id:'use_of_force',    label:'Use of Force Policy',       required:true },
  { id:'confidentiality', label:'Confidentiality Agreement', required:false },
  { id:'at_will',         label:'At-Will Employment Notice', required:false },
  { id:'media_policy',    label:'Social Media Policy',       required:false },
]

function ESignatureTab({ employees, companyId }) {
  const [selectedEmp, setSelectedEmp] = useState(null)
  const [signatures, setSignatures]   = useState({})
  const [loading, setLoading]         = useState(false)
  const [saved, setSaved]             = useState(false)

  useEffect(() => {
    if (!selectedEmp) return
    setLoading(true)
    supabase.from('employee_signature').select('*').eq('employee_id', selectedEmp.id)
      .then(({ data }) => {
        const m = {}
        for (const row of (data||[])) { m[row.document_id] = row.signature_url }
        setSignatures(m); setLoading(false)
      })
  }, [selectedEmp])

  async function handleSign(docId, dataUrl) {
    if (!selectedEmp) return
    let url = dataUrl
    try {
      const res = await fetch(dataUrl); const blob = await res.blob()
      const path = `${companyId}/${selectedEmp.id}/${docId}-${Date.now()}.png`
      const { data, error } = await supabase.storage.from('employee-signatures').upload(path, blob, { upsert:true, contentType:'image/png' })
      if (!error && data) {
        const { data:{ publicUrl } } = supabase.storage.from('employee-signatures').getPublicUrl(data.path)
        url = publicUrl
      }
    } catch {}
    await supabase.from('employee_signature').upsert({ company_id:companyId, employee_id:selectedEmp.id, document_id:docId, signature_url:url, signed_at:new Date().toISOString() }, { onConflict:'employee_id,document_id' })
    setSignatures(prev => ({ ...prev, [docId]: url }))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const signedCount = Object.keys(signatures).length

  return (
    <div>
      <div style={{ ...s.card, marginBottom:'16px' }}>
        <div style={s.cardTitle}>Select Employee</div>
        <select style={{ ...s.select, width:'100%' }} value={selectedEmp?.id||''} onChange={e=>setSelectedEmp(employees.find(emp=>emp.id===e.target.value)||null)}>
          <option value="">Choose an employee...</option>
          {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} — {ROLE_LABELS[emp.role]||emp.role}</option>)}
        </select>
      </div>

      {selectedEmp && (
        <div style={s.card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <div style={s.cardTitle}>{selectedEmp.first_name} {selectedEmp.last_name} — Onboarding Documents</div>
            <div style={{ fontSize:'12px', color: signedCount >= SIG_DOCS.filter(d=>d.required).length ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {signedCount} / {SIG_DOCS.length} signed
            </div>
          </div>
          {saved && <div style={{ fontSize:'12px', color:'var(--color-success)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}><Icon name="check-circle" size={13}/>Signature saved.</div>}
          {loading ? <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {SIG_DOCS.map(doc => {
                const existingUrl = signatures[doc.id]
                return (
                  <div key={doc.id} style={{ borderBottom:'1px solid var(--border)', paddingBottom:'16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                      <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{doc.label}</div>
                      {doc.required && <span style={{ fontSize:'10px', color:'var(--color-danger)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>REQUIRED</span>}
                      {existingUrl && <span style={{ fontSize:'10px', color:'var(--color-success)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', display:'flex', alignItems:'center', gap:'3px' }}><Icon name="check-circle" size={11}/>SIGNED</span>}
                    </div>
                    <SignaturePad
                      existingUrl={existingUrl}
                      onSign={(dataUrl) => handleSign(doc.id, dataUrl)}
                      onClear={() => setSignatures(prev => { const n={...prev}; delete n[doc.id]; return n })}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Geofence Violations Tab ───────────────────────────────────────────────────

function ViolationsTab({ companyId }) {
  const [violations, setViolations] = useState([])
  const [employees, setEmployees]   = useState([])
  const [sites, setSites]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterEmp, setFilterEmp]   = useState('all')

  useEffect(() => { if (companyId) loadV() }, [companyId])

  async function loadV() {
    setLoading(true)
    const [{ data: vData }, { data: eData }, { data: sData }] = await Promise.all([
      supabase.from('clockin_violation').select('*').eq('company_id', companyId).order('created_at',{ascending:false}).limit(200),
      supabase.from('employee').select('id,first_name,last_name').eq('company_id', companyId).eq('status','active'),
      supabase.from('site').select('id,name').eq('company_id', companyId),
    ])
    setViolations(vData||[]); setEmployees(eData||[]); setSites(sData||[]); setLoading(false)
  }

  const empMap  = Object.fromEntries((employees||[]).map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  const siteMap = Object.fromEntries((sites||[]).map(sv=>[sv.id,sv.name]))
  const visible = violations.filter(v => filterEmp==='all'||v.employee_id===filterEmp)
  const overrideCount = violations.filter(v=>v.overridden).length
  const avgDist = violations.length>0 ? Math.round(violations.reduce((a,v)=>a+(v.distance_meters||0),0)/violations.length) : 0

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px', padding:'20px 0' }}>LOADING...</div>

  return (
    <div>
      <div style={s.stats}>
        {[
          { label:'Total Violations',     value:violations.length, color:'var(--color-danger)' },
          { label:'Override Attempts',    value:overrideCount,     color:'var(--color-warning)' },
          { label:'Avg Distance Outside', value:`${avgDist}m`,     color:'var(--text-primary)' },
          { label:'Unique Officers',      value:new Set(violations.map(v=>v.employee_id)).size, color:'var(--color-info)' },
        ].map(c=>(
          <div key={c.label} style={s.statCard}>
            <div style={s.statLbl}>{c.label}</div>
            <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
        <select style={s.select} value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}>
          <option value="all">All Officers</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </div>
      {visible.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'40px', textAlign:'center' }}>
          <Icon name="shield-check" size={28} color="var(--color-success)"/>
          <div style={{ marginTop:'12px', fontSize:'14px', color:'var(--color-success)', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>NO VIOLATIONS FOUND</div>
        </div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          <table style={s.table}>
            <thead><tr>{['Date & Time','Officer','Site','Distance','Override','Reason'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {visible.slice(0,100).map((v)=>(
                <tr key={v.id} style={s.tr} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={s.td}>{new Date(v.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})} {new Date(v.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={s.tdName}>{empMap[v.employee_id]||'—'}</td>
                  <td style={s.td}>{siteMap[v.site_id]||'—'}</td>
                  <td style={{ ...s.td, color:'var(--color-danger)', fontWeight:600, fontFamily:'var(--font-condensed)' }}>{v.distance_meters?`${v.distance_meters}m`:'—'}</td>
                  <td style={s.td}><span style={{ display:'inline-flex', padding:'2px 7px', borderRadius:'10px', fontSize:'10px', fontFamily:'var(--font-condensed)', fontWeight:700, background:v.overridden?'var(--color-warning-bg)':'var(--border)', color:v.overridden?'var(--color-warning)':'var(--text-muted)' }}>{v.overridden?'YES':'NO'}</span></td>
                  <td style={{ ...s.td, maxWidth:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.override_reason||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length>100 && <div style={{ padding:'12px 18px', fontSize:'12px', color:'var(--text-muted)', borderTop:'1px solid var(--border)' }}>Showing 100 of {visible.length} violations</div>}
        </div>
      )}
    </div>
  )
}

// ── Recognition Tab ───────────────────────────────────────────────────────────

const REC_TYPES  = ['Above & Beyond','Perfect Attendance','Safety Champion','Team Player','Leadership','Customer Service']
const REC_EMOJIS = ['⭐','🎯','🛡️','🤝','👑','💼']

function RecognitionTab({ companyId, profile, employees }) {
  const [recs, setRecs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]     = useState({ employee_id:'', recognition_type:REC_TYPES[0], message:'', badge_emoji:'⭐' })
  const [saving, setSaving] = useState(false)
  const [myEmpId, setMyEmpId] = useState(null)
  const empMap = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  useEffect(() => { if (!companyId) return; load(); supabase.from('employee').select('id').eq('user_id',profile.id).single().then(({data})=>setMyEmpId(data?.id)) }, [companyId])
  async function load() { setLoading(true); const { data } = await supabase.from('recognition').select('*').eq('company_id',companyId).order('created_at',{ascending:false}).limit(50); setRecs(data||[]); setLoading(false) }
  async function submit() {
    if (!form.employee_id||!form.message.trim()) return
    setSaving(true); await supabase.from('recognition').insert({ company_id:companyId, given_by:myEmpId, ...form }); setSaving(false); setShowNew(false); setForm({employee_id:'',recognition_type:REC_TYPES[0],message:'',badge_emoji:'⭐'}); load()
  }
  const TYPE_COLORS = { 'Above & Beyond':'#f59e0b','Perfect Attendance':'#10b981','Safety Champion':'#ef4444','Team Player':'#6366f1','Leadership':'#8b5cf6','Customer Service':'#ec4899' }
  const inp2 = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl2 = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }
  return (
    <div>
      {!showNew ? (
        <button style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 18px',height:'40px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer',marginBottom:'16px'}} onClick={()=>setShowNew(true)}><Icon name="star" size={14}/>GIVE RECOGNITION</button>
      ) : (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'16px',marginBottom:'16px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={lbl2}>Employee *</div><select style={{...inp2,cursor:'pointer'}} value={form.employee_id} onChange={e=>setForm(p=>({...p,employee_id:e.target.value}))}><option value="">Select...</option>{employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
            <div><div style={lbl2}>Type</div><select style={{...inp2,cursor:'pointer'}} value={form.recognition_type} onChange={e=>setForm(p=>({...p,recognition_type:e.target.value}))}>{REC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{marginBottom:'10px'}}><div style={lbl2}>Badge</div><div style={{display:'flex',gap:'6px'}}>{REC_EMOJIS.map(e=><button key={e} onClick={()=>setForm(p=>({...p,badge_emoji:e}))} style={{width:'34px',height:'34px',fontSize:'16px',border:`2px solid ${form.badge_emoji===e?'var(--accent)':'var(--border)'}`,borderRadius:'var(--radius-sm)',cursor:'pointer',background:form.badge_emoji===e?'var(--accent-bg)':'transparent'}}>{e}</button>)}</div></div>
          <div style={{marginBottom:'12px'}}><div style={lbl2}>Message *</div><textarea style={{...inp2,minHeight:'60px',resize:'vertical',lineHeight:1.5}} value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'} placeholder="What did they do great..."/></div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 16px',height:'38px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:(!form.employee_id||!form.message.trim()||saving)?0.6:1}} onClick={submit} disabled={!form.employee_id||!form.message.trim()||saving}>{saving?'SENDING...':'SEND'}</button>
            <button style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'38px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}} onClick={()=>setShowNew(false)}>CANCEL</button>
          </div>
        </div>
      )}
      {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>
        : recs.length===0 ? <div style={{textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'13px'}}>No recognitions yet.</div>
        : recs.map(r => {
          const color = TYPE_COLORS[r.recognition_type]||'var(--accent)'
          return (
            <div key={r.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                <span style={{fontSize:'20px'}}>{r.badge_emoji||'⭐'}</span>
                <div style={{flex:1}}><div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{empMap[r.employee_id]||'—'}</div><span style={{fontSize:'10px',fontWeight:700,fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',color,background:`${color}18`,padding:'1px 7px',borderRadius:'10px'}}>{r.recognition_type}</span></div>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
              </div>
              <div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.6}}>{r.message}</div>
              {r.given_by && <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'6px'}}>Given by {empMap[r.given_by]||'Admin'}</div>}
            </div>
          )
        })
      }
    </div>
  )
}

// ── Company Docs Tab ──────────────────────────────────────────────────────────

function CompanyDocsTab({ profile, companyId, canEdit }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [ackStatus, setAckStatus] = useState({}) // docId -> { total, acked }

  useEffect(() => { loadDocs() }, [companyId])

  async function loadDocs() {
    setLoading(true)
    const { data } = await supabase.from('hr_document').select('*').eq('company_id', companyId).eq('is_active', true).order('created_at', { ascending: false })
    setDocs(data || [])
    if (canEdit && data?.length) {
      const { data: acks } = await supabase.from('hr_document_acknowledgment').select('document_id,status').eq('company_id', companyId)
      const counts = {}
      for (const a of (acks||[])) {
        if (!counts[a.document_id]) counts[a.document_id] = { total: 0, acked: 0 }
        counts[a.document_id].total++
        if (a.status !== 'pending') counts[a.document_id].acked++
      }
      setAckStatus(counts)
    }
    setLoading(false)
  }

  async function acknowledge(doc) {
    const { data: emp } = await supabase.from('employee').select('id').eq('email', profile.email || '').eq('company_id', companyId).maybeSingle()
    if (!emp?.id) return
    await supabase.from('hr_document_acknowledgment').upsert({
      document_id: doc.id,
      employee_id: emp.id,
      company_id: companyId,
      acknowledged_at: new Date().toISOString(),
      status: 'acknowledged',
    }, { onConflict: 'document_id,employee_id' })
    loadDocs()
  }

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'13px'}}>Loading...</div>

  return (
    <div>
      {canEdit && (
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'16px'}}>
          <button onClick={() => setShowUpload(true)} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 18px',height:'40px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>
            <Icon name="upload" size={14}/>UPLOAD DOCUMENT
          </button>
        </div>
      )}

      {docs.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:'13px'}}>No company documents yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {docs.map(doc => {
            const acks = ackStatus[doc.id] || { total: 0, acked: 0 }
            return (
              <div key={doc.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)'}}>{doc.title}</div>
                  {doc.description && <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{doc.description}</div>}
                  <div style={{display:'flex',gap:'8px',marginTop:'6px',flexWrap:'wrap'}}>
                    <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:'var(--accent-bg)',color:'var(--accent)',fontFamily:'var(--font-condensed)'}}>{doc.doc_type?.toUpperCase()}</span>
                    {doc.requires_signature && <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:'var(--color-danger-bg)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)'}}>SIGNATURE REQUIRED</span>}
                    {canEdit && <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{acks.acked}/{acks.total} acknowledged</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                  {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',textDecoration:'none'}}><Icon name="external-link" size={13}/>VIEW</a>}
                  {!canEdit && <button onClick={() => acknowledge(doc)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-sm)',color:'var(--color-success)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}><Icon name="check" size={13}/>ACKNOWLEDGE</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showUpload && <DocUploadModal companyId={companyId} profile={profile} onClose={() => setShowUpload(false)} onSaved={() => { setShowUpload(false); loadDocs() }}/>}
    </div>
  )
}

function DocUploadModal({ companyId, profile, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', doc_type: 'acknowledgment', requires_signature: false })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (!form.title.trim()) { setError('Title required.'); return }
    setSaving(true); setError(null)
    let fileUrl = null
    if (file) {
      const path = `${companyId}/${Date.now()}-${file.name}`
      const { data: upData, error: upErr } = await supabase.storage.from('hr-documents').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { setError(upErr.message); setSaving(false); return }
      fileUrl = supabase.storage.from('hr-documents').getPublicUrl(upData.path).data.publicUrl
    }
    const { error: insErr } = await supabase.from('hr_document').insert({
      company_id: companyId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      doc_type: form.doc_type,
      requires_signature: form.requires_signature,
      file_url: fileUrl,
      is_active: true,
      created_by: profile.id,
    })
    if (insErr) { setError(insErr.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:400,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'28px',width:'100%',maxWidth:'480px',boxShadow:'var(--shadow-modal)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'1.5px',color:'var(--text-primary)'}}>UPLOAD DOCUMENT</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}}><Icon name="x" size={18}/></button>
        </div>
        {error && <div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-sm)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)',marginBottom:'14px'}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'5px'}}>Title *</div><input style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'9px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'var(--font-body)'}} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Employee Handbook 2026"/></div>
          <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'5px'}}>Description</div><textarea style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'9px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'var(--font-body)',resize:'vertical',minHeight:'60px'}} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
          <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'5px'}}>Type</div><select style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'9px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',fontFamily:'var(--font-body)',cursor:'pointer'}} value={form.doc_type} onChange={e=>setForm(p=>({...p,doc_type:e.target.value}))}><option value="acknowledgment">Acknowledgment</option><option value="signature">Requires Signature</option><option value="informational">Informational</option></select></div>
          <label style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}><input type="checkbox" checked={form.requires_signature} onChange={e=>setForm(p=>({...p,requires_signature:e.target.checked}))} style={{accentColor:'var(--accent)',width:'16px',height:'16px'}}/>Requires employee signature</label>
          <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'5px'}}>File (PDF, DOC...)</div><input type="file" accept=".pdf,.doc,.docx" onChange={e=>setFile(e.target.files?.[0]||null)} style={{fontSize:'13px',color:'var(--text-primary)'}}/></div>
        </div>
        <div style={{display:'flex',gap:'10px',marginTop:'24px'}}>
          <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
          <button onClick={save} disabled={saving} style={{flex:2,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-sm)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:saving?0.6:1}}>{saving?'UPLOADING...':'UPLOAD'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Policy Management Tab ─────────────────────────────────────────────────────

const POLICY_CATEGORIES = ['Use of Force','Conduct','Emergency','Firearms','Uniforms','General','Compliance']

function PolicyManagementTab({ companyId }) {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [summarizing, setSummarizing] = useState(null)
  const [error, setError]       = useState(null)
  const [form, setForm] = useState({ title:'', category:'General', content:'', file_url:'' })

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('company_policy').select('*').eq('company_id', companyId).order('category')
    setPolicies(data||[])
    setLoading(false)
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const { error: err } = await supabase.from('company_policy').insert({ company_id:companyId, title:form.title.trim(), category:form.category, content:form.content.trim()||null, file_url:form.file_url.trim()||null, updated_at:new Date().toISOString() })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAdd(false); setForm({ title:'', category:'General', content:'', file_url:'' }); load()
  }

  async function summarize(policy) {
    if (!policy.content) return
    setSummarizing(policy.id)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role:'user', content:`Summarize this company policy in 2-3 sentences:\n\n${policy.content}` }], model:'claude-sonnet-4-6' }
      })
      if (fnErr) throw new Error(fnErr.message)
      const summary = data?.content?.[0]?.text || data?.text || ''
      await supabase.from('company_policy').update({ ai_summary:summary }).eq('id', policy.id)
      load()
    } catch(e) {
      setError(`AI summary failed: ${e.message}`)
    }
    setSummarizing(null)
  }

  async function del(id) {
    if (!window.confirm('Delete this policy?')) return
    await supabase.from('company_policy').delete().eq('id', id)
    load()
  }

  const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  const grouped = POLICY_CATEGORIES.map(cat => ({ cat, items: policies.filter(p=>p.category===cat) })).filter(g=>g.items.length>0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{policies.length} polic{policies.length!==1?'ies':'y'} on file</div>
        <button onClick={()=>setShowAdd(true)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}>
          <Icon name="plus" size={13}/>ADD POLICY
        </button>
      </div>

      {error && <div style={{ padding:'8px 12px', borderRadius:'var(--radius-sm)', marginBottom:'12px', fontSize:'12px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)' }}>{error}</div>}

      {showAdd && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'16px', marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div><div style={lbl}>Title *</div><input style={inp} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Use of Force Policy"/></div>
            <div><div style={lbl}>Category</div><select style={{...inp,cursor:'pointer'}} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{POLICY_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div style={{gridColumn:'1/-1'}}><div style={lbl}>Content / Full Text (optional)</div><textarea style={{...inp,minHeight:'80px',resize:'vertical',lineHeight:1.5}} value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))}/></div>
            <div style={{gridColumn:'1/-1'}}><div style={lbl}>File URL (optional)</div><input style={inp} value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} placeholder="https://..."/></div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={save} disabled={saving} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', opacity:saving?0.6:1 }}><Icon name="save" size={13}/>{saving?'SAVING...':'SAVE'}</button>
            <button onClick={()=>setShowAdd(false)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', cursor:'pointer' }}>CANCEL</button>
          </div>
        </div>
      )}

      {policies.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-muted)', fontSize:'13px' }}>No policies on file. Add your first policy above.</div>
      ) : (
        grouped.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'8px', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>{cat}</div>
            {items.map(policy => (
              <div key={policy.id} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px', marginBottom:'6px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'4px' }}>{policy.title}</div>
                    {policy.ai_summary && <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:'4px' }}>{policy.ai_summary}</div>}
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>Updated {policy.updated_at ? new Date(policy.updated_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</div>
                    {policy.file_url && <a href={policy.file_url} target="_blank" rel="noreferrer" style={{ fontSize:'11px', color:'var(--accent)', display:'inline-flex', alignItems:'center', gap:'4px', marginTop:'4px' }}><Icon name="download" size={11}/>View Document</a>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    {policy.content && (
                      <button onClick={()=>summarize(policy)} disabled={!!summarizing} style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'var(--accent-bg)', color:'var(--accent)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-sm)', padding:'0 10px', height:'30px', fontFamily:'var(--font-condensed)', fontSize:'11px', cursor:'pointer', opacity:summarizing===policy.id?0.6:1 }}>
                        <Icon name="zap" size={11}/>{summarizing===policy.id?'THINKING...':'AI SUMMARY'}
                      </button>
                    )}
                    <button onClick={()=>del(policy.id)} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }}><Icon name="trash-2" size={13}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
