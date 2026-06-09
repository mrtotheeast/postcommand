import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import EmployeeProfile from './EmployeeProfile'
import { useToast } from '../../components/ui/Toast'

const ROLE_COLORS = {
  super_admin:{bg:'rgba(201,162,39,0.15)',color:'#c9a227'},chief:{bg:'rgba(201,162,39,0.15)',color:'#c9a227'},
  lieutenant:{bg:'rgba(91,159,224,0.15)',color:'#5b9fe0'},sergeant:{bg:'rgba(91,159,224,0.12)',color:'#4a8ec0'},
  corporal:{bg:'rgba(58,170,106,0.12)',color:'#3aaa6a'},officer:{bg:'rgba(58,170,106,0.12)',color:'#3aaa6a'},
  hr:{bg:'rgba(160,122,224,0.15)',color:'#a07ae0'},accounting:{bg:'rgba(160,122,224,0.15)',color:'#a07ae0'},
  office_staff:{bg:'rgba(130,130,130,0.15)',color:'#8899aa'},client:{bg:'rgba(232,148,58,0.15)',color:'#e8943a'},
}
const STATUS_COLORS = {
  active:{bg:'rgba(58,170,106,0.12)',color:'#3aaa6a'},inactive:{bg:'rgba(130,130,130,0.12)',color:'#8899aa'},
  terminated:{bg:'rgba(224,85,85,0.12)',color:'#e05555'},probation:{bg:'rgba(232,148,58,0.12)',color:'#e8943a'},
  suspended:{bg:'rgba(224,85,85,0.12)',color:'#e05555'},on_leave:{bg:'rgba(91,159,224,0.12)',color:'#5b9fe0'},
}

function friendlyError(err) {
  const msg = err?.message || ''
  if (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('already exists')) {
    if (msg.includes('email')) return 'An employee with this email already exists.'
    if (msg.includes('employee_id_number')) return 'An employee with this ID number already exists.'
    return 'This record already exists.'
  }
  if (msg.includes('permission denied') || msg.includes('not authorized')) return 'You do not have permission to perform this action.'
  if (msg.includes('violates not-null') || msg.includes('null value')) return 'Please fill in all required fields.'
  if (msg.includes('network') || msg.includes('fetch')) return 'Connection error. Please check your internet and try again.'
  return 'Something went wrong. Please try again.'
}

export default function Personnel() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected]     = useState(null)
  const [view, setView]             = useState('grid')
  const [showImport, setShowImport] = useState(false)
  const [bulkSelected, setBulkSelected] = useState(new Set())
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkActing, setBulkActing] = useState(false)
  const [mainView, setMainView]     = useState('directory') // 'directory' | 'photo_approvals'
  const [showAdd, setShowAdd]       = useState(false)
  const [tileFilter, setTileFilter] = useState(null)
  const [profileTab, setProfileTab] = useState('overview')
  const [statusModal, setStatusModal] = useState(null)   // emp object or null
  const [statusTab, setStatusTab]     = useState('active') // active|suspended|terminated|archived
  const canViewSensitive = atLeast(profile?.role, 'lieutenant')
  const canEdit = atLeast(profile?.role, 'lieutenant')

  useEffect(() => { loadEmployees() }, [profile])

  async function loadEmployees() {
    if (!profile?.company_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('employee')
      .select('id,company_id,first_name,middle_name,last_name,email,phone_number,role,status,employment_type,employment_classification,position_title,pay_rate,hire_date,is_armed,has_app_access,profile_photo_url,employee_id_number,invitation_status,terminated_date,probation_end_date,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,notes')
      .eq('company_id', profile.company_id)
      .order('last_name', { ascending: true })
    if (error) setError(friendlyError(error))
    else setEmployees(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => employees.filter(e => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()) || e.employee_id_number?.toLowerCase().includes(search.toLowerCase()) || e.position_title?.toLowerCase().includes(search.toLowerCase())
    const matchTile = !tileFilter || tileFilter === 'total' ||
      (tileFilter === 'unarmed' && !e.is_armed) ||
      (tileFilter === 'armed' && e.is_armed) ||
      (tileFilter === 'appAccess' && e.has_app_access) ||
      (tileFilter === 'pendingInvite' && e.invitation_status === 'sent' && !e.has_app_access)
    // Status tab filter: active tab hides suspended/terminated/archived unless explicitly shown
    const matchStatusTab = statusTab === 'active'
      ? (e.status === 'active' || e.status === 'inactive' || e.status === 'probation')
      : e.status === statusTab
    return matchSearch && matchTile && matchStatusTab && (filterRole==='all'||e.role===filterRole) && (filterStatus==='all'||e.status===filterStatus)
  }), [employees, search, filterRole, filterStatus, tileFilter, statusTab])

  const stats = useMemo(() => ({
    total: employees.length,
    unarmed: employees.filter(e => !e.is_armed).length,
    armed: employees.filter(e => e.is_armed).length,
    appAccess: employees.filter(e => e.has_app_access).length,
    pendingInvite: employees.filter(e => e.invitation_status === 'sent' && !e.has_app_access).length,
  }), [employees])

  function initials(e) { return `${e.first_name?.[0]??''}${e.last_name?.[0]??''}`.toUpperCase() }

  if (loading) return <div style={{padding:'24px'}}>{[...Array(6)].map((_,i)=><div key={i} style={{height:'130px',borderRadius:'10px',marginBottom:'12px'}} className="skeleton"/>)}</div>
  if (error) return <div style={{padding:'40px',textAlign:'center',color:'var(--color-danger)'}}>{error} <button onClick={loadEmployees}>Retry</button></div>

  return (
    <div style={{padding:'24px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>PERSONNEL</h2>
          <p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>{employees.length} total employees</p>
          {canEdit && (
            <div style={{display:'flex',gap:'2px',marginTop:'10px'}}>
              {[['directory','Directory'],['photo_approvals','Photo Approvals']].map(([v,l])=>(
                <button key={v} onClick={()=>setMainView(v)} style={{padding:'6px 14px',fontSize:'12px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',borderBottom:`2px solid ${mainView===v?'var(--accent)':'transparent'}`,color:mainView===v?'var(--accent)':'var(--text-muted)',transition:'all 150ms ease',fontWeight:mainView===v?700:400}}>{l}</button>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {bulkMode && bulkSelected.size > 0 && (
              <BulkActionBar
                count={bulkSelected.size}
                companyId={profile.company_id}
                selectedIds={[...bulkSelected]}
                onDone={() => { setBulkSelected(new Set()); setBulkMode(false); loadEmployees() }}
                onCancel={() => { setBulkSelected(new Set()); setBulkMode(false) }}
              />
            )}
            <button style={{display:'flex',alignItems:'center',gap:'8px',background:bulkMode?'var(--accent-bg)':'var(--bg-card)',color:bulkMode?'var(--accent)':'var(--text-secondary)',border:`1px solid ${bulkMode?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'0 16px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',letterSpacing:'1px',cursor:'pointer'}} onClick={() => { setBulkMode(m=>!m); setBulkSelected(new Set()) }}>
              <Icon name="check-square" size={15}/>{bulkMode ? 'EXIT BULK' : 'BULK SELECT'}
            </button>
            <button style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--bg-card)',color:'var(--text-secondary)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'0 16px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',letterSpacing:'1px',cursor:'pointer'}} onClick={() => setShowImport(true)}><Icon name="upload" size={15}/>IMPORT CSV</button>
            <button onClick={() => setShowAdd(true)} style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-md)',padding:'0 20px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={16}/>ADD EMPLOYEE</button>
          </div>
        )}
      </div>

      {/* Status filter tabs */}
      <div style={{display:'flex',gap:'2px',marginBottom:'16px',borderBottom:'1px solid var(--border)',paddingBottom:0}}>
        {[['active','Active'],['suspended','Suspended'],['on_leave','On Leave'],['terminated','Terminated'],['archived','Archived']].map(([v,l])=>(
          <button key={v} onClick={()=>setStatusTab(v)} style={{padding:'8px 16px',fontSize:'12px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',borderBottom:`2px solid ${statusTab===v?'var(--accent)':'transparent'}`,color:statusTab===v?'var(--accent)':'var(--text-muted)',transition:'all 150ms ease',fontWeight:statusTab===v?700:400,marginBottom:'-1px'}}>
            {l}
            <span style={{marginLeft:'6px',fontSize:'11px',background:statusTab===v?'var(--accent-bg)':'var(--border)',color:statusTab===v?'var(--accent)':'var(--text-muted)',padding:'1px 6px',borderRadius:'10px'}}>
              {employees.filter(e=>e.status===(v==='archived'?'archived':v)).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'10px',marginBottom:'20px'}}>
        {[
          {key:'total',label:'Total Employees',value:stats.total},
          {key:'unarmed',label:'Unarmed',value:stats.unarmed},
          {key:'armed',label:'Armed',value:stats.armed},
          {key:'appAccess',label:'App Access',value:stats.appAccess},
          {key:'pendingInvite',label:'Pending Invite',value:stats.pendingInvite},
        ].map(t=>(
          <button key={t.key} onClick={()=>setTileFilter(tileFilter===t.key?null:t.key)}
            style={{background:'var(--bg-card)',border:`1px solid ${tileFilter===t.key?'var(--accent)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'14px 16px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',outline:'none',width:'100%'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>{t.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'26px',letterSpacing:'1px',color:tileFilter===t.key?'var(--accent)':'var(--text-primary)',lineHeight:1}}>{t.value}</div>
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:'200px'}}>
          <Icon name="search" size={16} color="var(--text-muted)" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
          <input type="search" placeholder="Search name, email, ID, position..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'10px 12px 10px 38px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',height:'44px'}}
            onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
        </div>
        <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} style={{padding:'0 12px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',height:'44px',cursor:'pointer',minWidth:'140px'}}>
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).filter(([k])=>k!=='client').map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:'0 12px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',height:'44px',cursor:'pointer',minWidth:'130px'}}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="probation">Probation</option>
          <option value="suspended">Suspended</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>
        <div style={{display:'flex',gap:'4px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'4px'}}>
          {['grid','list'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{width:'36px',height:'36px',border:'none',borderRadius:'6px',background:view===v?'var(--accent-bg)':'transparent',color:view===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name={v==='grid'?'grid':'menu'} size={15}/>
            </button>
          ))}
        </div>
      </div>

      {mainView==='photo_approvals' && <PhotoApprovalsTab companyId={profile.company_id} />}
      {mainView==='directory' && (
      <>
      {(search||filterRole!=='all'||filterStatus!=='all') && <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'12px'}}>Showing {filtered.length} of {employees.length}</div>}

      {filtered.length===0 && (
        <div style={{textAlign:'center',padding:'60px 24px',color:'var(--text-muted)'}}>
          <Icon name="users" size={40} color="var(--border-subtle)"/>
          <div style={{marginTop:'16px',fontSize:'15px'}}>No employees found</div>
        </div>
      )}

      {view==='grid' && filtered.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
          {filtered.map(emp=>(
            <div key={emp.id} style={{position:'relative'}}>
              {bulkMode && (
                <div style={{position:'absolute',top:'10px',left:'10px',zIndex:2}} onClick={e=>e.stopPropagation()}>
                  <input type="checkbox" checked={bulkSelected.has(emp.id)} onChange={()=>{ setBulkSelected(prev=>{ const n=new Set(prev); n.has(emp.id)?n.delete(emp.id):n.add(emp.id); return n }) }} style={{width:'18px',height:'18px',accentColor:'var(--accent)',cursor:'pointer'}}/>
                </div>
              )}
              <EmpCard emp={emp} ini={initials(emp)} canViewSensitive={canViewSensitive} onStatusAction={canEdit?(emp)=>setStatusModal(emp):null} onClick={()=>bulkMode ? setBulkSelected(prev=>{ const n=new Set(prev); n.has(emp.id)?n.delete(emp.id):n.add(emp.id); return n }) : setSelected(emp)} selected={bulkMode && bulkSelected.has(emp.id)}/>
            </div>
          ))}
        </div>
      )}

      {view==='list' && filtered.length>0 && (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 80px',padding:'10px 16px',borderBottom:'1px solid var(--border)',fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>
            <span>Name</span><span>Position</span><span>Role</span><span>Status</span><span></span>
          </div>
          {filtered.map((emp,i)=><EmpRow key={emp.id} emp={emp} ini={initials(emp)} isLast={i===filtered.length-1} onClick={()=>setSelected(emp)}/>)}
        </div>
      )}

      {selected && <EmployeeProfile emp={selected} allEmployees={filtered} activeTab={profileTab} onTabChange={setProfileTab} onNavigate={setSelected} canViewSensitive={canViewSensitive} canEdit={canEdit} onClose={()=>setSelected(null)} onRefresh={loadEmployees} profile={profile}/>}
      {showAdd && <AddEmployeeModal companyId={profile.company_id} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);loadEmployees()}}/>}
      {showImport && <CSVImportModal companyId={profile.company_id} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); loadEmployees() }} />}
      {statusModal && <EmployeeStatusModal emp={statusModal} profile={profile} onClose={()=>setStatusModal(null)} onDone={()=>{setStatusModal(null);loadEmployees()}}/>}
      </>
      )}
    </div>
  )
}

// ── CSV Import Modal ──────────────────────────────────────────────────────────

const CSV_FIELDS = ['first_name','last_name','email','phone_number','role','position_title','status','employment_type']
const VALID_ROLES = ['officer','corporal','sergeant','lieutenant','chief','hr','accounting','office_staff','client']

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { error:'File must have a header row and at least one data row.' }
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''))
    const row = {}
    headers.forEach((h,j) => { row[h] = vals[j] || '' })
    rows.push(row)
  }
  return { headers, rows }
}

function CSVImportModal({ companyId, onClose, onImported }) {
  const fileRef   = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError]     = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult]   = useState(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result)
      if (parsed.error) { setError(parsed.error); setPreview(null); return }
      setError(null)
      setPreview(parsed)
    }
    reader.readAsText(file)
  }

  async function doImport() {
    if (!preview?.rows?.length) return
    setImporting(true)
    let success = 0, failed = 0
    for (const row of preview.rows) {
      if (!row.first_name || !row.last_name) { failed++; continue }
      const role = VALID_ROLES.includes(row.role) ? row.role : 'officer'
      const { error } = await supabase.from('employee').insert({
        company_id: companyId,
        first_name: row.first_name,
        last_name:  row.last_name,
        email:      row.email || null,
        phone_number: row.phone_number || null,
        role,
        position_title: row.position_title || null,
        status:     ['active','inactive','terminated','probation'].includes(row.status) ? row.status : 'active',
        employment_type: ['full_time','part_time','contract'].includes(row.employment_type) ? row.employment_type : 'full_time',
        has_app_access: false,
        invitation_status: 'pending',
      })
      if (error) failed++; else success++
    }
    setImporting(false)
    setResult({ success, failed })
  }

  const ov  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' }
  const mod = { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'700px', boxShadow:'var(--shadow-modal)', flexShrink:0 }
  const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)' }
  const btn = { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' }
  const gho = { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' }

  return (
    <div style={ov} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={mod}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)' }}>IMPORT EMPLOYEES</div>
          <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>

        {result ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <Icon name="check-circle" size={40} color="var(--color-success)" />
            <div style={{ fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--text-primary)', margin:'12px 0 6px' }}>IMPORT COMPLETE</div>
            <div style={{ fontSize:'14px', color:'var(--text-secondary)' }}>{result.success} employees imported{result.failed > 0 ? `, ${result.failed} skipped (missing name)` : ''}.</div>
            <button style={{ ...btn, marginTop:'24px' }} onClick={onImported}>DONE</button>
          </div>
        ) : (
          <>
            <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', padding:'14px 16px', marginBottom:'18px', fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6 }}>
              CSV must have a header row. Recognized columns: <strong style={{ color:'var(--text-secondary)' }}>{CSV_FIELDS.join(', ')}</strong>. First/last name required. Role must be one of: {VALID_ROLES.join(', ')}.
            </div>

            <div style={{ marginBottom:'16px' }}>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display:'none' }} />
              <button style={{ ...gho, width:'100%', justifyContent:'center', borderStyle:'dashed' }} onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={15} />CHOOSE CSV FILE
              </button>
            </div>

            {error && <div style={{ fontSize:'13px', color:'var(--color-danger)', marginBottom:'14px', padding:'10px 12px', background:'var(--color-danger-bg)', borderRadius:'var(--radius-sm)' }}>{error}</div>}

            {preview && (
              <>
                <div style={{ fontSize:'12px', color:'var(--color-success)', marginBottom:'12px' }}>
                  {preview.rows.length} rows parsed · Columns: {preview.headers.join(', ')}
                </div>
                <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'auto', maxHeight:'260px', marginBottom:'18px' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr>{preview.headers.slice(0,7).map(h => <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'var(--font-condensed)', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0,10).map((row,i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                          {preview.headers.slice(0,7).map(h => <td key={h} style={{ padding:'7px 10px', color: (h==='first_name'||h==='last_name')&&!row[h] ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{row[h]||<span style={{color:'var(--text-muted)'}}>—</span>}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rows.length > 10 && <div style={{ padding:'8px 12px', fontSize:'11px', color:'var(--text-muted)', borderTop:'1px solid var(--border)' }}>+{preview.rows.length-10} more rows</div>}
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button style={{ ...btn, opacity:importing?0.6:1 }} onClick={doImport} disabled={importing}>
                    <Icon name="upload" size={14} />{importing ? `IMPORTING...` : `IMPORT ${preview.rows.length} EMPLOYEES`}
                  </button>
                  <button style={gho} onClick={onClose}>CANCEL</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmpCard({emp,ini,canViewSensitive,onClick,onStatusAction}) {
  const rc=ROLE_COLORS[emp.role]||ROLE_COLORS.officer
  const sc=STATUS_COLORS[emp.status]||STATUS_COLORS.inactive
  const [hover,setHover]=useState(false)
  return (
    <div style={{position:'relative',background:'var(--bg-card)',border:`1px solid ${hover?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'18px',transition:'all 150ms ease',display:'flex',flexDirection:'column',gap:'10px',minHeight:'160px',cursor:'pointer'}}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onClick={onClick}>
      {onStatusAction && (
        <button onClick={e=>{e.stopPropagation();onStatusAction(emp)}} style={{position:'absolute',top:'12px',right:'12px',background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',borderRadius:'var(--radius-sm)',fontSize:'16px',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',width:'28px',height:'28px'}} title="Status actions">
          ⋯
        </button>
      )}
      <div style={{display:'flex',alignItems:'center',gap:'12px',paddingRight:onStatusAction?'24px':0}}>
        <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-condensed)',fontSize:'15px',fontWeight:700,color:'var(--text-inverse)',flexShrink:0,overflow:'hidden'}}>
          {emp.profile_photo_url?<img src={emp.profile_photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:ini}
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{emp.first_name} {emp.last_name}</div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{emp.position_title||'—'}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
        <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:rc.bg,color:rc.color}}>{ROLE_LABELS[emp.role]??emp.role}</span>
        <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:sc.bg,color:sc.color}}>{emp.status??'Unknown'}</span>
        {emp.is_armed&&<span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>Armed</span>}
        {emp.has_app_access || emp.invitation_status==='accepted'
          ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-success-bg)',color:'var(--color-success)'}}>APP ACCESS</span>
          : emp.invitation_status==='sent'
            ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-warning-bg)',color:'var(--color-warning)'}}>INVITED</span>
            : emp.invitation_status==='expired'
              ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-danger-bg)',color:'var(--color-danger)'}}>EXPIRED</span>
              : <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--border)',color:'var(--text-muted)'}}>NOT INVITED</span>
        }
      </div>
      {canViewSensitive&&emp.email&&<div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'auto'}}>{emp.email}</div>}
    </div>
  )
}

function EmpRow({emp,ini,isLast,onClick}) {
  const rc=ROLE_COLORS[emp.role]||ROLE_COLORS.officer
  const sc=STATUS_COLORS[emp.status]||STATUS_COLORS.inactive
  const [hover,setHover]=useState(false)
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'grid',gridTemplateColumns:'2fr 1.5fr 1fr 1fr 80px',padding:'12px 16px',borderBottom:isLast?'none':'1px solid var(--border)',background:hover?'var(--bg-card-hover)':'transparent',border:'none',width:'100%',cursor:'pointer',textAlign:'left',alignItems:'center',gap:'8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,color:'var(--text-inverse)',flexShrink:0}}>{ini}</div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{emp.first_name} {emp.last_name}</div>
          {emp.employee_id_number&&<div style={{fontSize:'11px',color:'var(--text-muted)'}}>#{emp.employee_id_number}</div>}
        </div>
      </div>
      <div style={{fontSize:'13px',color:'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{emp.position_title||'—'}</div>
      <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:rc.bg,color:rc.color,display:'inline-block'}}>{ROLE_LABELS[emp.role]??emp.role}</span>
      <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:sc.bg,color:sc.color,display:'inline-block'}}>{emp.status??'—'}</span>
      <div style={{display:'flex',alignItems:'center',gap:'6px',justifyContent:'flex-end'}}>
        {emp.is_armed&&<Icon name="shield" size={14} color="var(--accent)"/>}
        {emp.has_app_access&&<Icon name="phone" size={14} color="var(--color-info)"/>}
        <Icon name="chevron-right" size={14} color="var(--text-muted)"/>
      </div>
    </button>
  )
}

function EmpDetail({emp,canViewSensitive,canEdit,onClose,onRefresh}) {
  const toast = useToast()
  const [editing,setEditing]  = useState(false)
  const [inviting,setInviting] = useState(false)
  const [inviteMsg,setInviteMsg] = useState(null)
  const rc=ROLE_COLORS[emp.role]||ROLE_COLORS.officer
  const sc=STATUS_COLORS[emp.status]||STATUS_COLORS.inactive
  const ini=`${emp.first_name?.[0]??''}${emp.last_name?.[0]??''}`.toUpperCase()
  const fmt=d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'
  const canInvite = canEdit && emp.email && emp.invitation_status !== 'accepted'

  async function sendInvite() {
    if (!emp.email) return
    setInviting(true); setInviteMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: emp.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://postcommand.app',
        data: { first_name: emp.first_name, last_name: emp.last_name, company_id: emp.company_id, employee_id: emp.id }
      }
    })
    if (!error) {
      await supabase.from('employee').update({ invitation_status: 'sent' }).eq('id', emp.id)
      onRefresh?.()
      setInviteMsg({ ok:true, text:`Invite sent to ${emp.email}.` })
      toast('Invite sent to ' + emp.email, 'info')
    } else {
      setInviteMsg({ ok:false, text: friendlyError(error) })
    }
    setInviting(false)
  }

  if (editing) return <EmpEditModal emp={emp} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);onRefresh?.();onClose()}} />

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(420px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:101,display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>EMPLOYEE PROFILE</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px',borderRadius:'var(--radius-sm)'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{padding:'24px 20px',borderBottom:'1px solid var(--border)',display:'flex',gap:'16px',alignItems:'center'}}>
          <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-condensed)',fontSize:'20px',fontWeight:700,color:'var(--text-inverse)',flexShrink:0,overflow:'hidden'}}>
            {emp.profile_photo_url?<img src={emp.profile_photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:ini}
          </div>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'22px',letterSpacing:'1px',color:'var(--text-primary)',lineHeight:1}}>{emp.first_name} {emp.middle_name?emp.middle_name+' ':''}{emp.last_name}</div>
            <div style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>{emp.position_title||'No position assigned'}</div>
            <div style={{display:'flex',gap:'6px',marginTop:'8px',flexWrap:'wrap'}}>
              <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:rc.bg,color:rc.color}}>{ROLE_LABELS[emp.role]??emp.role}</span>
              <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:sc.bg,color:sc.color}}>{emp.status}</span>
              {emp.is_armed&&<span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>Armed</span>}
            </div>
          </div>
        </div>
        <div style={{padding:'20px',flex:1}}>
          {inviteMsg && (
            <div style={{padding:'10px 14px',borderRadius:'var(--radius-sm)',marginBottom:'16px',fontSize:'12px',lineHeight:1.5,background:inviteMsg.ok?'var(--color-success-bg)':'var(--color-danger-bg)',color:inviteMsg.ok?'var(--color-success)':'var(--color-danger)',border:`1px solid ${inviteMsg.ok?'rgba(58,170,106,0.3)':'rgba(192,57,43,0.3)'}`}}>
              {inviteMsg.text}
            </div>
          )}
          <Sec title="Contact">
            {canViewSensitive&&emp.email&&<R label="Email" value={emp.email}/>}
            {canViewSensitive&&emp.phone_number&&<R label="Phone" value={emp.phone_number}/>}
          </Sec>
          <Sec title="Employment">
            {emp.employee_id_number&&<R label="Employee ID" value={emp.employee_id_number}/>}
            {emp.employment_type&&<R label="Type" value={emp.employment_type.replace('_',' ')}/>}
            {emp.hire_date&&<R label="Hire Date" value={fmt(emp.hire_date)}/>}
            {emp.probation_end_date&&<R label="Probation Ends" value={fmt(emp.probation_end_date)}/>}
            {emp.terminated_date&&<R label="Terminated" value={fmt(emp.terminated_date)} color="var(--color-danger)"/>}
          </Sec>
          <Sec title="Access">
            <R label="App Access" value={emp.has_app_access?'Active':'No access'} color={emp.has_app_access?'var(--color-success)':'var(--text-muted)'}/>
            {emp.invitation_status&&<R label="Invitation" value={emp.invitation_status.replace('_',' ')}/>}
            <R label="Armed Officer" value={emp.is_armed?'Yes':'No'} color={emp.is_armed?'var(--accent)':'var(--text-muted)'}/>
          </Sec>
          {canViewSensitive&&emp.emergency_contact_name&&(
            <Sec title="Emergency Contact">
              <R label="Name" value={emp.emergency_contact_name}/>
              {emp.emergency_contact_phone&&<R label="Phone" value={emp.emergency_contact_phone}/>}
              {emp.emergency_contact_relation&&<R label="Relation" value={emp.emergency_contact_relation}/>}
            </Sec>
          )}
          {emp.notes&&<Sec title="Notes"><div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.6}}>{emp.notes}</div></Sec>}
        </div>
        {canEdit&&(
          <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:'8px',flexWrap:'wrap',flexShrink:0}}>
            <button onClick={()=>setEditing(true)} style={{flex:1,height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="edit-2" size={15}/>EDIT</button>
            {canInvite&&<button onClick={sendInvite} disabled={inviting} style={{flex:1,height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',opacity:inviting?0.6:1}}><Icon name="mail" size={15}/>{inviting?'SENDING...':emp.invitation_status==='sent'?'RESEND INVITE':'INVITE'}</button>}
          </div>
        )}
      </div>
    </>
  )
}

function EmpEditModal({ emp, onClose, onSaved }) {
  const toast = useToast()
  const ROLES_LIST = ['officer','corporal','sergeant','lieutenant','chief','hr','accounting','office_staff']
  const STATUS_LIST = ['active','inactive','probation','suspended','terminated']
  const EMP_TYPES  = ['full_time','part_time','contract','1099']
  const [form, setForm] = useState({
    first_name: emp.first_name||'', last_name: emp.last_name||'', middle_name: emp.middle_name||'',
    email: emp.email||'', phone_number: emp.phone_number||'', position_title: emp.position_title||'',
    role: emp.role||'officer', status: emp.status||'active', employment_type: emp.employment_type||'full_time',
    is_armed: emp.is_armed||false, has_app_access: emp.has_app_access||false,
    hire_date: emp.hire_date||'', profile_photo_url: emp.profile_photo_url||'',
    notes: emp.notes||'', employee_id_number: emp.employee_id_number||'',
  })
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const photoInputRef = useRef(null)
  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  const inp  = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl  = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }
  const inpF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inpB = e => { e.target.style.borderColor='var(--border)' }

  async function uploadPhoto(file) {
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${emp.company_id}/${emp.id}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('employee-photos').upload(path, file, { upsert:true, contentType:file.type })
    if (!error && data) {
      const { data:{ publicUrl } } = supabase.storage.from('employee-photos').getPublicUrl(data.path)
      setF('profile_photo_url', publicUrl)
    }
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('employee').update({
      first_name:form.first_name.trim(), last_name:form.last_name.trim(),
      middle_name:form.middle_name.trim()||null, email:form.email.trim()||null,
      phone_number:form.phone_number.trim()||null, position_title:form.position_title.trim()||null,
      role:form.role, status:form.status, employment_type:form.employment_type,
      is_armed:form.is_armed, has_app_access:form.has_app_access,
      hire_date:form.hire_date||null, profile_photo_url:form.profile_photo_url.trim()||null,
      notes:form.notes.trim()||null, employee_id_number:form.employee_id_number.trim()||null,
    }).eq('id', emp.id)
    toast('Changes saved')
    setSaving(false); onSaved()
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(480px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:201,display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>EDIT EMPLOYEE</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',minHeight:'44px',minWidth:'44px',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{padding:'20px',flex:1,display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><div style={lbl}>First Name</div><input style={inp} value={form.first_name} onChange={e=>setF('first_name',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Last Name</div><input style={inp} value={form.last_name} onChange={e=>setF('last_name',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Email</div><input style={inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Phone</div><input style={inp} value={form.phone_number} onChange={e=>setF('phone_number',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Position Title</div><input style={inp} value={form.position_title} onChange={e=>setF('position_title',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Employee ID</div><input style={inp} value={form.employee_id_number} onChange={e=>setF('employee_id_number',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
            <div><div style={lbl}>Role</div><select style={{...inp,cursor:'pointer'}} value={form.role} onChange={e=>setF('role',e.target.value)}>{ROLES_LIST.map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
            <div><div style={lbl}>Status</div><select style={{...inp,cursor:'pointer'}} value={form.status} onChange={e=>setF('status',e.target.value)}>{STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><div style={lbl}>Employment Type</div><select style={{...inp,cursor:'pointer'}} value={form.employment_type} onChange={e=>setF('employment_type',e.target.value)}>{EMP_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><div style={lbl}>Hire Date</div><input style={inp} type="date" value={form.hire_date} onChange={e=>setF('hire_date',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
          </div>
          <div>
            <div style={lbl}>Profile Photo</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'60px', height:'60px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {form.profile_photo_url ? <img src={form.profile_photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>e.target.style.display='none'}/> : <Icon name="user" size={22} color="var(--accent)"/>}
              </div>
              <div style={{ flex:1 }}>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => uploadPhoto(e.target.files[0])}/>
                <button style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer', letterSpacing:'1px', opacity:uploading?0.6:1 }} onClick={()=>photoInputRef.current?.click()} disabled={uploading}>
                  <Icon name="upload" size={13}/>{uploading ? 'UPLOADING...' : 'UPLOAD PHOTO'}
                </button>
                {form.profile_photo_url && <div style={{ fontSize:'11px', color:'var(--color-success)', marginTop:'4px' }}>Photo set ✓</div>}
                <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>JPG, PNG, WebP · Max 5MB · Bucket: employee-photos</div>
              </div>
            </div>
          </div>
          <div><div style={lbl}>Notes</div><textarea style={{...inp,minHeight:'60px',resize:'vertical',lineHeight:1.5}} value={form.notes} onChange={e=>setF('notes',e.target.value)} onFocus={inpF} onBlur={inpB}/></div>
          <div style={{display:'flex',gap:'20px'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_armed} onChange={e=>setF('is_armed',e.target.checked)} style={{accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}}/>Armed Officer
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}>
              <input type="checkbox" checked={form.has_app_access} onChange={e=>setF('has_app_access',e.target.checked)} style={{accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}}/>App Access
            </label>
          </div>
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
          <button onClick={save} disabled={saving} style={{flex:1,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>{saving?'SAVING...':'SAVE CHANGES'}</button>
          <button onClick={onClose} style={{height:'44px',background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',cursor:'pointer',padding:'0 20px'}}>CANCEL</button>
        </div>
      </div>
    </>
  )
}

function Sec({title,children}) {
  return (
    <div style={{marginBottom:'20px'}}>
      <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div>
    </div>
  )
}

function R({label,value,color}) {
  if(!value) return null
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}>
      <span style={{color:'var(--text-muted)'}}>{label}</span>
      <span style={{color:color||'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'60%',wordBreak:'break-word'}}>{value}</span>
    </div>
  )
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────

function BulkActionBar({ count, companyId, selectedIds, onDone, onCancel }) {
  const toast = useToast()
  const [acting, setActing] = useState(false)
  const [inviting, setInviting] = useState(false)

  const btn = (v='accent') => ({ display:'inline-flex', alignItems:'center', gap:'6px', border:'none', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer',
    background: v==='accent'?'var(--accent)':v==='danger'?'var(--color-danger-bg)':v==='ghost'?'var(--bg-card)':'var(--color-info-bg)',
    color:       v==='accent'?'var(--text-inverse)':v==='danger'?'var(--color-danger)':v==='ghost'?'var(--text-secondary)':'var(--color-info)',
    border:      v==='ghost'?'1px solid var(--border)':v==='danger'?'1px solid rgba(192,57,43,0.3)':v==='info'?'1px solid rgba(91,159,224,0.3)':'none',
  })

  async function bulkUpdate(field, value) {
    setActing(true)
    await Promise.all(selectedIds.map(id => supabase.from('employee').update({ [field]: value }).eq('id', id)))
    setActing(false)
    toast('Updated ' + count + ' employees')
    onDone()
  }

  async function bulkInvite() {
    setInviting(true)
    const { data: emps } = await supabase.from('employee').select('id,first_name,last_name,email,role,company_id').in('id', selectedIds)
    for (const emp of (emps||[])) {
      if (!emp.email) continue
      const { error } = await supabase.auth.signInWithOtp({
        email: emp.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: 'https://postcommand.app',
          data: { first_name: emp.first_name, last_name: emp.last_name, company_id: emp.company_id, employee_id: emp.id }
        }
      })
      if (!error) {
        await supabase.from('employee').update({ invitation_status: 'sent' }).eq('id', emp.id)
      }
    }
    setInviting(false)
    toast('Invites sent', 'info')
    onDone()
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-md)', flexWrap:'wrap' }}>
      <span style={{ fontSize:'13px', color:'var(--accent)', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px', marginRight:'4px' }}>{count} selected</span>
      <button style={btn('info')} onClick={() => bulkUpdate('status','active')} disabled={acting}><Icon name="check" size={12}/>SET ACTIVE</button>
      <button style={btn('info')} onClick={() => bulkUpdate('status','inactive')} disabled={acting}><Icon name="minus-circle" size={12}/>SET INACTIVE</button>
      <button style={btn('accent')} onClick={bulkInvite} disabled={inviting}><Icon name="mail" size={12}/>{inviting?'INVITING...':'INVITE ALL'}</button>
      <button style={btn('danger')} onClick={() => { if(window.confirm(`Remove app access for ${count} employees?`)) bulkUpdate('has_app_access',false) }} disabled={acting}><Icon name="lock" size={12}/>REVOKE ACCESS</button>
      <button style={btn('ghost')} onClick={onCancel}>CANCEL</button>
    </div>
  )
}

// ── Photo Approvals Tab ───────────────────────────────────────────────────────

function PhotoApprovalsTab({ companyId }) {
  const [emps, setEmps]   = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(null)

  useEffect(() => { load() }, [companyId])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee')
      .select('id,first_name,last_name,role,profile_photo_url,profile_photo_status')
      .eq('company_id', companyId)
      .eq('profile_photo_status','pending')
    setEmps(data||[])
    setLoading(false)
  }
  async function decide(id, approve) {
    setActing(id)
    if (approve) {
      await supabase.from('employee').update({ profile_photo_status:'approved' }).eq('id',id)
    } else {
      await supabase.from('employee').update({ profile_photo_status:'rejected', profile_photo_url:null }).eq('id',id)
    }
    setActing(null); load()
  }

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>

  return (
    <div>
      <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>{emps.length} photo{emps.length!==1?'s':''} pending approval</div>
      {emps.length===0 ? (
        <div style={{textAlign:'center',padding:'48px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)'}}>
          <Icon name="check-circle" size={28} color="var(--color-success)"/>
          <div style={{marginTop:'10px',fontSize:'14px',color:'var(--color-success)',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>ALL CLEAR — No photos pending</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'12px'}}>
          {emps.map(emp=>(
            <div key={emp.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <img src={emp.profile_photo_url} alt="" style={{width:'56px',height:'56px',borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0}} onError={e=>e.target.style.opacity='0.3'}/>
                <div>
                  <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)'}}>{emp.first_name} {emp.last_name}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{ROLE_LABELS[emp.role]||emp.role}</div>
                  <span style={{fontSize:'10px',color:'var(--color-warning)',background:'var(--color-warning-bg)',padding:'1px 6px',borderRadius:'10px',fontFamily:'var(--font-condensed)',fontWeight:700,letterSpacing:'0.5px',marginTop:'4px',display:'inline-block'}}>PENDING</span>
                </div>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button style={{flex:1,height:'36px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-sm)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:acting===emp.id?0.6:1}} onClick={()=>decide(emp.id,true)} disabled={acting===emp.id}><Icon name="check" size={13}/>APPROVE</button>
                <button style={{flex:1,height:'36px',background:'var(--color-danger-bg)',border:'1px solid rgba(192,57,43,0.3)',borderRadius:'var(--radius-sm)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',opacity:acting===emp.id?0.6:1}} onClick={()=>decide(emp.id,false)} disabled={acting===emp.id}><Icon name="x" size={13}/>REJECT</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Employee Modal ────────────────────────────────────────────────────────

function AddEmployeeModal({ companyId, onClose, onSaved }) {
  const toast = useToast()
  const ROLES_LIST = ['officer','corporal','sergeant','lieutenant','chief','hr','accounting','office_staff']
  const [form, setForm] = useState({
    first_name:'', last_name:'', email:'', phone_number:'',
    role:'officer', position_title:'', status:'active',
    employment_type:'full_time', is_armed:false,
  })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState(null)
  const [success,setSuccess]  = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [savedEmp, setSavedEmp] = useState(null)

  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  const foc = e => { e.target.style.borderColor='var(--border-focus)' }
  const blr = e => { e.target.style.borderColor='var(--border)' }
  const inp = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' }
  const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }

  async function save() {
    // Validate required fields
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    if (!form.last_name.trim())  { setError('Last name is required.'); return }
    if (!form.email.trim())      { setError('Email is required.'); return }
    if (!form.role)              { setError('Role is required.'); return }
    if (!companyId)              { setError('Company ID missing — please refresh and try again.'); return }

    setSaving(true); setError(null)
    const { data, error: err } = await supabase.from('employee').insert({
      company_id:       companyId,
      first_name:       form.first_name.trim(),
      last_name:        form.last_name.trim(),
      email:            form.email.trim(),
      phone_number:     form.phone_number.trim() || null,
      role:             form.role,
      position_title:   form.position_title.trim() || null,
      status:           form.status,
      employment_type:  form.employment_type,
      is_armed:         form.is_armed,
      has_app_access:   false,
      invitation_status:'pending',
    }).select().single()

    setSaving(false)
    if (err) { setError(friendlyError(err)); return }
    setSavedEmp(data)
    setSuccess(true)
    toast('Employee added successfully')
    setTimeout(() => { onSaved() }, 2500)
  }

  async function sendInvite() {
    if (!savedEmp?.email) return
    setSendingInvite(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: savedEmp.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://postcommand.app',
        data: { first_name: savedEmp.first_name, last_name: savedEmp.last_name, company_id: companyId, employee_id: savedEmp.id }
      }
    })
    if (!error) {
      await supabase.from('employee').update({ invitation_status: 'sent' }).eq('id', savedEmp.id)
    }
    setSendingInvite(false)
  }

  const ov  = { position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:400,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'32px 16px',overflowY:'auto' }
  const mod = { background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'28px',width:'100%',maxWidth:'540px',boxShadow:'var(--shadow-modal)',flexShrink:0 }

  return (
    <div style={ov} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={mod}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'22px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'22px',letterSpacing:'1.5px',color:'var(--text-primary)'}}>ADD EMPLOYEE</div>
          <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>

        {success ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <Icon name="check-circle" size={40} color="var(--color-success)"/>
            <div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--text-primary)',margin:'12px 0 6px'}}>EMPLOYEE ADDED</div>
            <div style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'20px'}}>{savedEmp?.first_name} {savedEmp?.last_name} has been added successfully.</div>
            <button onClick={sendInvite} disabled={sendingInvite} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--color-info-bg)',color:'var(--color-info)',border:'1px solid rgba(91,159,224,0.3)',borderRadius:'var(--radius-sm)',padding:'0 20px',height:'42px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:sendingInvite?0.6:1}}>
              <Icon name="mail" size={14}/>{sendingInvite?'SENDING...':'INVITE TO APP'}
            </button>
          </div>
        ) : (
          <>
            {error && <div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(192,57,43,0.3)',borderRadius:'var(--radius-sm)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)',marginBottom:'16px'}}>{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div><div style={lbl}>First Name *</div><input style={inp} value={form.first_name} onChange={e=>setF('first_name',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Jane"/></div>
              <div><div style={lbl}>Last Name *</div><input style={inp} value={form.last_name} onChange={e=>setF('last_name',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Smith"/></div>
              <div><div style={lbl}>Email *</div><input style={inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)} onFocus={foc} onBlur={blr} placeholder="jane@company.com"/></div>
              <div><div style={lbl}>Phone</div><input style={inp} value={form.phone_number} onChange={e=>setF('phone_number',e.target.value)} onFocus={foc} onBlur={blr} placeholder="(555) 000-0000"/></div>
              <div><div style={lbl}>Role *</div><select style={{...inp,cursor:'pointer'}} value={form.role} onChange={e=>setF('role',e.target.value)} onFocus={foc} onBlur={blr}>{ROLES_LIST.map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
              <div><div style={lbl}>Position Title</div><input style={inp} value={form.position_title} onChange={e=>setF('position_title',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Security Officer"/></div>
              <div><div style={lbl}>Status</div><select style={{...inp,cursor:'pointer'}} value={form.status} onChange={e=>setF('status',e.target.value)}><option value="active">Active</option><option value="probation">Probation</option><option value="inactive">Inactive</option></select></div>
              <div><div style={lbl}>Employment Type</div><select style={{...inp,cursor:'pointer'}} value={form.employment_type} onChange={e=>setF('employment_type',e.target.value)}><option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contract">Contract</option></select></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',marginBottom:'20px'}}>
              <input type="checkbox" checked={form.is_armed} onChange={e=>setF('is_armed',e.target.checked)} style={{accentColor:'var(--accent)',width:'16px',height:'16px',cursor:'pointer'}}/>Armed Officer
            </label>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={save} disabled={saving} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 22px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:saving?0.6:1}}>
                <Icon name="user-plus" size={14}/>{saving?'SAVING...':'ADD EMPLOYEE'}
              </button>
              <button onClick={onClose} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 18px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'13px',letterSpacing:'1px',cursor:'pointer'}}>CANCEL</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Employee Status / Delete Modal ────────────────────────────────────────────

const STATUS_OPTIONS = [
  { id:'on_leave',   label:'Place on Leave',           description:'Employee is on approved leave. Status can be reversed when they return.',                               color:'var(--color-info,#5b9fe0)',icon:'🏖', requiresNote:true,  noteLabel:'Leave reason (type, notes)', reversible:true },
  { id:'suspended',  label:'Suspend Employee',          description:'Temporarily suspends access. Employee remains in the system and can be reinstated.',                   color:'var(--color-warning)',  icon:'⏸', requiresNote:true,  noteLabel:'Reason for suspension', reversible:true },
  { id:'terminated', label:'Terminate Employment',      description:'Ends employment. Employee record is retained for legal and payroll compliance.',                       color:'var(--color-danger)',   icon:'✕',  requiresNote:true,  noteLabel:'Reason for termination', reversible:false },
  { id:'archived',   label:'Archive Employee',          description:'Hides from active lists. Record is preserved and can be restored at any time.',                        color:'var(--text-muted)',     icon:'📁', requiresNote:false, reversible:true },
  { id:'deleted',    label:'Permanently Delete',        description:'IRREVERSIBLE. All data will be permanently deleted and cannot be recovered. This cannot be undone.',   color:'#dc2626',               icon:'🗑', requiresNote:true,  noteLabel:'Type DELETE to confirm', reversible:false, requiresConfirmText:'DELETE' },
]

function EmployeeStatusModal({ emp, profile, onClose, onDone }) {
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const opt = STATUS_OPTIONS.find(o => o.id === selected)

  const canConfirm = opt && (
    !opt.requiresNote || note.trim().length > 0
  ) && (
    !opt.requiresConfirmText || note.trim() === opt.requiresConfirmText
  )

  async function confirm() {
    if (!opt) return
    setSaving(true); setError(null)
    try {
      if (opt.id === 'deleted') {
        const { error: delErr } = await supabase.from('employee').delete().eq('id', emp.id)
        if (delErr) throw new Error(delErr.message)
      } else if (opt.id === 'on_leave') {
        const { error: updErr } = await supabase.from('employee')
          .update({ status: 'on_leave' })
          .eq('id', emp.id)
        if (updErr) throw new Error(updErr.message)
      } else {
        const { error: updErr } = await supabase.from('employee')
          .update({ status: opt.id, [`${opt.id}_reason`]: note||null, [`${opt.id}_at`]: new Date().toISOString() })
          .eq('id', emp.id)
        if (updErr) throw new Error(updErr.message)
      }
      // Log the change
      const { logChange } = await import('../../lib/changeLog.js')
      await logChange({
        companyId: emp.company_id, employeeId: emp.id,
        changedById: profile.id, changedByName: `${profile.first_name} ${profile.last_name}`, changedByRole: profile.role,
        fieldName: 'status', fieldLabel: 'Employment Status',
        oldValue: emp.status, newValue: opt.id,
        changeType: 'status_change', notes: note||null,
      })
      toast('Employee status updated', 'info')
      onDone()
    } catch(e) {
      setError(friendlyError(e))
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:500,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(520px,95vw)',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'28px',zIndex:501,boxShadow:'var(--shadow-modal)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>CHANGE STATUS</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'18px'}}>
          <strong style={{color:'var(--text-primary)'}}>{emp.first_name} {emp.last_name}</strong> · {emp.position_title||emp.role} · Current status: <strong>{emp.status}</strong>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'18px'}}>
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.id} onClick={()=>{setSelected(opt.id);setNote('')}}
              style={{textAlign:'left',padding:'14px 16px',borderRadius:'var(--radius-md)',border:`2px solid ${selected===opt.id?opt.color:'var(--border-subtle)'}`,background:selected===opt.id?`${opt.color}11`:'var(--bg-surface)',cursor:'pointer',transition:'all 150ms ease',display:'flex',alignItems:'flex-start',gap:'12px'}}>
              <span style={{fontSize:'18px',lineHeight:1,flexShrink:0,marginTop:'1px'}}>{opt.icon}</span>
              <div>
                <div style={{fontSize:'13px',fontWeight:700,color:selected===opt.id?opt.color:'var(--text-primary)',marginBottom:'3px'}}>{opt.label}</div>
                <div style={{fontSize:'12px',color:'var(--text-muted)',lineHeight:1.5}}>{opt.description}</div>
                {!opt.reversible && <div style={{fontSize:'11px',color:'var(--color-danger)',marginTop:'4px',fontWeight:600}}>⚠ NOT REVERSIBLE</div>}
              </div>
            </button>
          ))}
        </div>

        {opt?.requiresNote && (
          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>{opt.noteLabel}</div>
            {opt.requiresConfirmText
              ? <input value={note} onChange={e=>setNote(e.target.value)} placeholder={`Type ${opt.requiresConfirmText} to confirm`}
                  style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:`1px solid ${note===opt.requiresConfirmText?'var(--color-danger)':'var(--border)'}`,borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}/>
              : <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Required..." rows={2}
                  style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontSize:'13px',outline:'none',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',fontFamily:'var(--font-body)'}}/>
            }
          </div>
        )}

        {error && <div style={{padding:'8px 12px',borderRadius:'var(--radius-sm)',marginBottom:'12px',fontSize:'12px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)'}}>{error}</div>}

        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={confirm} disabled={!canConfirm||saving}
            style={{flex:1,height:'44px',background:opt?.color||'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:(!canConfirm||saving)?0.5:1}}>
            {saving?'SAVING...':opt?`CONFIRM: ${opt.label.toUpperCase()}`:'SELECT AN ACTION'}
          </button>
          <button onClick={onClose} style={{height:'44px',background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',cursor:'pointer',padding:'0 20px'}}>CANCEL</button>
        </div>
      </div>
    </>
  )
}
