import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { dbErrorMessage } from '../../lib/dbErrors'
import { returnEmployeeToActive, activationModeFor } from '../../lib/employeeStatus'

const s = {
  page:     { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  tabs:     { display:'flex', gap:'2px', marginBottom:'22px', borderBottom:'1px solid var(--border)', paddingBottom:0 },
  tab:      { padding:'10px 18px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  tabAct:   { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  card:     { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  row:      { display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom:'1px solid var(--border)', transition:'background 150ms ease' },
  name:     { fontSize:'13px', fontWeight:600, color:'var(--text-primary)' },
  meta:     { fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' },
  pill:     { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  restoreBtn:{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  deleteBtn: { display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'1px', cursor:'pointer' },
  empty:    { padding:'40px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' },
  toolbar:  { display:'flex', gap:'10px', marginBottom:'16px' },
  search:   { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'160px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
}

export default function Archived() {
  const { profile } = useAuth()
  const [tab, setTab]     = useState('employees')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState(null)

  const TABS = [
    { id:'employees', label:'Employees' },
    { id:'sites',     label:'Sites' },
    { id:'incidents', label:'Incidents' },
    { id:'clients',   label:'Clients' },
  ]

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>ARCHIVED RECORDS</h2>
      <p style={s.sub}>Restore archived employees, sites, incidents, and clients.</p>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab===t.id?s.tabAct:{}) }} onClick={()=>{ setTab(t.id); setSearch('') }}>{t.label}</button>
        ))}
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder={`Search archived ${tab}...`} value={search} onChange={e=>setSearch(e.target.value)}
          onFocus={e=>e.target.style.borderColor='var(--border-focus)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
      </div>

      {tab === 'employees' && <ArchivedEmployees companyId={profile.company_id} profile={profile} search={search} acting={acting} setActing={setActing} />}
      {tab === 'sites'     && <ArchivedSites     companyId={profile.company_id} search={search} acting={acting} setActing={setActing} />}
      {tab === 'incidents' && <ArchivedIncidents  companyId={profile.company_id} search={search} acting={acting} setActing={setActing} />}
      {tab === 'clients'   && <ArchivedClients    companyId={profile.company_id} search={search} acting={acting} setActing={setActing} />}
    </div>
  )
}

// ── Archived Employees ────────────────────────────────────────────────────────

function ArchivedEmployees({ companyId, profile, search, acting, setActing }) {
  const toast = useToast()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('employee')
        .select('id,company_id,first_name,last_name,role,status,position_title,terminated_date,email')
        .eq('company_id', companyId)
        .in('status', ['terminated','inactive','suspended','archived'])
        .order('last_name')
      // Surface a failed query instead of silently showing "No archived employees found".
      if (error) toast(dbErrorMessage(error), 'error')
      setEmployees(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function restore(emp) {
    // Restoring a terminated employee is a rehire: confirm first (same wording as the profile Rehire button).
    if (emp.status === 'terminated' && !window.confirm(`Rehire ${emp.first_name} ${emp.last_name}? Their status will be set to Active and the termination details will be cleared.`)) return
    setActing(emp.id)
    // Same shared helper as the Personnel dialog and profile header (update + change log).
    const { error } = await returnEmployeeToActive(emp, { mode: activationModeFor(emp.status), actor: profile })
    setActing(null)
    if (error) { toast(dbErrorMessage(error), 'error'); return }
    toast(`${emp.first_name} ${emp.last_name} restored`)
    load()
  }

  async function hardDelete(emp) {
    if (!window.confirm(`Permanently delete ${emp.first_name} ${emp.last_name}? This cannot be undone.`)) return
    setActing(emp.id)
    await supabase.from('employee').delete().eq('id', emp.id)
    setActing(null); load()
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return !q || `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q)
  })

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>

  const STATUS_COLORS = { terminated:'var(--color-danger)', inactive:'var(--text-muted)', suspended:'var(--color-warning)', archived:'var(--text-muted)' }

  return (
    <div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>{filtered.length} archived employee{filtered.length!==1?'s':''}</div>
      <div style={s.card}>
        {filtered.length === 0 ? <div style={s.empty}>No archived employees found.</div> : filtered.map((emp, i) => (
          <div key={emp.id} style={{ ...s.row, borderBottom:i<filtered.length-1?'1px solid var(--border)':'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
              {emp.first_name?.[0]}{emp.last_name?.[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={s.name}>{emp.first_name} {emp.last_name}</div>
              <div style={s.meta}>
                {ROLE_LABELS[emp.role]||emp.role}{emp.position_title?` · ${emp.position_title}`:''}
                {emp.terminated_date ? ` · Terminated ${new Date(emp.terminated_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : ''}
              </div>
            </div>
            <span style={{ ...s.pill, background:`${STATUS_COLORS[emp.status]}22`, color:STATUS_COLORS[emp.status] }}>{emp.status?.toUpperCase()}</span>
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              <button style={{ ...s.restoreBtn, opacity:acting===emp.id?0.6:1 }} onClick={()=>restore(emp)} disabled={acting===emp.id}>
                <Icon name="refresh-cw" size={12}/>{acting===emp.id?'...':'RESTORE'}
              </button>
              <button style={{ ...s.deleteBtn, opacity:acting===emp.id?0.6:1 }} onClick={()=>hardDelete(emp)} disabled={acting===emp.id}>
                <Icon name="trash-2" size={12}/>DELETE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Archived Sites ────────────────────────────────────────────────────────────

function ArchivedSites({ companyId, search, acting, setActing }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('site')
        .select('id,name,city,state,address')
        .eq('company_id', companyId)
        .eq('is_active', false)
        .order('name')
      setSites(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function restore(site) {
    setActing(site.id)
    await supabase.from('site').update({ is_active:true }).eq('id', site.id)
    setActing(null); load()
  }

  async function hardDelete(site) {
    if (!window.confirm(`Permanently delete ${site.name}? This cannot be undone.`)) return
    setActing(site.id)
    await supabase.from('site').delete().eq('id', site.id)
    setActing(null); load()
  }

  const filtered = sites.filter(sv => !search || sv.name?.toLowerCase().includes(search.toLowerCase()) || sv.city?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>

  return (
    <div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>{filtered.length} inactive site{filtered.length!==1?'s':''}</div>
      <div style={s.card}>
        {filtered.length === 0 ? <div style={s.empty}>No inactive sites found.</div> : filtered.map((sv, i) => (
          <div key={sv.id} style={{ ...s.row, borderBottom:i<filtered.length-1?'1px solid var(--border)':'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{ width:'40px', height:'40px', borderRadius:'var(--radius-sm)', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name="map-pin" size={18} color="var(--text-muted)"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={s.name}>{sv.name}</div>
              <div style={s.meta}>{sv.city}, {sv.state}{sv.address?` · ${sv.address}`:''}</div>
            </div>
            <span style={{ ...s.pill, background:'var(--border)', color:'var(--text-muted)' }}>INACTIVE</span>
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              <button style={{ ...s.restoreBtn, opacity:acting===sv.id?0.6:1 }} onClick={()=>restore(sv)} disabled={acting===sv.id}>
                <Icon name="refresh-cw" size={12}/>{acting===sv.id?'...':'RESTORE'}
              </button>
              <button style={{ ...s.deleteBtn, opacity:acting===sv.id?0.6:1 }} onClick={()=>hardDelete(sv)} disabled={acting===sv.id}>
                <Icon name="trash-2" size={12}/>DELETE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Archived Incidents ────────────────────────────────────────────────────────

function ArchivedIncidents({ companyId, search, acting, setActing }) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('incident_report')
        .select('id,cad_number,incident_type,status,created_at,site_id')
        .eq('company_id', companyId)
        .eq('status', 'void')
        .order('created_at', { ascending:false })
      setIncidents(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function restore(inc) {
    setActing(inc.id)
    await supabase.from('incident_report').update({ status:'draft' }).eq('id', inc.id)
    setActing(null); load()
  }

  async function hardDelete(inc) {
    if (!window.confirm(`Permanently delete incident ${inc.cad_number}? This cannot be undone.`)) return
    setActing(inc.id)
    await supabase.from('incident_report').delete().eq('id', inc.id)
    setActing(null); load()
  }

  const filtered = incidents.filter(i => !search || i.cad_number?.toLowerCase().includes(search.toLowerCase()) || i.incident_type?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>

  return (
    <div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>{filtered.length} voided incident{filtered.length!==1?'s':''}</div>
      <div style={s.card}>
        {filtered.length === 0 ? <div style={s.empty}>No voided incidents found.</div> : filtered.map((inc, i) => (
          <div key={inc.id} style={{ ...s.row, borderBottom:i<filtered.length-1?'1px solid var(--border)':'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{ width:'40px', height:'40px', borderRadius:'var(--radius-sm)', background:'var(--color-danger-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name="file-x" size={18} color="var(--color-danger)"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={s.name}>{inc.incident_type}</div>
              <div style={s.meta}>{inc.cad_number} · Voided {new Date(inc.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
            </div>
            <span style={{ ...s.pill, background:'var(--color-danger-bg)', color:'var(--color-danger)' }}>VOID</span>
            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
              <button style={{ ...s.restoreBtn, opacity:acting===inc.id?0.6:1 }} onClick={()=>restore(inc)} disabled={acting===inc.id}>
                <Icon name="refresh-cw" size={12}/>{acting===inc.id?'...':'RESTORE'}
              </button>
              <button style={{ ...s.deleteBtn, opacity:acting===inc.id?0.6:1 }} onClick={()=>hardDelete(inc)} disabled={acting===inc.id}>
                <Icon name="trash-2" size={12}/>DELETE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Archived Clients ──────────────────────────────────────────────────────────
// Archived = status 'inactive' with deletion_date set. Restore changes only the
// client row. No hard delete here: clients with contracts must be kept.

function ArchivedClients({ companyId, search, acting, setActing }) {
  const toast = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('client')
        .select('id,name,legal_name,deletion_date,deletion_reason,deletion_initiated_by')
        .eq('company_id', companyId)
        .not('deletion_date', 'is', null)
        .order('name')
      if (error) throw error
      setClients(data || [])
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function restore(c) {
    setActing(c.id)
    const { error } = await supabase.from('client')
      .update({ status:'active', deletion_date:null, deletion_reason:null, deletion_initiated_by:null })
      .eq('id', c.id).eq('company_id', companyId)
    setActing(null)
    if (error) { toast(dbErrorMessage(error), 'error'); return }
    toast(`${c.name} restored`)
    load()
  }

  const filtered = clients.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.legal_name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px' }}>LOADING...</div>

  return (
    <div>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'12px' }}>{filtered.length} archived client{filtered.length!==1?'s':''}</div>
      <div style={s.card}>
        {filtered.length === 0 ? <div style={s.empty}>No archived clients found.</div> : filtered.map((c, i) => (
          <div key={c.id} style={{ ...s.row, borderBottom:i<filtered.length-1?'1px solid var(--border)':'none' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          >
            <div style={{ width:'40px', height:'40px', borderRadius:'var(--radius-sm)', background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name="briefcase" size={18} color="var(--text-muted)"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={s.name}>{c.name}</div>
              <div style={s.meta}>
                Archived {new Date(c.deletion_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                {c.deletion_initiated_by ? ` by ${c.deletion_initiated_by}` : ''}
                {c.deletion_reason ? ` · ${c.deletion_reason}` : ''}
              </div>
            </div>
            <span style={{ ...s.pill, background:'var(--border)', color:'var(--text-muted)' }}>ARCHIVED</span>
            <button style={{ ...s.restoreBtn, opacity:acting===c.id?0.6:1 }} onClick={()=>restore(c)} disabled={acting===c.id}>
              <Icon name="refresh-cw" size={12}/>{acting===c.id?'...':'RESTORE'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
