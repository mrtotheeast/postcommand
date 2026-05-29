import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

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

export default function Personnel() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('grid')
  const canViewSensitive = atLeast(profile?.role, 'lieutenant')
  const canEdit = atLeast(profile?.role, 'chief')

  useEffect(() => { loadEmployees() }, [profile])

  async function loadEmployees() {
    if (!profile?.company_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('employee')
      .select('id,first_name,middle_name,last_name,email,phone_number,role,status,employment_type,employment_classification,position_title,hire_date,is_armed,has_app_access,profile_photo_url,employee_id_number,invitation_status,terminated_date,probation_end_date,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,notes')
      .eq('company_id', profile.company_id)
      .order('last_name', { ascending: true })
    if (error) setError(error.message)
    else setEmployees(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => employees.filter(e => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()) || e.employee_id_number?.toLowerCase().includes(search.toLowerCase()) || e.position_title?.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filterRole==='all'||e.role===filterRole) && (filterStatus==='all'||e.status===filterStatus)
  }), [employees, search, filterRole, filterStatus])

  const stats = useMemo(() => ({
    total:employees.length, active:employees.filter(e=>e.status==='active').length,
    armed:employees.filter(e=>e.is_armed).length, appAccess:employees.filter(e=>e.has_app_access).length,
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
        </div>
        {canEdit && <button style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-md)',padding:'0 20px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}><Icon name="plus" size={16}/>ADD EMPLOYEE</button>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'10px',marginBottom:'20px'}}>
        {[{label:'Total',value:stats.total,color:'var(--text-primary)'},{label:'Active',value:stats.active,color:'var(--color-success)'},{label:'Armed',value:stats.armed,color:'var(--accent)'},{label:'App Access',value:stats.appAccess,color:'var(--color-info)'}].map(s=>(
          <div key={s.label} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 16px'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>{s.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'26px',letterSpacing:'1px',color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
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

      {(search||filterRole!=='all'||filterStatus!=='all') && <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'12px'}}>Showing {filtered.length} of {employees.length}</div>}

      {filtered.length===0 && (
        <div style={{textAlign:'center',padding:'60px 24px',color:'var(--text-muted)'}}>
          <Icon name="users" size={40} color="var(--border-subtle)"/>
          <div style={{marginTop:'16px',fontSize:'15px'}}>No employees found</div>
        </div>
      )}

      {view==='grid' && filtered.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'12px'}}>
          {filtered.map(emp=><EmpCard key={emp.id} emp={emp} ini={initials(emp)} canViewSensitive={canViewSensitive} onClick={()=>setSelected(emp)}/>)}
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

      {selected && <EmpDetail emp={selected} canViewSensitive={canViewSensitive} canEdit={canEdit} onClose={()=>setSelected(null)}/>}
    </div>
  )
}

function EmpCard({emp,ini,canViewSensitive,onClick}) {
  const rc=ROLE_COLORS[emp.role]||ROLE_COLORS.officer
  const sc=STATUS_COLORS[emp.status]||STATUS_COLORS.inactive
  const [hover,setHover]=useState(false)
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{background:'var(--bg-card)',border:`1px solid ${hover?'var(--accent-border)':'var(--border-subtle)'}`,borderRadius:'var(--radius-md)',padding:'18px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',display:'flex',flexDirection:'column',gap:'10px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
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
      </div>
      {canViewSensitive&&emp.email&&<div style={{fontSize:'12px',color:'var(--text-muted)'}}>{emp.email}</div>}
    </button>
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

function EmpDetail({emp,canViewSensitive,canEdit,onClose}) {
  const rc=ROLE_COLORS[emp.role]||ROLE_COLORS.officer
  const sc=STATUS_COLORS[emp.status]||STATUS_COLORS.inactive
  const ini=`${emp.first_name?.[0]??''}${emp.last_name?.[0]??''}`.toUpperCase()
  const fmt=d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'
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
            <R label="App Access" value={emp.has_app_access?'Yes':'No'} color={emp.has_app_access?'var(--color-success)':'var(--text-muted)'}/>
            {emp.invitation_status&&<R label="Invitation" value={emp.invitation_status}/>}
            <R label="Armed Officer" value={emp.is_armed?'Yes':'No'} color={emp.is_armed?'var(--accent)':'var(--text-muted)'}/>
          </Sec>
          {canViewSensitive&&emp.emergency_contact_name&&(
            <Sec title="Emergency Contact">
              <R label="Name" value={emp.emergency_contact_name}/>
              {emp.emergency_contact_phone&&<R label="Phone" value={emp.emergency_contact_phone}/>}
              {emp.emergency_contact_relation&&<R label="Relation" value={emp.emergency_contact_relation}/>}
            </Sec>
          )}
        </div>
        {canEdit&&(
          <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',gap:'10px',flexShrink:0}}>
            <button style={{flex:1,height:'44px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',color:'var(--accent)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="edit" size={15}/>EDIT</button>
            <button style={{flex:1,height:'44px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="flag" size={15}/>ISSUE</button>
          </div>
        )}
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
