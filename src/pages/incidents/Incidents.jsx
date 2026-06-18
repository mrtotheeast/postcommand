import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import { isOwnDataOnly } from '../../lib/scoping'
import { isNative } from '../../lib/platform'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const INCIDENT_TYPES = [
  'Trespass','Theft','Vandalism','Assault','Disturbance','Suspicious Person',
  'Suspicious Vehicle','Medical Emergency','Fire / Smoke','Accident',
  'Arrest / Detainment','Drug / Alcohol Related','Weapon Observed',
  'Property Damage','Unauthorized Access','Noise Complaint','Traffic Incident',
  'Lost / Found Property','Welfare Check','Other',
]

const STATUS_STYLES = {
  draft:     { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  submitted: { bg:'rgba(91,159,224,0.15)',  color:'#5b9fe0', label:'Submitted' },
  reviewed:  { bg:'rgba(232,148,58,0.15)',  color:'#e8943a', label:'Reviewed' },
  approved:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Approved' },
  void:      { bg:'rgba(224,85,85,0.15)',   color:'#e05555', label:'Void' },
}

const selStyle = { padding:'0 10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'12px', height:'44px', cursor:'pointer', minWidth:'130px' }

function generateCAD() {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const n = Math.floor(1000 + Math.random() * 9000)
  return `PC-${d}-${n}`
}
const inp = { width:'100%', padding:'10px 12px', background:'var(--bg-input)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'13px', outline:'none', boxSizing:'border-box', height:'44px' }
const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', display:'block', marginBottom:'6px' }
const ta  = { ...inp, height:'auto', resize:'vertical', lineHeight:1.5, padding:'10px 12px' }

export default function Incidents() {
  const { profile } = useAuth()
  const isMobile = window.innerWidth < 640
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType]     = useState('all')
  const [search, setSearch]             = useState('')
  const canReview  = atLeast(profile?.role, 'sergeant')
  const canApprove = atLeast(profile?.role, 'lieutenant')
  const canVoid    = atLeast(profile?.role, 'chief')
  const canDelete  = atLeast(profile?.role, 'chief')
  const canAnalyze = atLeast(profile?.role, 'lieutenant')
  const [mainTab, setMainTab] = useState('reports')
  const isOfficer = isOwnDataOnly(profile?.role)
  const [employees, setEmployees] = useState([])
  const [searchEmp, setSearchEmp] = useState(null)

  useEffect(() => { loadReports() }, [profile?.company_id, profile?.role])

  async function loadReports() {
    if (!profile?.company_id) return
    setLoading(true)
    let q = supabase.from('incident_report').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false })
    if (!atLeast(profile?.role, 'lieutenant')) {
      q = q.or('is_confidential.is.null,is_confidential.eq.false')
    }
    const [{ data: reportData }, { data: empData }] = await Promise.all([
      q,
      supabase.from('employee').select('id,first_name,last_name').eq('company_id', profile.company_id).eq('status', 'active').order('last_name'),
    ])
    setReports(reportData || [])
    setEmployees(empData || [])
    setLoading(false)
  }

  const isViewingOthers = isOfficer && searchEmp !== null && !canApprove
  const filtered = useMemo(() => reports.filter(r => {
    if (isOfficer) {
      const targetId = searchEmp || profile.employee_id
      if (targetId && r.employee_id !== targetId) return false
    }
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchType   = filterType === 'all' || r.incident_type === filterType
    const matchSearch = !search || r.cad_number?.toLowerCase().includes(search.toLowerCase()) || r.incident_type?.toLowerCase().includes(search.toLowerCase()) || r.narrative?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchType && matchSearch
  }), [reports, filterStatus, filterType, search, isOfficer, searchEmp, profile.employee_id])

  const stats = useMemo(() => ({
    total:     reports.length,
    submitted: reports.filter(r => r.status === 'submitted').length,
    approved:  reports.filter(r => r.status === 'approved').length,
    thisMonth: reports.filter(r => { const d=new Date(r.created_at),n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear() }).length,
  }), [reports])

  return (
    <div style={{padding:isMobile?'12px':'24px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>INCIDENT REPORTS</h2>
          <p style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>{reports.length} total · 3-year retention</p>
          <div style={{display:'flex',gap:'2px',marginTop:'10px'}}>
            {[['reports','Reports'],...(canAnalyze?[['analysis','AI Analysis']]:[])]
              .map(([v,l])=>(<button key={v} onClick={()=>setMainTab(v)} style={{padding:'6px 14px',fontSize:'12px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px',borderBottom:`2px solid ${mainTab===v?'var(--accent)':'transparent'}`,color:mainTab===v?'var(--accent)':'var(--text-muted)',transition:'all 150ms ease',fontWeight:mainTab===v?700:400}}>{l}</button>))}
          </div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{display:'flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-md)',padding:'0 20px',height:'44px',fontFamily:'var(--font-condensed)',fontSize:'14px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>
          <Icon name="plus" size={16}/>NEW REPORT
        </button>
      </div>
      {mainTab==='analysis' && <AIIncidentAnalysis reports={reports} companyId={profile?.company_id} />}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'10px',marginBottom:'20px'}}>
        {[{label:'Total',value:stats.total,color:'var(--text-primary)'},{label:'This Month',value:stats.thisMonth,color:'var(--color-info)'},{label:'Pending Review',value:stats.submitted,color:'var(--color-warning)'},{label:'Approved',value:stats.approved,color:'var(--color-success)'}].map(s=>(
          <div key={s.label} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 16px'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>{s.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'26px',letterSpacing:'1px',color:s.color,lineHeight:1}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:'200px'}}>
          <Icon name="search" size={15} color="var(--text-muted)" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
          <input type="search" placeholder="Search CAD #, type, narrative..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',padding:'10px 12px 10px 36px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',height:'44px'}}
            onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
        </div>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
          <option value="all">All Status</option>
          {Object.entries(STATUS_STYLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={selStyle}>
          <option value="all">All Types</option>
          {INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {isOfficer && employees.length > 1 && (
          <select value={searchEmp || ''} onChange={e=>setSearchEmp(e.target.value||null)} style={selStyle}>
            <option value="">My Reports</option>
            {employees.filter(e=>e.id!==profile.employee_id).map(e=>(
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{[...Array(4)].map((_,i)=><div key={i} style={{height:'80px',borderRadius:'10px'}} className="skeleton"/>)}</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 24px',color:'var(--text-muted)'}}><Icon name="file-check" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px',fontSize:'15px'}}>No reports found</div></div>
      ) : (
        <div style={{overflowX:isMobile?'auto':'visible'}}>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden',minWidth:isMobile?'560px':'auto'}}>
          {filtered.map((report,i)=><ReportRow key={report.id} report={report} isLast={i===filtered.length-1} onClick={()=>setSelected(report)}/>)}
        </div>
        </div>
      )}

      {showForm && <IncidentForm profile={profile} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);loadReports()}}/>}
      {selected && <ReportDetail report={selected} canReview={canReview} canApprove={canApprove} canVoid={canVoid} canDelete={canDelete} profile={profile} onClose={()=>setSelected(null)} onUpdated={()=>{setSelected(null);loadReports()}} isViewingOthers={isViewingOthers}/>}
    </div>
  )
}function ReportRow({report,isLast,onClick}) {
  const ss=STATUS_STYLES[report.status]||STATUS_STYLES.draft
  const [hover,setHover]=useState(false)
  return (
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'grid',gridTemplateColumns:'130px 1fr 160px 100px 36px',padding:'14px 16px',borderBottom:isLast?'none':'1px solid var(--border)',background:hover?'var(--bg-card-hover)':'transparent',border:'none',width:'100%',cursor:'pointer',textAlign:'left',alignItems:'center',gap:'12px'}}>
      <div>
        <div style={{fontSize:'13px',fontWeight:700,color:'var(--accent)',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px'}}>{report.cad_number||'—'}</div>
        <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{new Date(report.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
      </div>
      <div>
        <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>{report.incident_type}</div>
        <div style={{fontSize:'12px',color:'var(--text-secondary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'400px'}}>{report.narrative?.slice(0,100)}{report.narrative?.length>100?'...':''}</div>
      </div>
      <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>{report.occurred_at?new Date(report.occurred_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'4px',alignItems:'flex-start'}}>
        <span style={{fontSize:'11px',fontWeight:700,padding:'3px 10px',borderRadius:'10px',background:ss.bg,color:ss.color,display:'inline-block',whiteSpace:'nowrap'}}>{ss.label}</span>
        {report.is_confidential&&<span style={{fontSize:'10px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:'rgba(224,85,85,0.15)',color:'#e05555',display:'inline-block',whiteSpace:'nowrap',letterSpacing:'0.5px'}}>CONF/IA</span>}
      </div>
      <Icon name="chevron-right" size={14} color="var(--text-muted)"/>
    </button>
  )
}

const NPS_COMPANY_ID = '9af02c98-04f3-4dbd-9f7e-07e7f9bbdc6c'
const BODY_PARTS = ['Head','Neck','Chest/Torso','Back','Left Arm','Right Arm','Left Hand','Right Hand','Left Leg','Right Leg','Left Foot','Right Foot','Multiple','Other']
const WEAPON_TYPES = ['Firearm','Knife/Blade','Blunt Object','Improvised Weapon','Hands/Feet','Taser/Stun Gun','Pepper Spray','Other']

function IncidentForm({profile,onClose,onSaved}) {
  const toast = useToast()
  const [mode,setMode]   = useState('guided')
  const [step,setStep]   = useState(0)
  const [aiLoading,setAiLoading] = useState(false)
  const [saving,setSaving] = useState(false)
  const [cadNumber] = useState(() => generateCAD())
  const [error,setError]   = useState(null)
  const [sites,setSites]   = useState([])
  const [employees,setEmployees] = useState([])
  const [form,setForm] = useState({
    incident_type:'',occurred_at:'',site_id:'',location_detail:'',
    officers_involved:[],
    // Suspect
    suspect_involved:false,subject_name:'',subject_description:'',
    suspect_height:'',suspect_weight:'',suspect_clothing:'',suspect_direction:'',suspect_vehicle:'',
    // Injuries
    injuries:false,injury_body_part:'',injury_detail:'',
    // Emergency services
    police_notified:false,police_agency:'',police_report_number:'',
    ems_called:false,ems_unit:'',ems_hospital:'',
    fire_called:false,fire_unit:'',
    // Property / weapons
    property_damage:false,damage_detail:'',damage_value:'',
    weapons_involved:false,weapon_type:'',weapons_detail:'',
    witnesses:'',evidence:'',
    // Narrative & guided questions
    narrative:'',q_what:'',q_who:'',q_where:'',q_when:'',q_how:'',q_result:'',
    is_confidential:false
  })
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))

  useEffect(()=>{
    if (!profile?.company_id) return
    supabase.from('site').select('id,name,address,city,state')
      .eq('company_id',profile.company_id)
      .eq('is_active',true)
      .order('name')
      .then(({data})=>setSites(data||[]))
    supabase.from('employee').select('id,first_name,last_name')
      .eq('company_id',profile.company_id)
      .eq('status','active')
      .or('invitation_status.eq.accepted,has_app_access.eq.true')
      .order('last_name')
      .then(({data})=>setEmployees(data||[]))
  },[profile?.company_id])

  async function generateNarrative() {
    if(!form.q_what||!form.q_where||!form.q_when){setError('Please answer What, Where, and When first.');return}
    setAiLoading(true);setError(null)
    try {
      const policeInfo=form.police_notified?'Yes'+(form.police_agency?' ('+form.police_agency+')':''):'No'
      const suspectInfo=form.suspect_involved?(form.subject_name||'Unknown')+(form.suspect_clothing?' wearing '+form.suspect_clothing:''):'None identified'
      const prompt='You are a professional security report writer. Write a formal, factual incident report narrative in third person, past tense, using clear law enforcement style language. Write only the narrative paragraphs, no headers or labels.\n\nIncident details:\n- What happened: '+form.q_what+'\n- Who was involved: '+(form.q_who||'Not specified')+'\n- Where: '+form.q_where+'\n- When: '+form.q_when+'\n- How it unfolded: '+(form.q_how||'Not specified')+'\n- Outcome: '+(form.q_result||'Not specified')+'\n- Incident type: '+(form.incident_type||'General incident')+'\n- Property damage: '+(form.property_damage?'Yes'+(form.damage_detail?' - '+form.damage_detail:''):'None reported')+'\n- Weapons: '+(form.weapons_involved?'Yes'+(form.weapons_detail?' - '+form.weapons_detail:''):'None')+'\n- Witnesses: '+(form.witnesses||'None noted')+'\n- Evidence: '+(form.evidence||'None noted')+'\n- Injuries: '+(form.injuries?'Yes'+(form.injury_detail?' - '+form.injury_detail:''):'None reported')+'\n- Police notified: '+policeInfo+'\n- EMS called: '+(form.ems_called?'Yes':'No')+'\n- Suspect: '+suspectInfo+'\n\nWrite a professional 2-4 paragraph narrative.'
      const {data,error:fnErr}=await supabase.functions.invoke('ai-assistant',{body:{messages:[{role:'user',content:prompt}]}})
      if(fnErr)throw fnErr
      set('narrative',data.content?.[0]?.text||'')
      setStep(3)
    } catch(e){setError('AI generation failed. Please write manually.')}
    setAiLoading(false)
  }

  async function polishNarrative() {
    if(!form.narrative.trim()){setError('Write a narrative first.');return}
    setAiLoading(true);setError(null)
    try {
      const prompt=`You are a professional security report editor. Rewrite the following incident report narrative to be formal, factual, and professional using law enforcement style language in third person, past tense. Return only the improved narrative.\n\nOriginal:\n${form.narrative}`
      const {data,error:fnErr}=await supabase.functions.invoke('ai-assistant',{body:{messages:[{role:'user',content:prompt}]}})
      if(fnErr)throw fnErr
      set('narrative',data.content?.[0]?.text||form.narrative)
    } catch(e){setError('AI polish failed.')}
    setAiLoading(false)
  }

  async function submit(asDraft=false) {
    if(!form.incident_type){setError('Incident type required.');return}
    if(!form.occurred_at){setError('Date and time required.');return}
    if(!form.narrative.trim()){setError('Narrative required.');return}
    setSaving(true);setError(null)
    let ok = false
    try {
      const now=new Date()
      const yy=String(now.getFullYear()).slice(2)
      const mm=String(now.getMonth()+1).padStart(2,'0')
      const month=`${yy}${mm}`
      const retainUntil=new Date(now); retainUntil.setFullYear(retainUntil.getFullYear()+3)
      const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
      const {error:insErr}=await supabase.from('incident_report').insert({
        company_id:profile.company_id,site_id:form.site_id||null,employee_id:empData?.id||null,
        cad_number:cadNumber,report_month:month,incident_type:form.incident_type,
        occurred_at:form.occurred_at,location_detail:form.location_detail||null,
        officers_involved:form.officers_involved.length?form.officers_involved:null,
        subject_name:form.subject_name||null,subject_description:form.subject_description||null,
        suspect_height:form.suspect_height||null,suspect_weight:form.suspect_weight||null,
        suspect_clothing:form.suspect_clothing||null,suspect_direction:form.suspect_direction||null,
        suspect_vehicle:form.suspect_vehicle||null,
        narrative:form.narrative,
        injuries:form.injuries,injury_body_part:form.injury_body_part||null,injury_detail:form.injury_detail||null,
        property_damage:form.property_damage,damage_detail:form.damage_detail||null,
        damage_value:form.damage_value?parseFloat(form.damage_value):null,
        weapons_involved:form.weapons_involved,weapon_type:form.weapon_type||null,weapons_detail:form.weapons_detail||null,
        police_notified:form.police_notified,police_agency:form.police_agency||null,police_report_number:form.police_report_number||null,
        ems_called:form.ems_called,ems_unit:form.ems_unit||null,ems_hospital:form.ems_hospital||null,
        fire_called:form.fire_called,fire_unit:form.fire_unit||null,
        witnesses:form.witnesses||null,evidence:form.evidence||null,
        is_confidential:form.is_confidential||false,
        status:asDraft?'draft':'submitted',submitted_at:asDraft?null:now.toISOString(),
        submitted_by:asDraft?null:(empData?.id||null),retain_until:retainUntil.toISOString().split('T')[0]
      })
      if(insErr){setError(insErr.message);return}
      toast('Incident report saved')
      if (!asDraft) {
        supabase.functions.invoke('send-push', {
          body: { company_id: profile.company_id, type: 'incident_submitted', title: 'New Incident Report', body: `${form.incident_type} submitted`, target_roles: ['lieutenant', 'chief', 'super_admin'] }
        }).catch(() => {})
      }
      ok = true
    } catch(e){setError(e.message)}
    finally {
      setSaving(false)
      if (ok) onSaved()
    }
  }

  const STEPS=[{title:'Basic Info',sub:'Incident type and time'},{title:'Guided Questions',sub:'Answer questions for AI'},{title:'Additional Details',sub:'Injuries, damage, weapons, police'},{title:'Narrative',sub:'AI writes your report — review and edit'}]

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(600px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:201,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div><div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)'}}>NEW INCIDENT REPORT</div><div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>Report will be saved with the CAD number shown above</div></div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{padding:'12px 24px',borderBottom:'1px solid var(--border)',display:'flex',gap:'8px',flexShrink:0,alignItems:'center'}}>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {[['guided','AI Guided'],['freeform','Write Directly']].map(([v,l])=>(
              <button key={v} onClick={()=>setMode(v)} style={{padding:'0 14px',height:'32px',minHeight:'36px',border:'none',borderRadius:'4px',background:mode===v?'var(--accent-bg)':'transparent',color:mode===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'12px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>
            ))}
          </div>
          {mode==='guided'&&<div style={{fontSize:'12px',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:'6px'}}><Icon name="star" size={13} color="var(--accent)"/>AI writes your narrative</div>}
        </div>
        {mode==='guided'&&<div style={{padding:'10px 24px',borderBottom:'1px solid var(--border)',display:'flex',gap:'4px',flexShrink:0}}>{STEPS.map((_,i)=><div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background:i<=step?'var(--accent)':'var(--border)'}}/>)}</div>}

        <div style={{flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:'16px'}}>
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'10px 16px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>CAD NUMBER</span>
            <span style={{fontSize:'15px',fontWeight:700,color:'var(--accent)',fontFamily:'var(--font-condensed)',letterSpacing:'2px'}}>{cadNumber}</span>
          </div>
          {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:'13px',color:'var(--color-danger)'}}>{error}</div>}

          {mode==='guided'&&<>
            <div><div style={{fontSize:'14px',fontWeight:700,color:'var(--text-primary)',marginBottom:'2px'}}>{STEPS[step]?.title}</div><div style={{fontSize:'12px',color:'var(--text-muted)'}}>{STEPS[step]?.sub}</div></div>

            {step===0&&<>
              <div><label style={lbl}>Incident Type *</label><select value={form.incident_type} onChange={e=>set('incident_type',e.target.value)} style={inp}><option value="">Select...</option>{INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={lbl}>Date & Time *</label><input type="datetime-local" value={form.occurred_at} onChange={e=>set('occurred_at',e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Site</label><select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}><option value="">{sites.length===0?'No sites available — add in Site Management':'Select site...'}</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label style={lbl}>Specific Location</label><input type="text" value={form.location_detail} onChange={e=>set('location_detail',e.target.value)} placeholder="e.g. North parking lot..." style={inp}/></div>
              {employees.length>0&&<div>
                <label style={lbl}>Officers Involved</label>
                <div style={{background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'8px 12px',maxHeight:'140px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'6px'}}>
                  {employees.map(e=>(
                    <label key={e.id} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer'}}>
                      <input type="checkbox" checked={form.officers_involved.includes(e.id)}
                        onChange={ev=>{const ids=form.officers_involved;set('officers_involved',ev.target.checked?[...ids,e.id]:ids.filter(i=>i!==e.id))}}
                        style={{accentColor:'var(--accent)',width:'15px',height:'15px'}}/>
                      {e.first_name} {e.last_name}
                    </label>
                  ))}
                </div>
              </div>}
            </>}

            {step===1&&<>
              <GQ label="What happened? *" hint="Describe in your own words" value={form.q_what} onChange={v=>set('q_what',v)}/>
              <GQ label="Who was involved?" hint="Names, descriptions, roles" value={form.q_who} onChange={v=>set('q_who',v)}/>
              <GQ label="Where exactly? *" hint="Specific location details" value={form.q_where} onChange={v=>set('q_where',v)}/>
              <GQ label="When did it happen? *" hint="Time and sequence" value={form.q_when} onChange={v=>set('q_when',v)}/>
              <GQ label="How did it unfold?" hint="Sequence of actions" value={form.q_how} onChange={v=>set('q_how',v)}/>
              <GQ label="What was the outcome?" hint="Resolution, arrests, medical" value={form.q_result} onChange={v=>set('q_result',v)}/>
              <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'8px'}}>Additional Details (included in narrative)</div>
                <BF label="Property damage?" checked={form.property_damage} onChange={v=>set('property_damage',v)}/>
                {form.property_damage&&<>
                  <div style={{marginTop:'6px'}}><label style={lbl}>Damage Description</label><textarea value={form.damage_detail} onChange={e=>set('damage_detail',e.target.value)} rows={2} style={ta}/></div>
                </>}
                <BF label="Weapons involved?" checked={form.weapons_involved} onChange={v=>set('weapons_involved',v)}/>
                {form.weapons_involved&&<>
                  <div style={{marginTop:'6px'}}><label style={lbl}>Weapon Details</label><textarea value={form.weapons_detail} onChange={e=>set('weapons_detail',e.target.value)} rows={2} style={ta}/></div>
                </>}
                <div style={{marginTop:'6px'}}><label style={lbl}>Witnesses</label><textarea value={form.witnesses} onChange={e=>set('witnesses',e.target.value)} rows={2} style={ta} placeholder="Names, contact info..."/></div>
                <div style={{marginTop:'6px'}}><label style={lbl}>Evidence</label><textarea value={form.evidence} onChange={e=>set('evidence',e.target.value)} rows={2} style={ta} placeholder="Video footage, photos, items..."/></div>
              </div>
            </>}

            {step===3&&<>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                <label style={{...lbl,margin:0}}>Narrative *</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={generateNarrative} disabled={aiLoading} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',color:'var(--accent)',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:700,cursor:'pointer',padding:'0 10px',height:'32px'}}><Icon name="star" size={13}/>{aiLoading?'GENERATING...':'GENERATE'}</button>
                  {form.narrative&&<button onClick={polishNarrative} disabled={aiLoading} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:700,cursor:'pointer',padding:'0 10px',height:'32px'}}><Icon name="edit" size={13}/>{aiLoading?'...':'POLISH'}</button>}
                </div>
              </div>
              {aiLoading&&<div style={{background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',padding:'12px 16px',fontSize:'13px',color:'var(--accent)',display:'flex',alignItems:'center',gap:'10px'}}><Icon name="star" size={15}/>AI is writing your report...</div>}
              <textarea value={form.narrative} onChange={e=>set('narrative',e.target.value)} rows={10} placeholder="Narrative will appear here after generation..." style={{...ta,minHeight:'200px'}}/>
              <div style={{fontSize:'11px',color:'var(--text-muted)',padding:'8px 12px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>Review carefully. You are responsible for accuracy.</div>
            </>}

            {step===2&&<>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px'}}>Injuries</div>
              <BF label="Were there injuries?" checked={form.injuries} onChange={v=>set('injuries',v)}/>
              {form.injuries&&<>
                <div><label style={lbl}>Body Part Affected</label><select value={form.injury_body_part} onChange={e=>set('injury_body_part',e.target.value)} style={inp}><option value="">Select...</option>{BODY_PARTS.map(p=><option key={p}>{p}</option>)}</select></div>
                <div><label style={lbl}>Injury Description</label><textarea value={form.injury_detail} onChange={e=>set('injury_detail',e.target.value)} rows={2} style={ta}/></div>
              </>}

              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px',marginTop:'8px'}}>Emergency Services</div>
              <BF label="Police/Law Enforcement notified?" checked={form.police_notified} onChange={v=>set('police_notified',v)}/>
              {form.police_notified&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <div><label style={lbl}>Responding Agency</label><input value={form.police_agency} onChange={e=>set('police_agency',e.target.value)} style={inp} placeholder="City PD, County Sheriff..."/></div>
                <div><label style={lbl}>Police Report #</label><input value={form.police_report_number} onChange={e=>set('police_report_number',e.target.value)} style={inp}/></div>
              </div>}
              <BF label="EMS / Medical called?" checked={form.ems_called} onChange={v=>set('ems_called',v)}/>
              {form.ems_called&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <div><label style={lbl}>EMS Unit #</label><input value={form.ems_unit} onChange={e=>set('ems_unit',e.target.value)} style={inp}/></div>
                <div><label style={lbl}>Hospital (if transported)</label><input value={form.ems_hospital} onChange={e=>set('ems_hospital',e.target.value)} style={inp}/></div>
              </div>}
              <BF label="Fire Department called?" checked={form.fire_called} onChange={v=>set('fire_called',v)}/>
              {form.fire_called&&<div><label style={lbl}>Fire Unit #</label><input value={form.fire_unit} onChange={e=>set('fire_unit',e.target.value)} style={inp}/></div>}

              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px',marginTop:'8px'}}>Suspect</div>
              <BF label="Suspect involved?" checked={form.suspect_involved} onChange={v=>set('suspect_involved',v)}/>
              {form.suspect_involved&&<>
                <div><label style={lbl}>Name (if known)</label><input value={form.subject_name} onChange={e=>set('subject_name',e.target.value)} style={inp}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <div><label style={lbl}>Height</label><input value={form.suspect_height} onChange={e=>set('suspect_height',e.target.value)} style={inp} placeholder={'5\'10"'}/></div>
                  <div><label style={lbl}>Weight</label><input value={form.suspect_weight} onChange={e=>set('suspect_weight',e.target.value)} style={inp} placeholder="180 lbs"/></div>
                </div>
                <div><label style={lbl}>Clothing Description</label><textarea value={form.suspect_clothing} onChange={e=>set('suspect_clothing',e.target.value)} rows={2} style={ta} placeholder="Black hoodie, blue jeans..."/></div>
                <div><label style={lbl}>Additional Description</label><textarea value={form.subject_description} onChange={e=>set('subject_description',e.target.value)} rows={2} style={ta}/></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                  <div><label style={lbl}>Direction of Travel</label><input value={form.suspect_direction} onChange={e=>set('suspect_direction',e.target.value)} style={inp} placeholder="Northbound on Main St."/></div>
                  <div><label style={lbl}>Vehicle</label><input value={form.suspect_vehicle} onChange={e=>set('suspect_vehicle',e.target.value)} style={inp} placeholder="Blue 4-door sedan, plate..."/></div>
                </div>
              </>}

              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'4px',marginTop:'8px'}}>Property & Weapons</div>
              <BF label="Property damage?" checked={form.property_damage} onChange={v=>set('property_damage',v)}/>
              {form.property_damage&&<>
                <div><label style={lbl}>Damage Description</label><textarea value={form.damage_detail} onChange={e=>set('damage_detail',e.target.value)} rows={2} style={ta}/></div>
                <div><label style={lbl}>Estimated Value ($)</label><input type="number" min="0" value={form.damage_value} onChange={e=>set('damage_value',e.target.value)} style={inp} placeholder="0.00"/></div>
              </>}
              <BF label="Weapons involved?" checked={form.weapons_involved} onChange={v=>set('weapons_involved',v)}/>
              {form.weapons_involved&&<>
                <div><label style={lbl}>Weapon Type</label><select value={form.weapon_type} onChange={e=>set('weapon_type',e.target.value)} style={inp}><option value="">Select...</option>{WEAPON_TYPES.map(w=><option key={w}>{w}</option>)}</select></div>
                <div><label style={lbl}>Weapon Details</label><textarea value={form.weapons_detail} onChange={e=>set('weapons_detail',e.target.value)} rows={2} style={ta}/></div>
              </>}
              <div><label style={lbl}>Witnesses</label><textarea value={form.witnesses} onChange={e=>set('witnesses',e.target.value)} rows={2} style={ta} placeholder="Names, contact info..."/></div>
              <div><label style={lbl}>Evidence</label><textarea value={form.evidence} onChange={e=>set('evidence',e.target.value)} rows={2} style={ta} placeholder="Video footage, photos, items..."/></div>

            </>}
          </>}

          {mode==='freeform'&&<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              <div><label style={lbl}>Incident Type *</label><select value={form.incident_type} onChange={e=>set('incident_type',e.target.value)} style={inp}><option value="">Select...</option>{INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={lbl}>Date & Time *</label><input type="datetime-local" value={form.occurred_at} onChange={e=>set('occurred_at',e.target.value)} style={inp}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              <div><label style={lbl}>Site</label><select value={form.site_id} onChange={e=>set('site_id',e.target.value)} style={inp}><option value="">Select...</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label style={lbl}>Location Detail</label><input type="text" value={form.location_detail} onChange={e=>set('location_detail',e.target.value)} style={inp}/></div>
            </div>
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                <label style={{...lbl,margin:0}}>Narrative *</label>
                <button onClick={polishNarrative} disabled={aiLoading||!form.narrative.trim()} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',color:'var(--accent)',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:700,cursor:'pointer',padding:'0 10px',height:'32px',opacity:!form.narrative.trim()?0.5:1}}><Icon name="star" size={13}/>{aiLoading?'POLISHING...':'AI POLISH'}</button>
              </div>
              <textarea value={form.narrative} onChange={e=>set('narrative',e.target.value)} rows={8} placeholder="Write your incident narrative here..." style={{...ta,minHeight:'180px'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              <div><label style={lbl}>Subject Name</label><input type="text" value={form.subject_name} onChange={e=>set('subject_name',e.target.value)} style={inp}/></div>
              <div><label style={lbl}>Police Report #</label><input type="text" value={form.police_report_number} onChange={e=>set('police_report_number',e.target.value)} style={inp}/></div>
            </div>
            <BF label="Injuries" checked={form.injuries} onChange={v=>set('injuries',v)}/>
            <BF label="Property Damage" checked={form.property_damage} onChange={v=>set('property_damage',v)}/>
            <BF label="Weapons Involved" checked={form.weapons_involved} onChange={v=>set('weapons_involved',v)}/>
            <BF label="Law Enforcement Notified" checked={form.police_notified} onChange={v=>set('police_notified',v)}/>
            <div><label style={lbl}>Witnesses</label><textarea value={form.witnesses} onChange={e=>set('witnesses',e.target.value)} rows={2} style={ta}/></div>
            <div><label style={lbl}>Evidence</label><textarea value={form.evidence} onChange={e=>set('evidence',e.target.value)} rows={2} style={ta}/></div>
          </>}
        </div>

        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',flexShrink:0}}>
          {mode==='guided'?(
            <div style={{display:'flex',gap:'10px'}}>
              {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>BACK</button>}
              {step<3?<button onClick={()=>{setError(null);setStep(s=>s+1)}} style={{flex:2,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>NEXT</button>:(
                <div style={{flex:2,display:'flex',gap:'8px'}}>
                  <button onClick={()=>submit(true)} disabled={saving} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>DRAFT</button>
                  <button onClick={()=>submit(false)} disabled={saving} style={{flex:2,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>{saving?'SUBMITTING...':'SUBMIT'}</button>
                </div>
              )}
            </div>
          ):(
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={onClose} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>CANCEL</button>
              <button onClick={()=>submit(true)} disabled={saving} style={{flex:1,height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>DRAFT</button>
              <button onClick={()=>submit(false)} disabled={saving} style={{flex:2,height:'44px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-md)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>{saving?'SUBMITTING...':'SUBMIT'}</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}function ReportDetail({report,canReview,canApprove,canVoid,canDelete,onClose,onUpdated,profile,isViewingOthers}) {
  const toast = useToast()
  const ss=STATUS_STYLES[report.status]||STATUS_STYLES.draft
  const [notes,setNotes]=useState('')
  const [voidReason,setVoidReason]=useState('')
  const [saving,setSaving]=useState(false)
  const [showVoid,setShowVoid]=useState(false)
  const [blurred,setBlurred]=useState(false)
  const openedAt = useRef(new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))
  const viewerName = (`${profile?.first_name||''} ${profile?.last_name||''}`).trim() || profile?.email || 'Viewer'

  useEffect(() => {
    if (!report.is_confidential) return
    const onHide = () => setBlurred(true)
    const onShow = () => setBlurred(false)
    const onVisibility = () => { document.hidden ? onHide() : onShow() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onHide)
    window.addEventListener('focus', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onHide)
      window.removeEventListener('focus', onShow)
    }
  }, [report.is_confidential])

  useEffect(() => {
    if (!report.is_confidential || !isNative()) return
    let cleanup = () => {}
    // @capacitor/screenshot-listener is not currently installed.
    // To enable: npm i @capacitor/screenshot-listener && npx cap sync
    ;(async () => {
      try {
        const { ScreenshotListener } = await import(/* @vite-ignore */ '@capacitor/screenshot-listener')
        const handle = await ScreenshotListener.addListener('screenshotTaken', () => {
          setBlurred(true)
          supabase.from('screenshot_audit_log').insert({
            company_id: profile.company_id,
            user_id: profile.id,
            incident_report_id: report.id,
            occurred_at: new Date().toISOString(),
          }).catch(() => {})
        })
        cleanup = () => handle.remove()
      } catch { /* plugin not installed — no-op until added */ }
    })()
    return () => cleanup()
  }, [report.id, report.is_confidential])

  async function shareReport() {
    const text = `PostCommand Incident Report\nCAD: ${report.cad_number}\nType: ${report.incident_type}\nFiled: ${new Date(report.created_at).toLocaleDateString()}`
    if (isNative()) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({
          title: `Incident Report — ${report.incident_type}`,
          text,
          dialogTitle: 'Share Incident Report',
        })
      } catch {}
    } else {
      try { navigator.clipboard.writeText(text) } catch {}
    }
  }

  async function updateStatus(status) {
    setSaving(true)
    try {
      const {data:empData}=await supabase.from('employee').select('id').eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle()
      const now=new Date().toISOString()
      const update={status}
      if(status==='reviewed'){update.reviewed_by=empData?.id;update.reviewed_at=now;update.reviewer_notes=notes}
      if(status==='approved'){update.approved_by=empData?.id;update.approved_at=now}
      if(status==='void'){update.voided_by=empData?.id;update.voided_at=now;update.void_reason=voidReason}
      const {error}=await supabase.from('incident_report').update(update).eq('id',report.id).eq('company_id',profile.company_id)
      if(error) throw error
      toast('Report updated', 'info')
      onUpdated()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReport() {
    if (!window.confirm('Permanently delete this report? This cannot be undone.')) return
    setSaving(true)
    try {
      const {error}=await supabase.from('incident_report').delete().eq('id', report.id).eq('company_id',profile.company_id)
      if(error) throw error
      onUpdated()
    } catch(e) {
      toast(e.message||'Something went wrong', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(520px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:101,display:'flex',flexDirection:'column'}}>
        {report.is_confidential && (
          <div aria-hidden style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:1,userSelect:'none'}}>
            {Array.from({length:12}).map((_,i)=>(
              <div key={i} style={{position:'absolute',top:`${i*9}%`,left:'-50%',width:'200%',transform:'rotate(-35deg)',fontSize:'11px',color:'var(--text-primary)',opacity:0.10,whiteSpace:'nowrap',fontFamily:'var(--font-condensed)',letterSpacing:'2px',lineHeight:'2.5'}}>
                {`${viewerName.toUpperCase()} · ${openedAt.current}  `.repeat(6)}
              </div>
            ))}
          </div>
        )}
        <div style={{padding:'18px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--accent)'}}>{report.cad_number}</div>
            <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{report.incident_type} · {new Date(report.created_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px',transition:'filter 200ms ease',filter:blurred?'blur(20px)':undefined}}>
          <div style={{display:'flex',gap:'8px',marginBottom:'20px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:ss.bg,color:ss.color}}>{ss.label.toUpperCase()}</span>
            {report.injuries&&<span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'var(--color-danger-bg)',color:'var(--color-danger)'}}>INJURIES</span>}
            {report.weapons_involved&&<span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'rgba(201,162,39,0.12)',color:'var(--accent)'}}>WEAPONS</span>}
            {report.police_notified&&<span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'var(--color-info-bg)',color:'var(--color-info)'}}>POLICE</span>}
            {report.is_confidential&&<span style={{fontSize:'12px',fontWeight:700,padding:'4px 12px',borderRadius:'10px',background:'rgba(224,85,85,0.15)',color:'#e05555'}}>CONFIDENTIAL / IA</span>}
          </div>
          {canApprove&&<button onClick={async()=>{await supabase.from('incident_report').update({is_confidential:!report.is_confidential}).eq('id',report.id).eq('company_id',profile.company_id);toast(report.is_confidential?'Confidential flag removed':'Marked confidential','info');onUpdated()}} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'16px',padding:'8px 14px',background:report.is_confidential?'rgba(224,85,85,0.12)':'var(--bg-card)',border:report.is_confidential?'1px solid rgba(224,85,85,0.3)':'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:report.is_confidential?'#e05555':'var(--text-secondary)',fontSize:'12px',fontFamily:'var(--font-condensed)',fontWeight:700,cursor:'pointer',letterSpacing:'0.5px'}}><Icon name="shield" size={13}/>{report.is_confidential?'REMOVE CONFIDENTIAL FLAG':'MARK CONFIDENTIAL / IA'}</button>}
          <DSec title="Incident Details">
            <DR l="CAD Number" v={report.cad_number}/>
            <DR l="Type" v={report.incident_type}/>
            <DR l="Occurred" v={report.occurred_at?new Date(report.occurred_at).toLocaleString():null}/>
            <DR l="Location" v={report.location_detail}/>
            <DR l="Subject" v={report.subject_name}/>
          </DSec>
          <DSec title="Narrative">
            <p style={{fontSize:'13px',color:'var(--text-primary)',lineHeight:1.7,margin:0,whiteSpace:'pre-wrap'}}>{report.narrative}</p>
          </DSec>
          {(report.injuries||report.property_damage||report.weapons_involved||report.police_notified)&&(
            <DSec title="Additional Details">
              {report.injuries&&<DR l="Injuries" v={report.injury_detail||'Yes'}/>}
              {report.property_damage&&<DR l="Property Damage" v={report.damage_detail||'Yes'}/>}
              {report.weapons_involved&&<DR l="Weapons" v={report.weapons_detail||'Yes'}/>}
              {report.police_notified&&<DR l="Police Report #" v={report.police_report_number||'Notified'}/>}
              {report.witnesses&&<DR l="Witnesses" v={report.witnesses}/>}
              {report.evidence&&<DR l="Evidence" v={report.evidence}/>}
            </DSec>
          )}
          <DSec title="Timeline">
            <DR l="Submitted" v={report.submitted_at?new Date(report.submitted_at).toLocaleString():null}/>
            <DR l="Reviewed" v={report.reviewed_at?new Date(report.reviewed_at).toLocaleString():null}/>
            <DR l="Approved" v={report.approved_at?new Date(report.approved_at).toLocaleString():null}/>
            <DR l="Retain Until" v={report.retain_until}/>
          </DSec>
          {report.reviewer_notes&&<DSec title="Reviewer Notes"><p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5,margin:0}}>{report.reviewer_notes}</p></DSec>}
          {report.status==='submitted'&&canReview&&(
            <DSec title="Review Notes">
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Optional notes for the officer..." style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',outline:'none'}}/>
            </DSec>
          )}
          {showVoid&&<DSec title="Void Reason">
            <textarea value={voidReason} onChange={e=>setVoidReason(e.target.value)} rows={2} placeholder="Reason for voiding..." style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',outline:'none'}}/>
            <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
              <button onClick={()=>setShowVoid(false)} style={{flex:1,height:'40px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700}}>CANCEL</button>
              <button onClick={()=>updateStatus('void')} disabled={saving||!voidReason.trim()} style={{flex:1,height:'40px',background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',cursor:'pointer',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700}}>CONFIRM VOID</button>
            </div>
          </DSec>}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
          {report.status==='submitted'&&canReview&&<button onClick={()=>updateStatus('reviewed')} disabled={saving} style={{height:'44px',background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-warning)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="eye" size={15}/>MARK REVIEWED</button>}
          {report.status==='reviewed'&&canApprove&&<button onClick={()=>updateStatus('approved')} disabled={saving} style={{height:'44px',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-success)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="check" size={15}/>APPROVE REPORT</button>}
          {canVoid&&report.status!=='void'&&!showVoid&&<button onClick={()=>setShowVoid(true)} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="x" size={15}/>VOID REPORT</button>}
          {canDelete && <button onClick={deleteReport} disabled={saving} style={{height:'44px',background:'transparent',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',color:'var(--color-danger)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="trash-2" size={15}/>DELETE REPORT</button>}
          {(report.status==='approved'||report.status==='submitted')&&!isViewingOthers&&<button onClick={shareReport} style={{height:'44px',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}><Icon name="send" size={15}/>SHARE</button>}
        </div>
      </div>
    </>
  )
}

function GQ({label,hint,value,onChange,rows=2}) {
  return <div><label style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'block',marginBottom:'3px'}}>{label}</label>{hint&&<div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'6px',fontStyle:'italic'}}>{hint}</div>}<textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',outline:'none'}}/></div>
}

function BF({label,checked,onChange}) {
  return <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)'}}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{width:'18px',height:'18px',accentColor:'var(--accent)',cursor:'pointer'}}/><span style={{fontSize:'13px',color:'var(--text-primary)'}}>{label}</span></div>
}

function DSec({title,children}) {
  return <div style={{marginBottom:'20px'}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px',paddingBottom:'6px',borderBottom:'1px solid var(--border)'}}>{title}</div><div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{children}</div></div>
}

function DR({l,v}) {
  if(!v) return null
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',fontSize:'13px',gap:'12px'}}><span style={{color:'var(--text-muted)',flexShrink:0}}>{l}</span><span style={{color:'var(--text-primary)',fontWeight:500,textAlign:'right',maxWidth:'70%',wordBreak:'break-word'}}>{v}</span></div>
}
// ── AI Incident Analysis ──────────────────────────────────────────────────────

function AIIncidentAnalysis({ reports, companyId }) {
  const KEY = `pc-ai-analysis-${companyId}`
  const [result, setResult]   = useState(() => { try { return JSON.parse(localStorage.getItem(KEY)||'null') } catch { return null } })
  const [running, setRunning] = useState(false)
  const [error,   setError]   = useState(null)

  const since90 = new Date(Date.now()-90*86400000).toISOString()
  const recentReports = reports.filter(r=>r.created_at>=since90)

  async function runAnalysis() {
    setRunning(true); setError(null)
    try {
      const byType = Object.entries(recentReports.reduce((a,r)=>{a[r.incident_type]=(a[r.incident_type]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,8)
      const byStatus = Object.entries(recentReports.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{}))
      const prompt = `You are a security operations analyst. Analyze this incident data and respond with a single valid JSON object (no markdown, no explanation) containing exactly:
- "topTypes": array of {type, count} objects sorted by count descending (max 8)
- "recommendations": array of 3 to 5 short actionable recommendation strings for a security operations team

Data (last 90 days, ${recentReports.length} total incidents):
Types: ${JSON.stringify(byType)}
Statuses: ${JSON.stringify(byStatus)}`

      const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role: 'user', content: prompt }] }
      })
      if (fnErr) throw fnErr
      const text = data?.content?.[0]?.text || ''
      let parsed
      try { parsed = JSON.parse(text) }
      catch {
        const m = text.match(/\{[\s\S]*\}/)
        parsed = m ? JSON.parse(m[0]) : null
      }
      if (!parsed?.topTypes) parsed = { topTypes: byType.map(([type,count])=>({type,count})), recommendations: [] }
      const saved = { topTypes: parsed.topTypes, recommendations: parsed.recommendations||[], timestamp: new Date().toISOString(), reportCount: recentReports.length }
      localStorage.setItem(KEY, JSON.stringify(saved))
      setResult(saved)
    } catch(e) {
      setError(e.message || 'Analysis failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{marginBottom:'24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
        <div>
          <div style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',textTransform:'uppercase',letterSpacing:'1px'}}>Analyzing {recentReports.length} incidents from last 90 days</div>
          {result?.timestamp && <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>Last run: {new Date(result.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
        </div>
        <button style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',padding:'0 18px',height:'40px',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:running?0.6:1}} onClick={runAnalysis} disabled={running}>
          <Icon name="cpu" size={14}/>{running?'ANALYZING...':'RUN ANALYSIS'}
        </button>
      </div>

      {error && (
        <div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'12px 16px',fontSize:'13px',color:'var(--color-danger)',marginBottom:'12px'}}>{error}</div>
      )}
      {!result ? (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'40px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>
          <Icon name="cpu" size={28} color="var(--text-muted)"/><div style={{marginTop:'10px'}}>Click "Run Analysis" to generate AI-powered insights from your incident data.</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'12px'}}>
          {result.topTypes?.length > 0 && (
            <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'18px'}}>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'12px'}}>Top Incident Types</div>
              {result.topTypes.map((t,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'13px'}}>
                  <span style={{color:'var(--text-primary)'}}>{t.type}</span>
                  <span style={{color:'var(--accent)',fontFamily:'var(--font-condensed)',fontWeight:700}}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
          {result.recommendations?.length > 0 && (
            <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'18px',gridColumn:'span 1'}}>
              <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'12px'}}>Recommendations</div>
              {result.recommendations.map((r,i)=>(
                <div key={i} style={{display:'flex',gap:'8px',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.5}}>
                  <span style={{color:'var(--accent)',flexShrink:0,fontWeight:700}}>{i+1}.</span><span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
