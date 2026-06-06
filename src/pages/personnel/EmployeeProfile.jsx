import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import { logChange, logFieldChanges } from '../../lib/changeLog'
import { meetsLevel, PERMISSION_KEYS } from '../../config/roles'
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
  { id:'paystubs',     label:'Pay Stubs',    icon:'dollar-sign' },
  { id:'changelog',    label:'Change Log',   icon:'clock' },
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

function OverviewTab({emp, canViewSensitive, canEdit, onRefresh, onEdit, viewerProfile}) {
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)
  const rc = ROLE_COLORS[emp.role] || ROLE_COLORS.officer
  const sc = STATUS_COLORS[emp.status] || STATUS_COLORS.inactive
  const canInvite = canEdit && emp.email && emp.invitation_status !== 'accepted'

  async function sendInvite() {
    setInviting(true); setInviteMsg(null)
    const { error } = await supabase.functions.invoke('invite-user', {
      body: { email:emp.email, first_name:emp.first_name, last_name:emp.last_name, employee_id:emp.id, company_id:emp.company_id, role:emp.role }
    })
    if (error) {
      setInviteMsg({ ok:false, text: error.message || 'Invite failed.' })
    } else {
      setInviteMsg({ ok:true, text:`Invite sent to ${emp.email}. They'll receive a branded email with a secure sign-in link.` })
      onRefresh?.()
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
      <PermissionsSection emp={emp} viewerProfile={viewerProfile} onRefresh={onRefresh}/>
      {canEdit && (
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'8px'}}>
          <button onClick={onEdit} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 18px',height:'40px'}}>
            <Icon name="edit-2" size={14}/>EDIT
          </button>
          {canInvite && (
            <button onClick={sendInvite} disabled={inviting} style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',padding:'0 18px',height:'40px',opacity:inviting?0.6:1}}>
              <Icon name="mail" size={14}/>{inviting?'SENDING...':emp.invitation_status==='sent'?'RESEND INVITE':'INVITE TO APP'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Permissions Section (within Overview Tab) ─────────────────────────────────

function PermissionsSection({ emp, viewerProfile, onRefresh }) {
  const canGrant = meetsLevel(viewerProfile?.role, 4)
  const [perms, setPerms] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (!canGrant || !emp.user_id) return
    supabase.from('user_profile').select('custom_permissions').eq('id', emp.user_id).single()
      .then(({ data }) => setPerms(data?.custom_permissions || {}))
  }, [emp.user_id, canGrant])

  async function save() {
    if (!emp.user_id) return
    setSaving(true)
    await supabase.from('user_profile').update({ custom_permissions: perms }).eq('id', emp.user_id)
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500)
  }

  if (!canGrant || !emp.user_id) return null

  return (
    <Section title="Permission Overrides (Admin)">
      <div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'10px',lineHeight:1.5}}>
        Grant specific permissions above this employee's default role level. These are not logged in the change log.
      </div>
      {Object.entries(PERMISSION_KEYS).map(([key, meta]) => (
        <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{meta.label}</span>
          <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer'}}>
            <span style={{fontSize:'11px',color:perms[key]?'var(--accent)':'var(--text-muted)'}}>{perms[key]?'Granted':'Default'}</span>
            <input type="checkbox" checked={!!perms[key]} onChange={e=>setPerms(p=>({...p,[key]:e.target.checked||undefined}))}
              style={{accentColor:'var(--accent)',width:'15px',height:'15px',cursor:'pointer'}}/>
          </label>
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{marginTop:'10px',display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}>
        <Icon name="save" size={13}/>{saving?'SAVING...':saved?'SAVED ✓':'SAVE PERMISSIONS'}
      </button>
    </Section>
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
    // Log changed fields
    if (emp.company_id) {
      const { data: viewer } = await supabase.from('user_profile').select('id,first_name,last_name,role').single().then ? { data: null } : { data: null }
      await logFieldChanges(
        { companyId:emp.company_id, employeeId:emp.id, changedById:'', changedByName:'Admin', changedByRole:'' },
        emp,
        { ...emp, ...form },
        {
          email:           { label:'Email',           changeType:'field_update' },
          phone_number:    { label:'Phone',            changeType:'field_update' },
          role:            { label:'Role',             changeType:'field_update' },
          status:          { label:'Status',           changeType:'status_change' },
          position_title:  { label:'Position Title',   changeType:'field_update' },
          employment_type: { label:'Employment Type',  changeType:'field_update' },
        }
      )
    }
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

export default function EmployeeProfile({ emp, allEmployees, activeTab, onTabChange, onNavigate, onClose, canViewSensitive, canEdit, onRefresh, profile }) {
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
                {emp.has_app_access || emp.invitation_status==='accepted'
                  ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-success-bg)',color:'var(--color-success)'}}>APP ACCESS</span>
                  : emp.invitation_status==='sent'
                    ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-warning-bg)',color:'var(--color-warning)'}}>INVITED</span>
                    : emp.invitation_status==='expired'
                      ? <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--color-danger-bg)',color:'var(--color-danger)'}}>EXPIRED</span>
                      : <span style={{fontSize:'10px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:'var(--border)',color:'var(--text-muted)'}}>NOT INVITED</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{display:'flex',overflowX:'auto',borderBottom:'1px solid var(--border)',flexShrink:0,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>onTabChange(tab.id)}
              style={{flex:'1',minWidth:'70px',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',padding:'0 10px',height:'44px',background:'transparent',border:'none',borderBottom:`2px solid ${activeTab===tab.id?'var(--accent)':'transparent'}`,color:activeTab===tab.id?'var(--accent)':'var(--text-muted)',fontSize:'11px',fontFamily:'var(--font-condensed)',letterSpacing:'0.3px',cursor:'pointer',whiteSpace:'nowrap',transition:'all 150ms ease',fontWeight:activeTab===tab.id?700:400,textAlign:'center'}}>
              <Icon name={tab.icon} size={12}/>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{flex:1,overflowY:'auto'}}>
          {activeTab === 'overview'    && <OverviewTab emp={emp} canViewSensitive={canViewSensitive} canEdit={canEdit} onRefresh={onRefresh} onEdit={()=>setEditing(true)} viewerProfile={profile}/>}
          {activeTab === 'credentials' && <CredentialsTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'training'    && <TrainingTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'documents'   && <DocumentsTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'pto'         && <PTOTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'uniforms'    && <UniformsTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'reviews'     && <ReviewsTab emp={emp}/>}
          {activeTab === 'notes'       && <NotesTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'paystubs'    && <EmpPayStubsTab emp={emp} canEdit={canEdit}/>}
          {activeTab === 'changelog'   && <ChangeLogTab emp={emp}/>}
        </div>
      </div>
    </>
  )
}

// ── Training Tab ──────────────────────────────────────────────────────────────

const ASSIGN_STATUS_META = {
  not_started:  { bg:'var(--border)',              color:'var(--text-muted)',    label:'Not Started' },
  in_progress:  { bg:'var(--color-info-bg)',       color:'var(--color-info)',    label:'In Progress' },
  completed:    { bg:'var(--color-success-bg)',    color:'var(--color-success)', label:'Completed' },
  overdue:      { bg:'var(--color-danger-bg)',     color:'var(--color-danger)',  label:'Overdue' },
  pending:      { bg:'var(--border)',              color:'var(--text-muted)',    label:'Pending' },
}

function TrainingTab({ emp, canEdit }) {
  const [assignments, setAssignments] = useState([])
  const [courses, setCourses]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showAssign, setShowAssign]   = useState(false)
  const [form, setForm]               = useState({ course_id:'', due_date:'' })
  const [assigning, setAssigning]     = useState(false)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const [{ data: aData }, { data: cData }] = await Promise.all([
      supabase.from('training_assignment').select('*, training_course(title,description)').eq('employee_id', emp.id).order('created_at', {ascending:false}),
      supabase.from('training_course').select('id,title').eq('company_id', emp.company_id).eq('status','active').order('title'),
    ])
    setAssignments(aData||[])
    setCourses(cData||[])
    setLoading(false)
  }

  async function assign() {
    if (!form.course_id) return
    setAssigning(true)
    await supabase.from('training_assignment').insert({ company_id:emp.company_id, employee_id:emp.id, course_id:form.course_id, status:'not_started', assigned_at:new Date().toISOString(), due_date:form.due_date||null })
    setAssigning(false); setShowAssign(false); setForm({ course_id:'', due_date:'' }); load()
  }

  const completed = assignments.filter(a=>a.status==='completed').length
  const pct = assignments.length ? Math.round((completed/assignments.length)*100) : 0
  const fmtD = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
        <div>
          <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{assignments.length} course{assignments.length!==1?'s':''} assigned</div>
          {assignments.length>0 && (
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'6px'}}>
              <div style={{flex:1,height:'6px',background:'var(--border)',borderRadius:'3px',overflow:'hidden',minWidth:'100px'}}>
                <div style={{height:'100%',background:'var(--color-success)',borderRadius:'3px',width:`${pct}%`,transition:'width 400ms ease'}}/>
              </div>
              <span style={{fontSize:'11px',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{completed}/{assignments.length} complete</span>
            </div>
          )}
        </div>
        {canEdit && <button onClick={()=>setShowAssign(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={13}/>ASSIGN TRAINING</button>}
      </div>

      {showAssign && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Course</div>
              <select style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',cursor:'pointer'}} value={form.course_id} onChange={e=>setForm(p=>({...p,course_id:e.target.value}))}>
                <option value="">Select course...</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Due Date (optional)</div>
              <input type="date" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%'}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={assign} disabled={!form.course_id||assigning} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:(!form.course_id||assigning)?0.6:1}}><Icon name="save" size={13}/>{assigning?'ASSIGNING...':'ASSIGN'}</button>
            <button onClick={()=>setShowAssign(false)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}}>CANCEL</button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No training assigned yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {assignments.map(a => {
            const meta = ASSIGN_STATUS_META[a.status] || ASSIGN_STATUS_META.pending
            const course = a.training_course
            return (
              <div key={a.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>{course?.title||'Unknown Course'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',display:'flex',gap:'10px',flexWrap:'wrap'}}>
                    <span>Assigned {fmtD(a.assigned_at)}</span>
                    {a.due_date && <span style={{color:new Date(a.due_date)<new Date()&&a.status!=='completed'?'var(--color-danger)':undefined}}>Due {fmtD(a.due_date)}</span>}
                    {a.completed_at && <span style={{color:'var(--color-success)'}}>Completed {fmtD(a.completed_at)}</span>}
                  </div>
                </div>
                <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:meta.bg,color:meta.color,fontFamily:'var(--font-condensed)',whiteSpace:'nowrap'}}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

const DOC_TYPES_LIST = ['I-9','Handbook Acknowledgment','Write-Up','Doctor Note','Contract','Guard License','Background Check','Other']

function DocumentsTab({ emp, canEdit }) {
  const [docs, setDocs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ doc_type:'I-9', file_name:'' })
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState(null)
  const fileRef               = useRef(null)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee_document').select('*').eq('employee_id', emp.id).order('created_at', {ascending:false})
    setDocs(data||[])
    setLoading(false)
  }

  async function upload(file) {
    if (!file) return
    setUploading(true); setError(null)
    const ext = file.name.split('.').pop()
    const fname = form.file_name.trim() || file.name
    const path = `${emp.company_id}/${emp.id}/${Date.now()}-${fname}.${ext}`
    const { data: upData, error: upErr } = await supabase.storage.from('employee-documents').upload(path, file, { upsert:true, contentType:file.type })
    if (upErr) { setError(upErr.message); setUploading(false); return }
    const { data:{ publicUrl } } = supabase.storage.from('employee-documents').getPublicUrl(upData.path)
    const { error: insErr } = await supabase.from('employee_document').insert({ company_id:emp.company_id, employee_id:emp.id, doc_type:form.doc_type, file_name:fname, file_url:publicUrl, uploaded_at:new Date().toISOString() })
    if (insErr) setError(insErr.message)
    else { setShowAdd(false); setForm({ doc_type:'I-9', file_name:'' }) }
    setUploading(false); load()
  }

  async function del(id) {
    if (!window.confirm('Delete this document?')) return
    await supabase.from('employee_document').delete().eq('id', id); load()
  }

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{docs.length} document{docs.length!==1?'s':''} on file</div>
        {canEdit && <button onClick={()=>setShowAdd(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="upload" size={13}/>UPLOAD</button>}
      </div>
      {error && <div style={{padding:'8px 12px',borderRadius:'var(--radius-sm)',marginBottom:'12px',fontSize:'12px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)'}}>{error}</div>}
      {showAdd && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'14px'}}>
          <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>upload(e.target.files[0])}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Document Type</div>
              <select style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%',cursor:'pointer'}} value={form.doc_type} onChange={e=>setForm(p=>({...p,doc_type:e.target.value}))}>
                {DOC_TYPES_LIST.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>File Label (optional)</div>
              <input style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%'}} value={form.file_name} onChange={e=>setForm(p=>({...p,file_name:e.target.value}))} placeholder="e.g. I9 Completed 2026"/>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:uploading?0.6:1}}><Icon name="upload" size={13}/>{uploading?'UPLOADING...':'CHOOSE FILE'}</button>
            <button onClick={()=>setShowAdd(false)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}}>CANCEL</button>
          </div>
        </div>
      )}
      {docs.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No documents on file.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {docs.map(doc => (
            <div key={doc.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <Icon name="file-text" size={18} color="var(--text-muted)"/>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{doc.file_name||doc.doc_type}</div>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{doc.doc_type} · {doc.uploaded_at?new Date(doc.uploaded_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</div>
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:'5px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer',padding:'0 10px',height:'30px',textDecoration:'none'}}><Icon name="eye" size={11}/>VIEW</a>}
                {canEdit && <button onClick={()=>del(doc.id)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}}><Icon name="trash-2" size={13}/></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PTO Tab ───────────────────────────────────────────────────────────────────

const PTO_TYPES = ['Vacation','Sick','Personal','Bereavement','Unpaid','Holiday']
const PTO_STATUS = {
  pending:  { bg:'var(--color-warning-bg)', color:'var(--color-warning)', label:'Pending' },
  approved: { bg:'var(--color-success-bg)', color:'var(--color-success)', label:'Approved' },
  denied:   { bg:'var(--color-danger-bg)',  color:'var(--color-danger)',  label:'Denied' },
}

function PTOTab({ emp, canEdit }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showReq, setShowReq]   = useState(false)
  const [acting, setActing]     = useState(null)
  const [form, setForm]         = useState({ pto_type:'Vacation', start_date:'', end_date:'', notes:'' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pto_request').select('*').eq('employee_id', emp.id).order('created_at', {ascending:false})
    setRequests(data||[])
    setLoading(false)
  }

  async function submit() {
    if (!form.start_date || !form.end_date) { setError('Start and end date required.'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('pto_request').insert({ company_id:emp.company_id, employee_id:emp.id, pto_type:form.pto_type, start_date:form.start_date, end_date:form.end_date, notes:form.notes||null, status:'pending', requested_at:new Date().toISOString() })
    if (err) setError(err.message)
    else { setShowReq(false); setForm({ pto_type:'Vacation', start_date:'', end_date:'', notes:'' }) }
    setSaving(false); load()
  }

  async function decide(id, status) {
    setActing(id)
    await supabase.from('pto_request').update({ status, reviewed_at:new Date().toISOString() }).eq('id', id)
    setActing(null); load()
  }

  const approvedDaysThisYear = requests.filter(r => r.status==='approved' && new Date(r.start_date).getFullYear()===new Date().getFullYear()).reduce((a,r) => {
    const days = (new Date(r.end_date)-new Date(r.start_date))/86400000 + 1
    return a + Math.max(0, days)
  }, 0)

  const fmtD = d => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
  const inp = {background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%'}

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
        <div>
          <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{requests.length} request{requests.length!==1?'s':''} total</div>
          <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{approvedDaysThisYear} approved days used this year</div>
        </div>
        {canEdit && <button onClick={()=>setShowReq(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={13}/>SUBMIT REQUEST</button>}
      </div>
      {error && <div style={{padding:'8px 12px',borderRadius:'var(--radius-sm)',marginBottom:'12px',fontSize:'12px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)'}}>{error}</div>}
      {showReq && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Type</div><select style={{...inp,cursor:'pointer'}} value={form.pto_type} onChange={e=>setForm(p=>({...p,pto_type:e.target.value}))}>{PTO_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Start Date *</div><input type="date" style={inp} value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))}/></div>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>End Date *</div><input type="date" style={inp} value={form.end_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))}/></div>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Notes</div><input style={inp} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional reason..."/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={submit} disabled={saving} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:saving?0.6:1}}><Icon name="save" size={13}/>{saving?'SAVING...':'SUBMIT'}</button>
            <button onClick={()=>{setShowReq(false);setError(null)}} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}}>CANCEL</button>
          </div>
        </div>
      )}
      {requests.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No PTO requests on file.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {requests.map(req => {
            const meta = PTO_STATUS[req.status] || PTO_STATUS.pending
            return (
              <div key={req.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>{req.pto_type}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{fmtD(req.start_date)} – {fmtD(req.end_date)}{req.notes?` · "${req.notes}"`:''}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px'}}>
                  <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:meta.bg,color:meta.color,fontFamily:'var(--font-condensed)'}}>{meta.label}</span>
                  {req.status==='pending' && canEdit && (
                    <div style={{display:'flex',gap:'4px'}}>
                      <button onClick={()=>decide(req.id,'approved')} disabled={acting===req.id} style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'var(--color-success-bg)',color:'var(--color-success)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-sm)',padding:'0 8px',height:'26px',fontFamily:'var(--font-condensed)',fontSize:'10px',fontWeight:700,cursor:'pointer'}}><Icon name="check" size={10}/>APPROVE</button>
                      <button onClick={()=>decide(req.id,'denied')} disabled={acting===req.id} style={{display:'inline-flex',alignItems:'center',gap:'4px',background:'var(--color-danger-bg)',color:'var(--color-danger)',border:'1px solid rgba(192,57,43,0.3)',borderRadius:'var(--radius-sm)',padding:'0 8px',height:'26px',fontFamily:'var(--font-condensed)',fontSize:'10px',fontWeight:700,cursor:'pointer'}}><Icon name="x" size={10}/>DENY</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Uniforms Tab ──────────────────────────────────────────────────────────────

function UniformsTab({ emp, canEdit }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ items_requested:'', size:'', notes:'' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('uniform_request').select('*').eq('employee_id', emp.id).order('created_at', {ascending:false})
    setRequests(data||[])
    setLoading(false)
  }

  async function submit() {
    if (!form.items_requested.trim()) return
    setSaving(true)
    await supabase.from('uniform_request').insert({ company_id:emp.company_id, employee_id:emp.id, item_type:form.items_requested.trim(), size:form.size||null, notes:form.notes||null, status:'pending' })
    setSaving(false); setShowNew(false); setForm({ items_requested:'', size:'', notes:'' }); load()
  }

  const STATUS = { pending:{bg:'var(--color-warning-bg)',color:'var(--color-warning)',label:'Pending'}, approved:{bg:'var(--color-info-bg)',color:'var(--color-info)',label:'Approved'}, fulfilled:{bg:'var(--color-success-bg)',color:'var(--color-success)',label:'Fulfilled'}, denied:{bg:'var(--color-danger-bg)',color:'var(--color-danger)',label:'Denied'} }
  const inp = {background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 10px',fontSize:'13px',color:'var(--text-primary)',outline:'none',width:'100%'}

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{requests.length} request{requests.length!==1?'s':''}</div>
        <button onClick={()=>setShowNew(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={13}/>NEW REQUEST</button>
      </div>
      {showNew && (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Items Requested *</div><input style={inp} value={form.items_requested} onChange={e=>setForm(p=>({...p,items_requested:e.target.value}))} placeholder="e.g. Duty Shirt, Pants"/></div>
            <div><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Size</div><input style={inp} value={form.size} onChange={e=>setForm(p=>({...p,size:e.target.value}))} placeholder="e.g. L, 34x30"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Notes</div><input style={inp} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Replacement reason, special requirements..."/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={submit} disabled={saving||!form.items_requested.trim()} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 14px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:(saving||!form.items_requested.trim())?0.6:1}}><Icon name="save" size={13}/>{saving?'SAVING...':'SUBMIT'}</button>
            <button onClick={()=>setShowNew(false)} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'transparent',color:'var(--text-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'0 12px',height:'34px',fontFamily:'var(--font-condensed)',fontSize:'12px',cursor:'pointer'}}>CANCEL</button>
          </div>
        </div>
      )}
      {requests.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No uniform requests on file.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {requests.map(req => {
            const meta = STATUS[req.status] || STATUS.pending
            return (
              <div key={req.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{req.item_type}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{req.size?`Size: ${req.size} · `:''}Requested {req.created_at?new Date(req.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''}</div>
                </div>
                <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:meta.bg,color:meta.color,fontFamily:'var(--font-condensed)'}}>{meta.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Reviews Tab ───────────────────────────────────────────────────────────────

function ReviewsTab({ emp }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('performance_review').select('*').eq('employee_id', emp.id).order('created_at', {ascending:false})
    setReviews(data||[])
    setLoading(false)
  }

  function Stars({ rating }) {
    return (
      <div style={{display:'flex',gap:'2px'}}>
        {[1,2,3,4,5].map(i=>(
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i<=rating?'var(--accent)':'var(--border)'} stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ))}
      </div>
    )
  }

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>{reviews.length} review{reviews.length!==1?'s':''} on file · <a href="/reviews" style={{color:'var(--accent)'}}>Write a Review →</a></div>
      {reviews.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No performance reviews on file. <a href="/reviews" style={{color:'var(--accent)'}}>Write the first one →</a></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {reviews.map(rev => (
            <div key={rev.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px',marginBottom:'8px'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{rev.review_period||'Performance Review'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{rev.created_at?new Date(rev.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):''}{rev.reviewer_name?` · Reviewed by ${rev.reviewer_name}`:''}</div>
                </div>
                {rev.overall_rating && <Stars rating={rev.overall_rating}/>}
              </div>
              {rev.comments && <div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.6}}>{rev.comments}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pay Stubs Tab ─────────────────────────────────────────────────────────────

function EmpPayStubsTab({ emp, canEdit }) {
  const [runs, setRuns]           = useState([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const [{ data: gustoConn }, { data: payrollRuns }] = await Promise.all([
      supabase.from('gusto_connection').select('gusto_company_id').eq('company_id', emp.company_id).maybeSingle(),
      supabase.from('payroll_run').select('*').eq('company_id', emp.company_id).order('pay_period_end', {ascending:false}).limit(20),
    ])
    setConnected(!!gustoConn?.gusto_company_id)
    setRuns(payrollRuns || [])
    setLoading(false)
  }

  async function viewStub(run) {
    try {
      const { data, error } = await supabase.functions.invoke('gusto-proxy', {
        body: { action:'pay-stub-url', company_id:emp.company_id, payroll_id:run.gusto_payroll_id }
      })
      if (error || !data?.url) throw new Error(error?.message || 'No stub URL')
      window.open(data.url, '_blank')
    } catch(e) {
      alert('Could not load pay stub: ' + e.message)
    }
  }

  const fmtD = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
  const fmtM = n => n != null ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n) : '—'

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  if (!connected) return (
    <div style={{padding:'24px',textAlign:'center'}}>
      <Icon name="dollar-sign" size={32} color="var(--border-subtle)"/>
      <div style={{marginTop:'14px',fontSize:'14px',color:'var(--text-primary)',fontWeight:600}}>Gusto not connected</div>
      <div style={{marginTop:'6px',fontSize:'12px',color:'var(--text-muted)',lineHeight:1.6}}>Connect Gusto in the Payroll page to view pay stubs and run payroll.</div>
      <a href="/payroll" style={{display:'inline-flex',alignItems:'center',gap:'6px',marginTop:'16px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 16px',height:'36px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',textDecoration:'none'}}>
        <Icon name="link" size={13}/>CONNECT GUSTO
      </a>
    </div>
  )

  return (
    <div style={{padding:'24px'}}>
      <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>{runs.length} payroll run{runs.length!==1?'s':''} on record</div>
      {runs.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No payroll runs yet. Submit payroll in the Payroll page.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {runs.map(run => {
            const statusBg = run.status==='processed'?'var(--color-success-bg)':run.status==='submitted'?'var(--color-info-bg)':'var(--border)'
            const statusC  = run.status==='processed'?'var(--color-success)':run.status==='submitted'?'var(--color-info)':'var(--text-muted)'
            return (
              <div key={run.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{fmtD(run.pay_period_start)} – {fmtD(run.pay_period_end)}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>Submitted {fmtD(run.submitted_at)}</div>
                </div>
                {run.total_gross != null && <div style={{fontFamily:'var(--font-condensed)',fontWeight:700,color:'var(--text-primary)'}}>{fmtM(run.total_gross)}</div>}
                <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:statusBg,color:statusC,fontFamily:'var(--font-condensed)',textTransform:'uppercase'}}>{run.status}</span>
                {run.gusto_payroll_id && (
                  <button onClick={()=>viewStub(run)} style={{display:'inline-flex',alignItems:'center',gap:'5px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:'pointer',padding:'0 10px',height:'30px'}}>
                    <Icon name="eye" size={11}/>STUB
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Change Log Tab ────────────────────────────────────────────────────────────

const CHANGE_TYPE_META = {
  field_update:       { color:'var(--text-muted)',      label:'Field Update' },
  status_change:      { color:'var(--color-danger)',    label:'Status Change' },
  pay_change:         { color:'var(--accent)',          label:'Pay Change' },
  document_upload:    { color:'var(--color-info)',      label:'Document' },
  training_assigned:  { color:'var(--color-success)',   label:'Training' },
  invite_sent:        { color:'#a07ae0',                label:'Invite' },
  note_added:         { color:'var(--text-secondary)',  label:'Note' },
}

function ChangeLogTab({ emp }) {
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => { load() }, [emp.id])

  async function load() {
    setLoading(true)
    const since = new Date()
    since.setMonth(since.getMonth() - 24)
    const { data } = await supabase
      .from('employee_change_log')
      .select('*')
      .eq('employee_id', emp.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
    setLogs(data||[])
    setLoading(false)
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.change_type === filter)

  // Group by date
  const groups = filtered.reduce((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {})

  const fmtTime = iso => new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})

  if (loading) return <div style={{padding:'24px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div>

  return (
    <div style={{padding:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',flexWrap:'wrap',gap:'8px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{logs.length} change{logs.length!==1?'s':''} · last 24 months</div>
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          style={{background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'5px 10px',fontSize:'12px',color:'var(--text-primary)',cursor:'pointer',outline:'none'}}>
          <option value="all">All Changes</option>
          {Object.entries(CHANGE_TYPE_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontSize:'13px'}}>No changes recorded yet.</div>
      ) : (
        Object.entries(groups).map(([date, dateLogs]) => (
          <div key={date} style={{marginBottom:'16px'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'8px',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>{date}</div>
            {dateLogs.map(log => {
              const meta = CHANGE_TYPE_META[log.change_type] || CHANGE_TYPE_META.field_update
              return (
                <div key={log.id} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:meta.color,flexShrink:0,marginTop:'5px'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'12px',color:'var(--text-primary)',lineHeight:1.5}}>
                      <strong>{log.changed_by_name||'System'}</strong>
                      {' '}changed <strong>{log.field_label}</strong>
                      {log.old_value && log.new_value && (
                        <> from <span style={{color:'var(--text-muted)'}}>"{log.old_value}"</span> → <span style={{color:meta.color}}>"{log.new_value}"</span></>
                      )}
                      {!log.old_value && log.new_value && <> → <span style={{color:meta.color}}>"{log.new_value}"</span></>}
                    </div>
                    {log.notes && <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px',fontStyle:'italic'}}>Note: {log.notes}</div>}
                    <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px',display:'flex',gap:'8px'}}>
                      <span>{fmtTime(log.created_at)}</span>
                      <span style={{background:`${meta.color}22`,color:meta.color,padding:'0 6px',borderRadius:'6px',fontSize:'10px',fontWeight:700,fontFamily:'var(--font-condensed)'}}>{meta.label.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}
