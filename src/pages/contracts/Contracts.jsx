import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { CONTRACT_ROLES } from '../../config/roles'
import { dbErrorMessage } from '../../lib/dbErrors'
import { formatCents } from '../../lib/contractMath'
import { useToast } from '../../components/ui/Toast'
import ContractSettingsTab from '../settings/ContractSettingsTab'
import ContractDrawer, { STATUS, clientLabel, renewalFlag } from './ContractDrawer'
import { fmtDate } from './ContractDialogs'

const s = {
  page:    { padding:'24px', maxWidth:'1200px', animation:'fadeIn 200ms ease' },
  heading: { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:     { fontSize:'12px', color:'var(--text-muted)', marginBottom:'20px' },
  tabs:    { display:'flex', gap:'2px', marginBottom:'20px', borderBottom:'1px solid var(--border)' },
  tab:     { padding:'10px 18px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px' },
  tabAct:  { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  th:      { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 14px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  tr:      { borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 150ms ease' },
  td:      { padding:'12px 14px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  pill:    { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  sel:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', fontFamily:'var(--font-body)', cursor:'pointer', minWidth:'150px' },
}

export default function Contracts() {
  const { profile, effectiveRole: role, profileConfirmed } = useAuth()   // View As aware
  const navigate = useNavigate()
  const [tab, setTab] = useState('contracts')

  useEffect(() => {
    if (profileConfirmed && !CONTRACT_ROLES.includes(role)) navigate('/dashboard', { replace:true })
  }, [profileConfirmed, role, navigate])

  if (!profile?.company_id || !CONTRACT_ROLES.includes(role)) return null

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>CONTRACTS</h2>
      <p style={s.sub}>Service agreements, renewals, and contract terms.</p>
      <div style={s.tabs}>
        {[{ id:'contracts', label:'Contracts' }, { id:'rates', label:'Rates & Terms' }].map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabAct : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'contracts' && <ContractList companyId={profile.company_id} role={role} />}
      {tab === 'rates' && <div style={{ maxWidth:'900px' }}><ContractSettingsTab /></div>}
    </div>
  )
}

function ContractList({ companyId, role }) {
  const toast = useToast()
  const [contracts, setContracts] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [fStatus,   setFStatus]   = useState('all')
  const [fClient,   setFClient]   = useState('all')
  const [fJur,      setFJur]      = useState('all')
  const [selected,  setSelected]  = useState(null)

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('service_contract')
        .select('*, client:client_id(name, legal_name), template:template_id(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending:false })
      if (error) throw error
      setContracts(data || [])
    } catch (e) {
      toast(dbErrorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, { setLoading })
  useEffect(() => { load() }, [companyId])

  const clientOpts = useMemo(() => [...new Map(contracts.map(c => [c.client_id, clientLabel(c)])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [contracts])
  const jurOpts = useMemo(() => [...new Set(contracts.map(c => c.jurisdiction_code))].sort(), [contracts])
  const filtered = contracts.filter(c =>
    (fStatus === 'all' || c.status === fStatus) && (fClient === 'all' || c.client_id === fClient) && (fJur === 'all' || c.jurisdiction_code === fJur))

  if (loading) return <div>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height:'48px', borderRadius:'8px', marginBottom:'10px' }} />)}</div>

  return (
    <>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
        <select style={s.sel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={s.sel} value={fClient} onChange={e => setFClient(e.target.value)}>
          <option value="all">All clients</option>
          {clientOpts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select style={s.sel} value={fJur} onChange={e => setFJur(e.target.value)}>
          <option value="all">All jurisdictions</option>
          {jurOpts.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      <div style={{ ...s.card, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'760px' }}>
          <thead><tr>{['Client', 'Jurisdiction', 'Status', 'Effective', 'Term end', 'Weekly total'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(c => {
              const st = STATUS[c.status] || STATUS.draft
              const flag = renewalFlag(c)
              const weekly = c.calculator_snapshot?.weeklyTotalCents
              return (
                <tr key={c.id} style={s.tr} onClick={() => setSelected(c)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...s.td, color:'var(--text-primary)', fontWeight:600 }}>{clientLabel(c)}</td>
                  <td style={s.td}>{c.jurisdiction_code}</td>
                  <td style={s.td}><span style={{ ...s.pill, background:st.bg, color:st.color }}>{st.label}</span></td>
                  <td style={s.td}>{fmtDate(c.effective_date)}</td>
                  <td style={s.td}>
                    <div>{fmtDate(c.term_end_date)}</div>
                    {flag && <span style={{ ...s.pill, background:flag.bg, color:flag.color, marginTop:'4px' }}>{flag.text}</span>}
                  </td>
                  <td style={s.td}>{Number.isInteger(weekly) ? formatCents(weekly) : '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...s.td, textAlign:'center', padding:'36px', color:'var(--text-muted)' }}>
                {contracts.length === 0 ? 'No contracts yet.' : 'No contracts match these filters.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ContractDrawer contract={selected} role={role} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load() }} />
      )}
    </>
  )
}
