import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const TABS = [
  { id:'overview',     label:'Overview',     icon:'user' },
  { id:'credentials',  label:'Credentials',  icon:'award' },
  { id:'training',     label:'Training',     icon:'book-open' },
  { id:'documents',    label:'Documents',    icon:'file-text' },
  { id:'pto',          label:'PTO',          icon:'calendar' },
  { id:'uniforms',     label:'Uniforms',     icon:'shield' },
  { id:'reviews',      label:'Reviews',      icon:'star' },
  { id:'notes',        label:'Notes',        icon:'message-square' },
]

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
  suspended:{bg:'rgba(224,85,85,0.12)',color:'#e05555'},
}

const fmt = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'

function InfoRow({label,value,color}) {
  if (!value && value !== 0) return null
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',fontSize:'13px',gap:'12px',paddingBottom:'8px',borderBottom:'1px solid var(--border)'}}>
      <span style={{color:'var(--text-muted)',flexShrink:0}}>{label}</span>
      <span style={{color:color||'var(--text-primary)',fontWeight:500,textAlign:'right',wordBreak:'break-word'}}>{value}</span>
    </div>
  )
}

function Section({title,children}) {
  return (
    <div style={{marginBottom:'24px'}}>
      <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'12px'}}>{title}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div>
    </div>
  )
}

function ComingSoonTab({name}) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 24px',color:'var(--text-muted)',textAlign:'center'}}>
      <Icon name="clock" size={36} color="var(--border-subtle)"/>
      <div style={{marginTop:'16px',fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-muted)'}}>{name.toUpperCase()}</div>
      <div style={{marginTop:'6px',fontSize:'12px'}}>Coming in a future sprint</div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({emp, canViewSensitive, canEdit, onRefresh, onEdit}) {
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)
  const rc = ROLE_COLORS[emp.role] || ROLE_COLORS.officer
  const sc = STATUS_COLORS[emp.status] || STATUS_COLORS.inactive
  const canInvite = canEdit && emp.email && !emp.has_app_access

  async function sendInvite() {
    setInviting(true); setInviteMsg(null)
    try {
      const tempPass = Math.random().toString(36).slice(2,10)+'Aa1!'
      const { data, error } = await supabase.auth.signUp({ email:emp.email, password:tempPass, options:{ data:{ first_name:emp.first_name, last_name:emp.last_name } } })
      if (error) throw error
      const userId = data?.user?.id
      if (userId) {
        await supabase.from('user_profile').upsert({ id:userId, first_name:emp.first_name, last_name:emp.last_name, email:emp.email, phone:emp.phone_number, role:emp.role, company_id:emp.company_id, company_slug:emp.company_slug||'' })
        await supabase.from('employee').update({ user_id:userId, has_app_access:true, invitation_status:'invited' }).eq('id',emp.id)
      }
      setInviteMsg({ ok:true, text:`Invite sent to ${emp.email}.` })
      onRefresh?.()
    } catch(e) {
      setInviteMsg({ ok:false, text: e.message.includes('already registered') ? 'This email already has an account.' : e.message })
    }
    setInviting(false)
  }

  return (
    <div style={{padding:'24px'}}>
      {inviteMsg && (
        <div style={{padding:'10px 14px',borderRadius:'var(--radius-sm)',marginBottom:'16px',fontSize:'12px',lineHeight:1.5,background:inviteMsg.ok?'var(--color-success-bg)':'var(--color-danger-bg)',color:inviteMsg.ok?'var(--color-success)':'var(--color-danger)',border:`1px solid ${inviteMsg.ok?'rgba(58,170,106,0.3)':'rgba(192,57,43,0.3)'}`}}>
          {inviteMsg.text}
        </div>
      )}
      <Section title="Contact">
        {canViewSensitive && <InfoRow label="Email" value={emp.email}/>}
        {canViewSensitive && <InfoRow label="Phone" value={emp.phone_number}/>}
        {!canViewSensitive && <div style={{fontSize:'12px',color:'var(--text-muted)',fontStyle:'italic'}}>Contact info restricted to Lieutenant+</div>}
      </Section>
      <Section title="Employment">
        <InfoRow label="Employee ID" value={emp.employee_id_number}/>
        <InfoRow label="Position" value={emp.position_title}/>
        <InfoRow label="Type" value={emp.employment_type?.replace(/_/g,' ')}/>
        <InfoRow label="Classification" value={emp.employment_classification?.replace(/_/g,' ')}/>
        <InfoRow label="Hire Date" value={fmt(emp.hire_date)}/>
        {emp.probation_end_date && <InfoRow label="Probation Ends" value={fmt(emp.probation_end_date)}/>}
        {emp.terminated_date && <InfoRow label="Terminated" value={fmt(emp.terminated_date)} color="var(--color-danger)"/>}
      </Section>
      <Section title="Access & Status">
        <InfoRow label="App Access" value={emp.has_app_access?'Active':'No access'} color={emp.has_app_access?'var(--color-success)':undefined}/>
        <InfoRow label="Invitation" value={emp.invitation_status?.replace(/_/g,' ')}/>
        <InfoRow label="Armed Officer" value={emp.is_armed?'Yes':'No'} color={emp.is_armed?'var(--accent)':undefined}/>
        <InfoRow label="Role" value={ROLE_LABELS[emp.role]??emp.role}/>
        <InfoRow label="Status" value={emp.status}/>
      </Section>
      {canViewSensitive && emp.emergency_contact_name && (
        <Section title="Emergency Contact">
          <InfoRow label="Name" value={emp.emergency_contact_name}/>
          <InfoRow label="Phone" value={emp.emergency_contact_phone}/>
          <InfoRow label="Relation" value={emp.emergency_contact_relation}/>
        </Section>
      )}
      {canEdit && (
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'8px'}}>
          <button onClick={onEdit} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 18px',height:'40px'}}>
            <Icon name="edit-2" size={14}/>EDIT
          </button>
          {canInvite && (
            <button onClick={sendInvite} disabled={inviting} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 18px',height:'40px',opacity:inviting?0.6:1}}>
              <Icon name="mail" size={14}/>{inviting?'SENDING...':'INVITE TO APP'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Credentials Tab ───────────────────────────────────────────────────────────

const CRED_TYPES = ['firearms','guard_card','cpr','first_aid','background_check','taser','pepper_spray','driver_license','other']

function CredentialsTab({emp, canEdit}) {
  const [creds, setCreds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({type:'guard_card',number:'',issued_date:'',expiry_date:'',issuing_authority:'',notes:''})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee_credential').select('*').eq('employee_id', emp.id).order('expiry_date', { ascending:true })
    setCreds(data||[])
    setLoading(false)
  }

  async function save() {
    setSaving(true); setSaveError(null)
    const { error } = await supabase.from('employee_credential').insert({ employee_id:emp.id, company_id:emp.company_id, ...form, issued_date:form.issued_date||null, expiry_date:form.expiry_date||null })
    if (error) { setSaveError(error.message); setSaving(false); return }
    setSaving(false); setShowAdd(false); setForm({type:'guard_card',number:'',issued_date:'',expiry_date:'',issuing_authority:'',notes:''}); load()
  }

  async function remove(id) {
    if (!window.confirm('Delete this credential?')) return
    await supabase.from('employee_credential').delete().eq('id', id)
    load()
  }

  const inp = {background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',fontFamily:'var(--font-body)'}
  const lbl = {fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}

  function isExpiringSoon(date) {
    if (!date) return false
    const diff = (new Date(date) - new Date()) / (1000*60*60*24)
    return diff >= 0 && diff <= 60
  }
  function isExpired(date) {
    if (!date) return false
    return new Date(date) < new Date()
  }

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{creds.length} credential{creds.length!==1?'s':''} on file</div>
        {canEdit && <button onClick={()=>setShowAdd(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={13}/>ADD</button>}
      </div>

      {showAdd && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'16px',marginBottom:'16px'}}>
          {saveError && <div style={{padding:'8px 12px',borderRadius:'var(--radius-sm)',marginBottom:'10px',fontSize:'12px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)'}}>{saveError}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={lbl}>Type</div><select style={{...inp,cursor:'pointer'}} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{CRED_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div><div style={lbl}>Number / ID</div><input style={inp} value={form.number} onChange={e=>setForm(p=>({...p,number:e.target.value}))} placeholder="License or cert number"/></div>
            <div><div style={lbl}>Issued Date</div><input style={inp} type="date" value={form.issued_date} onChange={e=>setForm(p=>({...p,issued_date:e.target.value}))}/></div>
            <div><div style={lbl}>Expiry Date</div><input style={inp} type="date" value={form.expiry_date} onChange={e=>setForm(p=>({...p,expiry_date:e.target.value}))}/></div>
            <div><div style={lbl}>Issuing Authority</div><input style={inp} value={form.issuing_authority} onChange={e=>setForm(p=>({...p,issuing_authority:e.target.value}))} placeholder="State board, agency..."/></div>
            <div><div style={lbl}>Notes</div><input style={inp} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={save} disabled={saving} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 16px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}><Icon name="save" size={13}/>{saving?'SAVING...':'SAVE'}</button>
            <button onClick={()=>{setShowAdd(false);setSaveError(null)}} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}}>CANCEL</button>
          </div>
        </div>
      )}

      {creds.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No credentials on file</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {creds.map(c => {
            const expired = isExpired(c.expiry_date)
            const soon = !expired && isExpiringSoon(c.expiry_date)
            return (
              <div key={c.id} style={{background:'var(--bg-card)',border:`1px solid ${expired?'rgba(192,57,43,0.3)':soon?'rgba(232,148,58,0.3)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                    <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',textTransform:'capitalize'}}>{c.type.replace(/_/g,' ')}</span>
                    {expired && <span style={{fontSize:'10px',fontWeight:700,padding:'1px 6px',borderRadius:'10px',background:'var(--color-danger-bg)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)'}}>EXPIRED</span>}
                    {soon && <span style={{fontSize:'10px',fontWeight:700,padding:'1px 6px',borderRadius:'10px',background:'var(--color-warning-bg)',color:'var(--color-warning)',fontFamily:'var(--font-condensed)'}}>EXPIRING SOON</span>}
                  </div>
                  {c.number && <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>#{c.number}</div>}
                  <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px',display:'flex',gap:'12px',flexWrap:'wrap'}}>
                    {c.issued_date && <span>Issued {fmt(c.issued_date)}</span>}
                    {c.expiry_date && <span style={{color:expired?'var(--color-danger)':soon?'var(--color-warning)':undefined}}>Expires {fmt(c.expiry_date)}</span>}
                    {c.issuing_authority && <span>{c.issuing_authority}</span>}
                  </div>
                </div>
                {canEdit && <button onClick={()=>remove(c.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex',borderRadius:'var(--radius-sm)',flexShrink:0}}><Icon name="trash-2" size={14}/></button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({emp, canEdit, authorId}) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee_note').select('*').eq('employee_id', emp.id).order('created_at', { ascending:false })
    setNotes(data||[])
    setLoading(false)
  }

  async function addNote() {
    if (!text.trim()) return
    setSaving(true); setSaveError(null)
    const { error } = await supabase.from('employee_note').insert({ employee_id:emp.id, company_id:emp.company_id, body:text.trim(), author_id:authorId||null })
    if (error) { setSaveError(error.message); setSaving(false); return }
    setText(''); setSaving(false); load()
  }

  async function remove(id) {
    await supabase.from('employee_note').delete().eq('id', id)
    load()
  }

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      {canEdit && (
        <div style={{marginBottom:'16px'}}>
          {saveError && <div style={{padding:'8px 12px',borderRadius:'var(--radius-sm)',marginBottom:'8px',fontSize:'12px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)'}}>{saveError}</div>}
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Add a note..." rows={3}
            style={{width:'100%',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'10px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',fontFamily:'var(--font-body)',resize:'vertical',lineHeight:1.5,boxSizing:'border-box'}}
            onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          <button onClick={addNote} disabled={!text.trim()||saving} style={{marginTop:'8px',display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 16px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:(!text.trim()||saving)?0.5:1}}>
            <Icon name="plus" size={13}/>{saving?'SAVING...':'ADD NOTE'}
          </button>
        </div>
      )}
      {notes.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No notes yet</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {notes.map(n => (
            <div key={n.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                <div style={{fontSize:'13px',color:'var(--text-primary)',lineHeight:1.6,flex:1}}>{n.body}</div>
                {canEdit && <button onClick={()=>remove(n.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'2px',display:'flex',flexShrink:0}}><Icon name="x" size={13}/></button>}
              </div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'8px'}}>
                {n.created_at ? new Date(n.created_at).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Edit Modal (inline) ───────────────────────────────────────────────────────

function EmpEditModal({ emp, onClose, onSaved }) {
  const ROLES_LIST = ['officer','corporal','sergeant','lieutenant','chief','hr','accounting','office_staff']
  const STATUS_LIST = ['active','inactive','probation','suspended','terminated']
  const EMP_TYPES  = ['full_time','part_time','contract','1099']
  const [form, setForm] = useState({
    first_name: emp.first_name||'', last_name: emp.last_name||'', middle_name: emp.middle_name||'',
    email: emp.email||'', phone_number: emp.phone_number||'', position_title: emp.position_title||'',
    role: emp.role||'officer', status: emp.status||'active', employment_type: emp.employment_type||'full_time',
    is_armed: emp.is_armed||false, has_app_access: emp.has_app_access||false,
    hire_date: emp.hire_date||'', notes: emp.notes||'', employee_id_number: emp.employee_id_number||'',
  })
  const [saving, setSaving] = useState(false)
  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  const inp = {background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'9px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',fontFamily:'var(--font-body)'}
  const lbl = {fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}

  async function save() {
    setSaving(true)
    await supabase.from('employee').update({
      first_name:form.first_name.trim(), last_name:form.last_name.trim(),
      middle_name:form.middle_name.trim()||null, email:form.email.trim()||null,
      phone_number:form.phone_number.trim()||null, position_title:form.position_title.trim()||null,
      role:form.role, status:form.status, employment_type:form.employment_type,
      is_armed:form.is_armed, has_app_access:form.has_app_access,
      hire_date:form.hire_date||null, notes:form.notes.trim()||null,
      employee_id_number:form.employee_id_number.trim()||null,
    }).eq('id', emp.id)
    setSaving(false); onSaved()
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:300}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(500px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:301,display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>EDIT EMPLOYEE</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',minHeight:'44px',minWidth:'44px',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{padding:'20px',flex:1,display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><div style={lbl}>First Name</div><input style={inp} value={form.first_name} onChange={e=>setF('first_name',e.target.value)}/></div>
            <div><div style={lbl}>Last Name</div><input style={inp} value={form.last_name} onChange={e=>setF('last_name',e.target.value)}/></div>
            <div><div style={lbl}>Email</div><input style={inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)}/></div>
            <div><div style={lbl}>Phone</div><input style={inp} value={form.phone_number} onChange={e=>setF('phone_number',e.target.value)}/></div>
            <div><div style={lbl}>Position Title</div><input style={inp} value={form.position_title} onChange={e=>setF('position_title',e.target.value)}/></div>
            <div><div style={lbl}>Employee ID</div><input style={inp} value={form.employee_id_number} onChange={e=>setF('employee_id_number',e.target.value)}/></div>
            <div><div style={lbl}>Role</div><select style={{...inp,cursor:'pointer'}} value={form.role} onChange={e=>setF('role',e.target.value)}>{ROLES_LIST.map(r=><option key={r} value={r}>{ROLE_LABELS[r]||r}</option>)}</select></div>
            <div><div style={lbl}>Status</div><select style={{...inp,cursor:'pointer'}} value={form.status} onChange={e=>setF('status',e.target.value)}>{STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><div style={lbl}>Employment Type</div><select style={{...inp,cursor:'pointer'}} value={form.employment_type} onChange={e=>setF('employment_type',e.target.value)}>{EMP_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
            <div><div style={lbl}>Hire Date</div><input style={inp} type="date" value={form.hire_date} onChange={e=>setF('hire_date',e.target.value)}/></div>
          </div>
          <div><div style={lbl}>Notes</div><textarea style={{...inp,minHeight:'60px',resize:'vertical',lineHeight:1.5}} value={form.notes} onChange={e=>setF('notes',e.target.value)}/></div>
          <div style={{display:'flex',gap:'20px'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_armed} onChange={e=>setF('is_armed',e.target.checked)} style={{accentColor:'var(--accent)',width:'16px',height:'16px'}}/>Armed
            </label>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}>
              <input type="checkbox" checked={form.has_app_access} onChange={e=>setF('has_app_access',e.target.checked)} style={{accentColor:'var(--accent)',width:'16px',height:'16px'}}/>App Access
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

// ── Main EmployeeProfile Component ────────────────────────────────────────────

export default function EmployeeProfile({ emp, allEmployees, activeTab, onTabChange, onNavigate, onClose, canViewSensitive, canEdit, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const rc = ROLE_COLORS[emp.role] || ROLE_COLORS.officer
  const sc = STATUS_COLORS[emp.status] || STATUS_COLORS.inactive
  const ini = `${emp.first_name?.[0]??''}${emp.last_name?.[0]??''}`.toUpperCase()

  const currentIndex = allEmployees.findIndex(e => e.id === emp.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allEmployees.length - 1

  function goTo(offset) {
    const next = allEmployees[currentIndex + offset]
    if (next) onNavigate(next)
  }

  if (editing) return <EmpEditModal emp={emp} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);onRefresh?.();onClose()}}/>

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(620px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:201,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <button onClick={()=>goTo(-1)} disabled={!hasPrev} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:hasPrev?'var(--text-secondary)':'var(--border)',cursor:hasPrev?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',width:'32px',height:'32px',flexShrink:0}}><Icon name="chevron-left" size={16}/></button>
              <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px'}}>{currentIndex+1} / {allEmployees.length}</span>
              <button onClick={()=>goTo(1)} disabled={!hasNext} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',color:hasNext?'var(--text-secondary)':'var(--border)',cursor:hasNext?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',width:'32px',height:'32px',flexShrink:0}}><Icon name="chevron-right" size={16}/></button>
            </div>
            <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px',borderRadius:'var(--radius-sm)'}}><Icon name="x" size={18}/></button>
          </div>

          <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
            <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-condensed)',fontSize:'18px',fontWeight:700,color:'var(--text-inverse)',flexShrink:0,overflow:'hidden'}}>
              {emp.profile_photo_url?<img src={emp.profile_photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:ini}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'1px',color:'var(--text-primary)',lineHeight:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {emp.first_name} {emp.middle_name?emp.middle_name+' ':''}{emp.last_name}
              </div>
              <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'3px'}}>{emp.position_title||'No position assigned'}</div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
                <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:rc.bg,color:rc.color}}>{ROLE_LABELS[emp.role]??emp.role}</span>
                <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:sc.bg,color:sc.color}}>{emp.status}</span>
                {emp.is_armed&&<span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>Armed</span>}
                {emp.has_app_access
                  ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-success-bg)',color:'var(--color-success)'}}>APP ACCESS</span>
                  : emp.invitation_status==='invited'
                    ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-warning-bg)',color:'var(--color-warning)'}}>INVITED</span>
                    : null
                }
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{display:'flex',overflowX:'auto',borderBottom:'1px solid var(--border)',flexShrink:0,scrollbarWidth:'none'}}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>onTabChange(tab.id)}
              style={{display:'flex',alignItems:'center',gap:'6px',padding:'0 14px',height:'44px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===tab.id?'var(--accent)':'transparent'}`,color:activeTab===tab.id?'var(--accent)':'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',cursor:'pointer',whiteSpace:'nowrap',transition:'all 150ms ease',fontWeight:activeTab===tab.id?700:400}}>
              <Icon name={tab.icon} size={13}/>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{flex:1,overflowY:'auto'}}>
          {activeTab === 'overview'    && <OverviewTab emp={emp} canViewSensitive={canViewSensitive} canEdit={canEdit} onRefresh={onRefresh} onEdit={()=>setEditing(true)}/>}
          {activeTab === 'credentials' && <CredentialsTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'training'    && <ComingSoonTab name="Training"/>}
          {activeTab === 'documents'   && <ComingSoonTab name="Documents"/>}
          {activeTab === 'pto'         && <ComingSoonTab name="PTO"/>}
          {activeTab === 'uniforms'    && <ComingSoonTab name="Uniforms"/>}
          {activeTab === 'reviews'     && <ComingSoonTab name="Reviews"/>}
          {activeTab === 'notes'       && <NotesTab emp={emp} canEdit={canEdit}/>}
        </div>
      </div>
    </>
  )
}
