import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const CONTRACT_STATUS = { active:{label:'Active',color:'var(--color-success)',bg:'var(--color-success-bg)'}, expired:{label:'Expired',color:'var(--color-danger)',bg:'var(--color-danger-bg)'}, pending:{label:'Pending',color:'var(--color-warning)',bg:'var(--color-warning-bg)'} }
const ONBOARDING_STEPS = ['Contract Signed','Site Survey Complete','Post Orders Drafted','Staff Assigned','Go-Live Date Set','First Billing Invoice Sent']

const s = {
  page:    { padding:'24px', maxWidth:'1200px', animation:'fadeIn 200ms ease' },
  heading: { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:     { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  th:      { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 14px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  tr:      { borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 150ms ease' },
  td:      { padding:'12px 14px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  tdName:  { padding:'12px 14px', fontSize:'13px', color:'var(--text-primary)', fontWeight:600, verticalAlign:'middle' },
  pill:    { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  panel:   { position:'fixed', top:0, right:0, bottom:0, width:'min(520px,100vw)', background:'var(--bg-surface)', borderLeft:'1px solid var(--border)', zIndex:200, display:'flex', flexDirection:'column', overflow:'hidden', animation:'slideIn 200ms ease' },
  panelHead:{ padding:'18px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  panelBody:{ flex:1, overflowY:'auto' },
  tabRow:  { display:'flex', gap:'2px', padding:'0 20px', borderBottom:'1px solid var(--border)', flexShrink:0 },
  tab:     { padding:'10px 14px', fontSize:'12px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  tabAct:  { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' },
  modal:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'520px', boxShadow:'var(--shadow-modal)', flexShrink:0 },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
}

export default function ClientManagement() {
  const { profile } = useAuth()
  const [clients,    setClients]    = useState([])
  const [sites,      setSites]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [panelTab,   setPanelTab]   = useState('overview')
  const [showModal,  setShowModal]  = useState(false)
  const [editClient, setEditClient] = useState(null)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const [{ data:cl }, { data:si }] = await Promise.all([
      supabase.from('client').select('*').eq('company_id',profile.company_id).order('company_name'),
      supabase.from('site').select('id,name,client_id').eq('company_id',profile.company_id),
    ])
    setClients(cl||[]); setSites(si||[]); setLoading(false)
  }

  const filtered = useMemo(() => clients.filter(c => !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_name?.toLowerCase().includes(search.toLowerCase())), [clients,search])

  const clientSites = (id) => sites.filter(s=>s.client_id===id)

  if (loading) return <div style={{padding:'24px'}}>{[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px',marginBottom:'10px'}}/>)}</div>

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <h2 style={s.heading}>CLIENT MANAGEMENT</h2>
      <p style={s.sub}>Manage client accounts, contracts, and onboarding.</p>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
        <input style={s.inp} placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
        <button style={s.btn} onClick={()=>{setEditClient(null);setShowModal(true)}}><Icon name="plus" size={15}/>ADD CLIENT</button>
      </div>
      <div style={s.card}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['Company','Contact','Phone','Email','Sites','Status',''].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(c => {
              const cnt = clientSites(c.id).length
              const st  = CONTRACT_STATUS[c.contract_status||'active']
              return (
                <tr key={c.id} style={s.tr} onClick={()=>{setSelected(c);setPanelTab('overview')}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={s.tdName}>{c.company_name||'—'}</td>
                  <td style={s.td}>{c.contact_name||'—'}</td>
                  <td style={s.td}>{c.phone||'—'}</td>
                  <td style={s.td}>{c.email||'—'}</td>
                  <td style={s.td}>{cnt} site{cnt!==1?'s':''}</td>
                  <td style={s.td}><span style={{...s.pill,background:st.bg,color:st.color}}>{st.label}</span></td>
                  <td style={s.td} onClick={e=>e.stopPropagation()}>
                    <button style={{...s.ghost,height:'32px',padding:'0 10px',fontSize:'11px'}} onClick={e=>{e.stopPropagation();setEditClient(c);setShowModal(true)}}><Icon name="edit-2" size={12}/>EDIT</button>
                  </td>
                </tr>
              )
            })}
            {filtered.length===0 && <tr><td colSpan={7} style={{...s.td,textAlign:'center',padding:'32px',color:'var(--text-muted)'}}>No clients found.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:199}}/>
          <div style={s.panel}>
            <div style={s.panelHead}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>{selected.company_name}</div>
                <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{selected.contact_name} · {clientSites(selected.id).length} sites</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',minHeight:'44px',minWidth:'44px',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={18}/></button>
            </div>
            <div style={s.tabRow}>
              {['overview','onboarding','contracts'].map(t=>(
                <button key={t} style={{...s.tab,...(panelTab===t?s.tabAct:{})}} onClick={()=>setPanelTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            <div style={s.panelBody}>
              {panelTab==='overview' && <ClientOverview client={selected} sites={clientSites(selected.id)} />}
              {panelTab==='onboarding' && <ClientOnboarding client={selected} companyId={profile.company_id} />}
              {panelTab==='contracts' && <ClientContracts client={selected} companyId={profile.company_id} />}
            </div>
          </div>
        </>
      )}

      {showModal && <ClientFormModal client={editClient} companyId={profile.company_id} onClose={()=>{setShowModal(false);setEditClient(null)}} onSaved={()=>{setShowModal(false);setEditClient(null);load()}} />}
    </div>
  )
}

function ClientOverview({ client, sites }) {
  const fields = [
    {l:'Company',    v:client.company_name},
    {l:'Contact',    v:client.contact_name},
    {l:'Email',      v:client.email},
    {l:'Phone',      v:client.phone},
    {l:'Address',    v:client.address},
    {l:'Contract',   v:client.contract_status?.toUpperCase()},
    {l:'Notes',      v:client.notes},
  ]
  return (
    <div style={{padding:'16px 20px'}}>
      <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'12px'}}>Client Details</div>
      {fields.filter(f=>f.v).map(f=>(
        <div key={f.l} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:'13px'}}>
          <span style={{color:'var(--text-muted)',fontFamily:'var(--font-condensed)',fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.5px'}}>{f.l}</span>
          <span style={{color:'var(--text-primary)',maxWidth:'60%',textAlign:'right'}}>{f.v}</span>
        </div>
      ))}
      {sites.length > 0 && (
        <>
          <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',margin:'16px 0 10px'}}>Assigned Sites</div>
          {sites.map(s=><div key={s.id} style={{fontSize:'13px',color:'var(--text-secondary)',padding:'7px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'8px'}}><Icon name="map-pin" size={13} color="var(--accent)"/>{s.name}</div>)}
        </>
      )}
    </div>
  )
}

function ClientOnboarding({ client, companyId }) {
  const [steps,    setSteps]    = useState(() => Object.fromEntries(ONBOARDING_STEPS.map(s=>[s,{done:false,notes:''}])))
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  useEffect(() => {
    supabase.from('client_onboarding').select('*').eq('client_id',client.id).single()
      .then(({data}) => { if (data?.steps) setSteps(data.steps) })
      .finally(() => setLoading(false))
  }, [client.id])
  async function save() {
    setSaving(true)
    await supabase.from('client_onboarding').upsert({ client_id:client.id, company_id:companyId, steps, updated_at:new Date().toISOString() }, { onConflict:'client_id' })
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500)
  }
  const done = Object.values(steps).filter(v=>v.done).length
  const pct  = Math.round((done/ONBOARDING_STEPS.length)*100)
  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>
  return (
    <div style={{padding:'16px 20px'}}>
      <div style={{marginBottom:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:'var(--text-muted)',marginBottom:'6px'}}><span>Progress</span><span>{done}/{ONBOARDING_STEPS.length} steps — {pct}%</span></div>
        <div style={{height:'8px',background:'var(--border)',borderRadius:'4px',overflow:'hidden'}}><div style={{height:'100%',borderRadius:'4px',background:pct===100?'var(--color-success)':'var(--accent)',width:`${pct}%`,transition:'width 400ms ease'}}/></div>
      </div>
      {saved && <div style={{fontSize:'12px',color:'var(--color-success)',marginBottom:'10px',display:'flex',alignItems:'center',gap:'6px'}}><Icon name="check-circle" size={13}/>Saved.</div>}
      {ONBOARDING_STEPS.map(step=>(
        <div key={step} style={{borderBottom:'1px solid var(--border)',padding:'10px 0'}}>
          <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',marginBottom:steps[step]?.done?'8px':0}}>
            <input type="checkbox" checked={steps[step]?.done||false} onChange={e=>setSteps(p=>({...p,[step]:{...p[step],done:e.target.checked}}))} style={{width:'16px',height:'16px',accentColor:'var(--accent)',cursor:'pointer'}}/>
            <span style={{fontSize:'13px',color:steps[step]?.done?'var(--color-success)':'var(--text-primary)',fontWeight:500,textDecoration:steps[step]?.done?'line-through':'none'}}>{step}</span>
          </label>
          {steps[step]?.done && <input style={{marginLeft:'26px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'6px 10px',fontSize:'12px',color:'var(--text-primary)',outline:'none',width:'calc(100% - 26px)',fontFamily:'var(--font-body)'}} value={steps[step]?.notes||''} onChange={e=>setSteps(p=>({...p,[step]:{...p[step],notes:e.target.value}}))} placeholder="Notes..." onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>}
        </div>
      ))}
      <button style={{...s.btn,marginTop:'14px',opacity:saving?0.6:1}} onClick={save} disabled={saving}><Icon name="save" size={14}/>{saving?'SAVING...':'SAVE PROGRESS'}</button>
    </div>
  )
}

function ClientContracts({ client, companyId }) {
  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showNew,   setShowNew]   = useState(false)
  const [form,      setForm]      = useState({ title:'', file_url:'', start_date:'', end_date:'', value:'', auto_renewal:false, status:'active' })
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    supabase.from('client_contract').select('*').eq('client_id',client.id).order('created_at',{ascending:false})
      .then(({data})=>setContracts(data||[])).finally(()=>setLoading(false))
  }, [client.id])

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('client_contract').insert({ client_id:client.id, company_id:companyId, ...form, value:Number(form.value)||null })
    setSaving(false); setShowNew(false); setForm({title:'',file_url:'',start_date:'',end_date:'',value:'',auto_renewal:false,status:'active'})
    const {data} = await supabase.from('client_contract').select('*').eq('client_id',client.id).order('created_at',{ascending:false})
    setContracts(data||[])
  }

  const foc=e=>e.target.style.borderColor='var(--border-focus)'; const blr=e=>e.target.style.borderColor='var(--border)'

  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>

  return (
    <div style={{padding:'16px 20px'}}>
      {!showNew ? (
        <button style={{...s.btn,marginBottom:'14px',height:'36px',fontSize:'12px',padding:'0 14px'}} onClick={()=>setShowNew(true)}><Icon name="plus" size={13}/>ADD CONTRACT</button>
      ) : (
        <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
            <div><div style={s.lbl}>Title *</div><input style={s.inp} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="Service Agreement 2026"/></div>
            <div><div style={s.lbl}>Status</div><select style={{...s.inp,cursor:'pointer'}} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="active">Active</option><option value="pending">Pending</option><option value="expired">Expired</option></select></div>
            <div><div style={s.lbl}>Start Date</div><input type="date" style={s.inp} value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>End Date</div><input type="date" style={s.inp} value={form.end_date} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contract Value ($)</div><input type="number" style={s.inp} value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="0"/></div>
            <div><div style={s.lbl}>File URL</div><input style={s.inp} value={form.file_url} onChange={e=>setForm(p=>({...p,file_url:e.target.value}))} onFocus={foc} onBlur={blr} placeholder="https://..."/></div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)',cursor:'pointer',marginBottom:'12px'}}>
            <input type="checkbox" checked={form.auto_renewal} onChange={e=>setForm(p=>({...p,auto_renewal:e.target.checked}))} style={{accentColor:'var(--accent)',width:'16px',height:'16px'}}/>Auto-renewal
          </label>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{...s.btn,height:'36px',fontSize:'12px',padding:'0 14px',opacity:(!form.title.trim()||saving)?0.6:1}} onClick={save} disabled={!form.title.trim()||saving}>{saving?'SAVING...':'SAVE'}</button>
            <button style={{...s.ghost,height:'36px',fontSize:'12px',padding:'0 12px'}} onClick={()=>setShowNew(false)}>CANCEL</button>
          </div>
        </div>
      )}
      {contracts.length===0 ? <div style={{textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'13px'}}>No contracts on file.</div>
        : contracts.map((c,i)=>{
          const st = CONTRACT_STATUS[c.status||'active']
          return (
            <div key={c.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{c.title}</div>
                <span style={{...s.pill,background:st.bg,color:st.color}}>{st.label}</span>
              </div>
              <div style={{fontSize:'11px',color:'var(--text-muted)',display:'flex',gap:'14px',flexWrap:'wrap'}}>
                {c.start_date && <span>Start: {c.start_date}</span>}
                {c.end_date && <span>End: {c.end_date}</span>}
                {c.value && <span style={{color:'var(--accent)',fontWeight:600}}>$ {Number(c.value).toLocaleString()}</span>}
                {c.auto_renewal && <span style={{color:'var(--color-info)'}}>Auto-renew ✓</span>}
              </div>
              {c.file_url && <a href={c.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:'12px',color:'var(--accent)',display:'inline-flex',alignItems:'center',gap:'4px',marginTop:'8px',textDecoration:'none'}}><Icon name="external-link" size={11}/>View Contract</a>}
            </div>
          )
        })
      }
    </div>
  )
}

function ClientFormModal({ client, companyId, onClose, onSaved }) {
  const toast = useToast()
  // step is only used in create mode: 'client' | 'site' | 'done'
  const [step, setStep] = useState('client')
  const [form, setForm] = useState(client
    ? { company_name:client.company_name||'', contact_name:client.contact_name||'', phone:client.phone||'', email:client.email||'', address:client.address||'', contract_status:client.contract_status||'active', notes:client.notes||'' }
    : { company_name:'', contact_name:'', phone:'', email:'', address:'', contract_status:'active', notes:'' })
  const [site, setSite] = useState({ name:'', address:'', city:'', state:'', latitude:'', longitude:'', geofence_feet:'500' })
  const [saving, setSaving] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })) }
  function setS(k, v) { setSite(p => ({ ...p, [k]: v })) }
  const foc = e => e.target.style.borderColor = 'var(--border-focus)'
  const blr = e => e.target.style.borderColor = 'var(--border)'

  // Edit mode — single-step save
  async function saveEdit() {
    if (!form.company_name.trim()) return
    setSaving(true)
    await supabase.from('client').update({ ...form }).eq('id', client.id)
    toast('Client saved')
    setSaving(false)
    onSaved()
  }

  // Create mode — step 2: save client row then site row
  async function saveFull() {
    if (!site.name.trim()) return
    setSaving(true)
    try {
      const { data: newClient, error: clientErr } = await supabase
        .from('client')
        .insert({ company_id: companyId, ...form })
        .select('id')
        .single()
      if (clientErr) throw clientErr

      // Convert feet → meters for storage
      const geofenceMeters = Math.round((Number(site.geofence_feet) || 500) * 0.3048)

      const { error: siteErr } = await supabase.from('site').insert({
        company_id: companyId,
        client_id: newClient.id,
        name: site.name.trim(),
        address: site.address.trim() || null,
        city: site.city.trim() || null,
        state: site.state.trim() || null,
        latitude: site.latitude ? Number(site.latitude) : null,
        longitude: site.longitude ? Number(site.longitude) : null,
        geofence_radius: geofenceMeters,
        is_active: true,
        requires_dar: false,
      })
      if (siteErr) throw siteErr

      setStep('done')
    } catch (err) {
      toast('Failed to save: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendInvite() {
    if (!form.email) return
    setInviteSending(true)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          to: form.email,
          data: {
            firstName: form.contact_name?.split(' ')[0] || 'there',
            loginUrl: 'https://postcommand.app',
            company_id: companyId,
          },
        },
      })
      toast('Invite sent to ' + form.email)
    } catch {
      toast('Failed to send invite', 'error')
    } finally {
      setInviteSending(false)
    }
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (client) {
    return (
      <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={s.modal}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' }}>EDIT CLIENT</div>
            <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }} onClick={onClose}><Icon name="x" size={18}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div><div style={s.lbl}>Company Name *</div><input style={s.inp} value={form.company_name} onChange={e=>setF('company_name',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Acme Corp"/></div>
            <div><div style={s.lbl}>Contact Name</div><input style={s.inp} value={form.contact_name} onChange={e=>setF('contact_name',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contact Email</div><input style={s.inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contact Phone</div><input style={s.inp} value={form.phone} onChange={e=>setF('phone',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div style={{ gridColumn:'1/-1' }}><div style={s.lbl}>Billing Address</div><input style={s.inp} value={form.address} onChange={e=>setF('address',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contract Status</div><select style={{ ...s.inp, cursor:'pointer' }} value={form.contract_status} onChange={e=>setF('contract_status',e.target.value)}><option value="active">Active</option><option value="pending">Pending</option><option value="expired">Expired</option></select></div>
          </div>
          <div style={{ marginBottom:'18px' }}><div style={s.lbl}>Notes</div><textarea style={{ ...s.inp, minHeight:'60px', resize:'vertical', lineHeight:1.5 }} value={form.notes} onChange={e=>setF('notes',e.target.value)} onFocus={foc} onBlur={blr}/></div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={{ ...s.btn, opacity:(!form.company_name.trim()||saving)?0.6:1 }} onClick={saveEdit} disabled={!form.company_name.trim()||saving}>{saving?'SAVING...':'SAVE CHANGES'}</button>
            <button style={s.ghost} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Create mode — step 1: basic info ──────────────────────────────────────
  if (step === 'client') {
    return (
      <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={s.modal}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' }}>NEW CLIENT</div>
            <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }} onClick={onClose}><Icon name="x" size={18}/></button>
          </div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'18px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>STEP 1 OF 2 — BASIC INFO</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div><div style={s.lbl}>Company Name *</div><input style={s.inp} value={form.company_name} onChange={e=>setF('company_name',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Acme Corp"/></div>
            <div><div style={s.lbl}>Contact Name</div><input style={s.inp} value={form.contact_name} onChange={e=>setF('contact_name',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contact Email</div><input style={s.inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>Contact Phone</div><input style={s.inp} value={form.phone} onChange={e=>setF('phone',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div style={{ gridColumn:'1/-1' }}><div style={s.lbl}>Billing Address</div><input style={s.inp} value={form.address} onChange={e=>setF('address',e.target.value)} onFocus={foc} onBlur={blr} placeholder="123 Main St, Suite 100"/></div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={{ ...s.btn, opacity:!form.company_name.trim()?0.6:1 }} onClick={()=>setStep('site')} disabled={!form.company_name.trim()}>NEXT: SITE INFO <Icon name="arrow-right" size={14}/></button>
            <button style={s.ghost} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Create mode — step 2: site info ───────────────────────────────────────
  if (step === 'site') {
    return (
      <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={s.modal}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)' }}>NEW CLIENT</div>
            <button style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex' }} onClick={onClose}><Icon name="x" size={18}/></button>
          </div>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'18px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>STEP 2 OF 2 — SITE INFORMATION</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            <div style={{ gridColumn:'1/-1' }}><div style={s.lbl}>Site Name *</div><input style={s.inp} value={site.name} onChange={e=>setS('name',e.target.value)} onFocus={foc} onBlur={blr} placeholder="Main Office"/></div>
            <div style={{ gridColumn:'1/-1' }}><div style={s.lbl}>Site Address</div><input style={s.inp} value={site.address} onChange={e=>setS('address',e.target.value)} onFocus={foc} onBlur={blr} placeholder="123 Main St"/></div>
            <div><div style={s.lbl}>City</div><input style={s.inp} value={site.city} onChange={e=>setS('city',e.target.value)} onFocus={foc} onBlur={blr}/></div>
            <div><div style={s.lbl}>State</div><input style={s.inp} value={site.state} onChange={e=>setS('state',e.target.value)} onFocus={foc} onBlur={blr} placeholder="DC"/></div>
            <div><div style={s.lbl}>Latitude</div><input style={s.inp} type="number" step="any" value={site.latitude} onChange={e=>setS('latitude',e.target.value)} onFocus={foc} onBlur={blr} placeholder="38.9072"/></div>
            <div><div style={s.lbl}>Longitude</div><input style={s.inp} type="number" step="any" value={site.longitude} onChange={e=>setS('longitude',e.target.value)} onFocus={foc} onBlur={blr} placeholder="-77.0369"/></div>
            <div style={{ gridColumn:'1/-1' }}><div style={s.lbl}>Geofence Radius (feet)</div><input style={s.inp} type="number" value={site.geofence_feet} onChange={e=>setS('geofence_feet',e.target.value)} onFocus={foc} onBlur={blr} placeholder="500"/></div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={{ ...s.btn, opacity:(!site.name.trim()||saving)?0.6:1 }} onClick={saveFull} disabled={!site.name.trim()||saving}>{saving?'SAVING...':'CREATE CLIENT'}</button>
            <button style={s.ghost} onClick={()=>setStep('client')}>BACK</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Create mode — step done: success + invite ──────────────────────────────
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ textAlign:'center', padding:'8px 0 20px' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'var(--color-success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Icon name="check-circle" size={28} color="var(--color-success)"/>
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'6px' }}>CLIENT CREATED</div>
          <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>{form.company_name} and their first site have been saved.</div>
        </div>
        {form.email && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'4px' }}>Send Welcome Email?</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>
              Send a welcome email to <strong>{form.email}</strong> introducing {form.contact_name || 'the contact'} to PostCommand.
            </div>
            <button style={{ ...s.btn, height:'36px', fontSize:'12px', padding:'0 16px', opacity:inviteSending?0.6:1 }} onClick={sendInvite} disabled={inviteSending}>
              <Icon name="mail" size={13}/>{inviteSending?'SENDING...':'SEND INVITE EMAIL'}
            </button>
          </div>
        )}
        <button style={s.btn} onClick={onSaved}>DONE</button>
      </div>
    </div>
  )
}
