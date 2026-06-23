import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import Icon from '../../components/ui/Icon'

const ACTION_COLORS = {
  employee_created:    { color:'var(--color-success)', icon:'user-plus' },
  employee_updated:    { color:'var(--color-info)',    icon:'edit-2' },
  employee_deleted:    { color:'var(--color-danger)',  icon:'trash-2' },
  invite_sent:         { color:'var(--color-info)',    icon:'mail' },
  timesheet_approved:  { color:'var(--color-success)', icon:'check-circle' },
  timesheet_rejected:  { color:'var(--color-danger)',  icon:'x' },
  incident_created:    { color:'var(--color-warning)', icon:'flag' },
  incident_approved:   { color:'var(--color-success)', icon:'check-circle' },
  incident_voided:     { color:'var(--color-danger)',  icon:'x' },
  invoice_created:     { color:'var(--color-info)',    icon:'credit-card' },
  invoice_sent:        { color:'var(--color-info)',    icon:'send' },
  invoice_paid:        { color:'var(--color-success)', icon:'check' },
  settings_updated:    { color:'var(--text-muted)',    icon:'settings' },
  user_login:          { color:'var(--text-muted)',    icon:'log-in' },
  site_created:        { color:'var(--color-info)',    icon:'map-pin' },
  schedule_published:  { color:'var(--color-success)', icon:'calendar' },
}

function fmtAgo(iso) {
  if (!iso) return '—'
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  if (diff < 7*86400) return `${Math.floor(diff/86400)}d ago`
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function AuditLog() {
  const { profile, role, profileConfirmed } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!profileConfirmed) return
    if (!['super_admin', 'chief'].includes(role)) navigate('/dashboard', { replace: true })
  }, [profileConfirmed, role, navigate])
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(200)
      setEvents(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  const filtered = useMemo(() => events.filter(e => {
    if (filterAction !== 'all' && e.action !== filterAction) return false
    if (dateFrom && e.created_at < dateFrom) return false
    if (dateTo   && e.created_at.slice(0,10) > dateTo) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.actor_name?.toLowerCase().includes(q) && !e.resource_name?.toLowerCase().includes(q) && !e.action?.toLowerCase().includes(q)) return false
    }
    return true
  }), [events, filterAction, dateFrom, dateTo, search])

  function exportCSV() {
    const rows = [['Time','Actor','Action','Resource','Resource Name']]
    filtered.forEach(e => rows.push([
      e.created_at ? new Date(e.created_at).toLocaleString() : '',
      e.actor_name || '',
      e.action || '',
      e.resource_type || '',
      e.resource_name || '',
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueActions = [...new Set(events.map(e => e.action))].sort()

  const selStyle = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', cursor:'pointer' }

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:'52px', borderRadius:'8px', marginBottom:'8px' }} />)}</div>

  return (
    <div style={{ padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>AUDIT LOG</h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{events.length} events recorded · showing {filtered.length}</p>
        </div>
        <button onClick={exportCSV} style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-card)', color:'var(--text-secondary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', cursor:'pointer' }}>
          <Icon name="download" size={14}/>EXPORT CSV
        </button>
      </div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
          <Icon name="search" size={15} color="var(--text-muted)" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
          <input placeholder="Search actor, action, resource..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ ...selStyle, width:'100%', paddingLeft:'36px', boxSizing:'border-box', cursor:'text' }}
            onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
        </div>
        <select value={filterAction} onChange={e=>setFilterAction(e.target.value)} style={selStyle}>
          <option value="all">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={selStyle} title="From date"/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={selStyle} title="To date"/>
        {(search||filterAction!=='all'||dateFrom||dateTo) && (
          <button onClick={()=>{setSearch('');setFilterAction('all');setDateFrom('');setDateTo('')}} style={{ ...selStyle, cursor:'pointer', color:'var(--text-muted)' }}>CLEAR</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:'var(--text-muted)' }}>
          <Icon name="archive" size={36} color="var(--border-subtle)"/>
          <div style={{ marginTop:'16px', fontSize:'15px' }}>No audit events found</div>
          <div style={{ marginTop:'6px', fontSize:'12px' }}>Events are automatically logged when actions are taken in the app</div>
        </div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Time','Actor','Action','Resource','Details'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const meta = ACTION_COLORS[e.action] || { color:'var(--text-muted)', icon:'activity' }
                return (
                  <tr key={e.id} style={{ borderBottom: i<filtered.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtAgo(e.created_at)}</td>
                    <td style={{ padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{e.actor_name || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:'6px' }}>
                        <Icon name={meta.icon} size={12} color={meta.color}/>
                        <span style={{ fontSize:'12px', color:meta.color, fontFamily:'var(--font-condensed)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{e.action?.replace(/_/g,' ')}</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {e.resource_type && <span style={{ fontSize:'11px', color:'var(--text-muted)', background:'var(--bg-surface)', padding:'1px 6px', borderRadius:'4px', border:'1px solid var(--border)', fontFamily:'var(--font-condensed)' }}>{e.resource_type}</span>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:'12px', color:'var(--text-secondary)', maxWidth:'280px' }}>
                      {e.resource_name && <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{e.resource_name}</span>}
                      {e.metadata?.note && <span style={{ color:'var(--text-muted)', marginLeft:'6px' }}>· {e.metadata.note}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
