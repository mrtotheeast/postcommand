import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { openBrowser } from '../../lib/platform'
import Icon from '../../components/ui/Icon'

const TABS = [
  { id:'connect',    label:'Connect',     icon:'link' },
  { id:'run',        label:'Run Payroll',  icon:'dollar-sign' },
  { id:'stubs',      label:'Pay Stubs',    icon:'file-text' },
  { id:'settings',   label:'Settings',    icon:'settings' },
]

const s = {
  page:    { padding:'24px', maxWidth:'1000px', animation:'fadeIn 200ms ease' },
  heading: { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:     { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  tabs:    { display:'flex', gap:'2px', marginBottom:'24px', borderBottom:'1px solid var(--border)', paddingBottom:0 },
  tab:     { padding:'10px 18px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  tabAct:  { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', marginBottom:'16px' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  danger:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  row:     { display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
}

const GUSTO_OAUTH_URL = 'https://account.gusto.com/oauth/authorize'
const GUSTO_CLIENT_ID = import.meta.env.VITE_GUSTO_CLIENT_ID || 'YOUR_GUSTO_CLIENT_ID'

export default function Payroll() {
  const { profile, companyId } = useAuth()
  const [tab, setTab]             = useState('connect')
  const [connection, setConnection] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => { if (companyId) loadConnection() }, [companyId])

  async function loadConnection() {
    setLoading(true)
    const { data } = await supabase.from('gusto_connection').select('*').eq('company_id', companyId).maybeSingle()
    setConnection(data)
    setLoading(false)
    if (data) setTab('run')
  }

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:'80px', borderRadius:'10px', marginBottom:'12px' }}/>)}</div>

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>PAYROLL</h2>
      <p style={s.sub}>Connect Gusto to run payroll, view pay stubs, and sync employee data.</p>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab===t.id?s.tabAct:{}) }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connect'  && <ConnectTab  companyId={companyId} connection={connection} onConnected={loadConnection}/>}
      {tab === 'run'      && <RunPayrollTab companyId={companyId} connection={connection} profile={profile}/>}
      {tab === 'stubs'    && <PayStubsTab  companyId={companyId} connection={connection}/>}
      {tab === 'settings' && <SettingsTab  companyId={companyId} connection={connection} onSaved={loadConnection}/>}
    </div>
  )
}

// ── Connect Tab ───────────────────────────────────────────────────────────────

function ConnectTab({ companyId, connection, onConnected }) {
  const [disconnecting, setDisconnecting] = useState(false)

  function connectGusto() {
    const redirectUri = encodeURIComponent(`${window.location.origin}/payroll?gusto_callback=1`)
    const state = encodeURIComponent(companyId)
    const url = `${GUSTO_OAUTH_URL}?client_id=${GUSTO_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}`
    openBrowser(url)
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Gusto? This will not cancel any active payroll runs.')) return
    setDisconnecting(true)
    await supabase.from('gusto_connection').delete().eq('company_id', companyId)
    setDisconnecting(false)
    onConnected()
  }

  if (connection) return (
    <div style={s.card}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'var(--color-success-bg)', border:'1px solid rgba(58,170,106,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name="check-circle" size={22} color="var(--color-success)"/>
        </div>
        <div>
          <div style={{ fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, color:'var(--color-success)', letterSpacing:'1px' }}>CONNECTED TO GUSTO</div>
          <div style={{ fontSize:'13px', color:'var(--text-primary)', marginTop:'2px' }}>{connection.gusto_company_name || 'Gusto Company'}</div>
          {connection.last_sync_at && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>Last sync: {new Date(connection.last_sync_at).toLocaleString()}</div>}
        </div>
      </div>
      <div style={{ padding:'16px', background:'var(--bg-surface)', borderRadius:'var(--radius-md)', marginBottom:'20px', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>
        Gusto handles all tax calculations, direct deposits, W-2 filing, and compliance. PostCommand syncs hours directly to your Gusto payroll runs.
      </div>
      <button onClick={disconnect} disabled={disconnecting} style={{ ...s.danger, opacity:disconnecting?0.6:1 }}>
        <Icon name="x" size={14}/>{disconnecting?'DISCONNECTING...':'DISCONNECT GUSTO'}
      </button>
    </div>
  )

  return (
    <div style={s.card}>
      <div style={{ textAlign:'center', padding:'24px 0' }}>
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <Icon name="dollar-sign" size={28} color="var(--accent)"/>
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'12px' }}>CONNECT GUSTO</div>
        <div style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.7, maxWidth:'420px', margin:'0 auto 24px' }}>
          Gusto is an all-in-one payroll, benefits, and HR platform. Connect your Gusto account to run payroll directly from PostCommand using verified timesheet hours.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxWidth:'360px', margin:'0 auto 28px', fontSize:'13px', color:'var(--text-secondary)', textAlign:'left' }}>
          {['Automatic tax calculations and filings','Direct deposit to employee bank accounts','W-2 and 1099 generation at year end','Benefits administration','Compliance with state/federal regulations'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:'8px' }}><Icon name="check" size={14} color="var(--color-success)"/>{f}</div>
          ))}
        </div>
        <button onClick={connectGusto} style={s.btn}>
          <Icon name="link" size={16}/>CONNECT GUSTO ACCOUNT
        </button>
        <div style={{ marginTop:'12px', fontSize:'11px', color:'var(--text-muted)' }}>
          Need help getting started? Contact{' '}
          <a href="mailto:support@postcommand.app" style={{ color:'var(--accent)', textDecoration:'none' }}>support@postcommand.app</a>.
        </div>
      </div>
    </div>
  )
}

// ── Run Payroll Tab ───────────────────────────────────────────────────────────

function RunPayrollTab({ companyId, connection, profile }) {
  const [employees, setEmployees] = useState([])
  const [sheets, setSheets]       = useState([])
  const [payPeriod, setPayPeriod] = useState({ start:'', end:'' })
  const [overrides, setOverrides] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!companyId) return
    const now = new Date()
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7)); monday.setHours(0,0,0,0)
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6)
    const start = monday.toISOString().slice(0,10)
    const end   = sunday.toISOString().slice(0,10)
    setPayPeriod({ start, end })
    Promise.all([
      supabase.from('employee').select('id,first_name,last_name,pay_rate').eq('company_id', companyId).eq('status','active'),
      supabase.from('timesheet').select('employee_id,total_hours,status').eq('company_id', companyId).gte('date', start).lte('date', end).eq('status','approved'),
    ]).then(([{ data:emps },{ data:ts }]) => {
      setEmployees(emps||[])
      setSheets(ts||[])
      setLoading(false)
    })
  }, [companyId])

  const empHours = useMemo(() => {
    const map = {}
    for (const ts of sheets) {
      map[ts.employee_id] = (map[ts.employee_id]||0) + (Number(ts.total_hours)||0)
    }
    return map
  }, [sheets])

  async function submit() {
    if (!connection) { alert('Connect Gusto first.'); return }
    setSubmitting(true); setResult(null)
    try {
      const payload = employees.map(e => ({
        employee_id: e.id,
        gusto_employee_id: e.gusto_employee_id || null,
        hours: Number((overrides[e.id] ?? empHours[e.id] ?? 0).toFixed(2)),
      }))
      const { data, error } = await supabase.functions.invoke('gusto-proxy', {
        body: { action:'submit-payroll', company_id:companyId, pay_period_start:payPeriod.start, pay_period_end:payPeriod.end, employees:payload }
      })
      if (error) throw new Error(error.message)
      setResult({ ok:true, text: data?.message || 'Payroll submitted to Gusto. Processing within 2 business days.' })
    } catch(e) {
      setResult({ ok:false, text:e.message })
    }
    setSubmitting(false)
  }

  if (!connection) return (
    <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
      <Icon name="dollar-sign" size={36} color="var(--border-subtle)"/>
      <div style={{ marginTop:'16px', fontSize:'15px' }}>Connect Gusto first</div>
      <div style={{ marginTop:'6px', fontSize:'12px' }}>Go to the Connect tab to link your Gusto account</div>
    </div>
  )

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', padding:'20px 0' }}>Loading timesheet data...</div>

  return (
    <div>
      {result && (
        <div style={{ padding:'12px 16px', borderRadius:'var(--radius-md)', marginBottom:'16px', fontSize:'13px', background:result.ok?'var(--color-success-bg)':'var(--color-danger-bg)', color:result.ok?'var(--color-success)':'var(--color-danger)', border:`1px solid ${result.ok?'rgba(58,170,106,0.3)':'rgba(192,57,43,0.3)'}` }}>
          {result.text}
        </div>
      )}
      <div style={s.card}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px', flexWrap:'wrap' }}>
          <div>
            <div style={s.lbl}>Pay Period Start</div>
            <input type="date" style={{ ...s.inp, width:'150px' }} value={payPeriod.start} onChange={e=>setPayPeriod(p=>({...p,start:e.target.value}))}/>
          </div>
          <div>
            <div style={s.lbl}>Pay Period End</div>
            <input type="date" style={{ ...s.inp, width:'150px' }} value={payPeriod.end} onChange={e=>setPayPeriod(p=>({...p,end:e.target.value}))}/>
          </div>
        </div>

        <div style={{ marginBottom:'8px', fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1px' }}>Employee Hours (approved timesheets)</div>
        <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px', padding:'8px 14px', borderBottom:'1px solid var(--border)', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', background:'var(--bg-surface)' }}>
            <span>Employee</span><span style={{textAlign:'right'}}>TS Hours</span><span style={{textAlign:'right'}}>Override</span><span style={{textAlign:'right'}}>Pay Rate</span>
          </div>
          {employees.map(e => (
            <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px', padding:'10px 14px', borderBottom:'1px solid var(--border)', alignItems:'center', fontSize:'13px' }}>
              <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{e.first_name} {e.last_name}</span>
              <span style={{ textAlign:'right', color:'var(--text-secondary)' }}>{(empHours[e.id]||0).toFixed(1)}h</span>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <input type="number" min="0" step="0.5" placeholder="—"
                  value={overrides[e.id]??''} onChange={ev=>setOverrides(p=>({...p,[e.id]:ev.target.value}))}
                  style={{ width:'70px', textAlign:'right', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontSize:'12px', color:'var(--text-primary)', outline:'none' }}/>
              </div>
              <span style={{ textAlign:'right', color:'var(--text-muted)', fontSize:'12px' }}>{e.pay_rate ? `$${e.pay_rate}/hr` : '—'}</span>
            </div>
          ))}
          {employees.length === 0 && <div style={{ padding:'20px', textAlign:'center', color:'var(--text-muted)', fontSize:'13px' }}>No active employees found.</div>}
        </div>

        <button onClick={submit} disabled={submitting||employees.length===0} style={{ ...s.btn, opacity:(submitting||employees.length===0)?0.6:1 }}>
          <Icon name="send" size={15}/>{submitting?'SUBMITTING TO GUSTO...':'SUBMIT TO GUSTO'}
        </button>
        <div style={{ marginTop:'10px', fontSize:'11px', color:'var(--text-muted)' }}>
          Hours will be sent to Gusto for payroll processing. Gusto will calculate taxes and schedule direct deposits.
        </div>
      </div>
    </div>
  )
}

// ── Pay Stubs Tab ─────────────────────────────────────────────────────────────

function PayStubsTab({ companyId, connection }) {
  const [runs, setRuns]     = useState([])
  const [loading, setLoading] = useState(true)
  const fmtD = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
  const fmtM = n => n != null ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n) : '—'

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('payroll_run').select('*').eq('company_id', companyId).order('pay_period_end', {ascending:false})
    setRuns(data||[])
    setLoading(false)
  }

  async function viewStub(run) {
    if (!connection) { alert('Connect Gusto to view pay stubs.'); return }
    try {
      const { data, error } = await supabase.functions.invoke('gusto-proxy', {
        body: { action:'pay-stub-url', company_id:companyId, payroll_id:run.gusto_payroll_id }
      })
      if (error || !data?.url) throw new Error(error?.message||'No URL returned')
      openBrowser(data.url)
    } catch(e) {
      alert('Could not load pay stub: ' + e.message)
    }
  }

  if (!connection) return (
    <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
      <Icon name="file-text" size={36} color="var(--border-subtle)"/>
      <div style={{ marginTop:'16px', fontSize:'15px' }}>Connect Gusto to view pay stubs</div>
      <div style={{ marginTop:'6px', fontSize:'12px' }}>Go to the Connect tab to link your Gusto account</div>
    </div>
  )

  if (loading) return <div style={{ color:'var(--text-muted)', fontSize:'12px', padding:'20px 0' }}>Loading payroll history...</div>

  return (
    <div style={s.card}>
      <div style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'14px' }}>Payroll Runs</div>
      {runs.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>No payroll runs yet. Submit your first payroll on the Run Payroll tab.</div>
      ) : (
        runs.map(run => {
          const statusBg = run.status==='processed'?'var(--color-success-bg)':run.status==='submitted'?'var(--color-info-bg)':'var(--border)'
          const statusC  = run.status==='processed'?'var(--color-success)':run.status==='submitted'?'var(--color-info)':'var(--text-muted)'
          return (
            <div key={run.id} style={s.row}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>
                  {fmtD(run.pay_period_start)} – {fmtD(run.pay_period_end)}
                </div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>Submitted {fmtD(run.submitted_at)}</div>
              </div>
              {run.total_gross && <div style={{ fontFamily:'var(--font-condensed)', fontWeight:700, color:'var(--text-primary)' }}>{fmtM(run.total_gross)}</div>}
              <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:statusBg, color:statusC, fontFamily:'var(--font-condensed)', textTransform:'uppercase' }}>{run.status}</span>
              {run.gusto_payroll_id && (
                <button onClick={() => viewStub(run)} style={{ ...s.ghost, height:'32px', fontSize:'11px', padding:'0 10px' }}>
                  <Icon name="eye" size={12}/>VIEW STUB
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ companyId, connection, onSaved }) {
  const [form, setForm] = useState({ pay_schedule:'weekly' })
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg]         = useState(null)
  const foc = e=>{e.target.style.borderColor='var(--border-focus)'}
  const blr = e=>{e.target.style.borderColor='var(--border)'}

  async function syncEmployees() {
    if (!connection) return
    setSyncing(true); setMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('gusto-proxy', {
        body: { action:'sync-employees', company_id:companyId }
      })
      if (error) throw new Error(error.message)
      setMsg({ ok:true, text: `${data?.synced||0} employees synced to Gusto.` })
    } catch(e) {
      setMsg({ ok:false, text: e.message })
    }
    setSyncing(false)
  }

  return (
    <div style={s.card}>
      <div style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'16px' }}>Gusto Settings</div>
      {msg && <div style={{ padding:'10px 14px', borderRadius:'var(--radius-sm)', marginBottom:'14px', fontSize:'12px', background:msg.ok?'var(--color-success-bg)':'var(--color-danger-bg)', color:msg.ok?'var(--color-success)':'var(--color-danger)', border:`1px solid ${msg.ok?'rgba(58,170,106,0.3)':'rgba(192,57,43,0.3)'}` }}>{msg.text}</div>}
      <div style={{ marginBottom:'16px' }}>
        <div style={s.lbl}>Gusto Company ID</div>
        <input style={{ ...s.inp, color:'var(--text-muted)', cursor:'not-allowed' }} value={connection?.gusto_company_id||'Not connected'} readOnly/>
      </div>
      <div style={{ marginBottom:'20px' }}>
        <div style={s.lbl}>Default Pay Schedule</div>
        <select style={{ ...s.inp, cursor:'pointer' }} value={form.pay_schedule} onChange={e=>setForm(p=>({...p,pay_schedule:e.target.value}))} onFocus={foc} onBlur={blr}>
          <option value="weekly">Weekly (Mon–Sun)</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="semimonthly">Semi-monthly (1st & 15th)</option>
        </select>
      </div>
      {connection && (
        <button onClick={syncEmployees} disabled={syncing} style={{ ...s.btn, opacity:syncing?0.6:1 }}>
          <Icon name="refresh-cw" size={14}/>{syncing?'SYNCING...':'SYNC EMPLOYEES TO GUSTO'}
        </button>
      )}
      <div style={{ marginTop:'20px', padding:'14px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6 }}>
        For help configuring payroll or troubleshooting your Gusto connection, contact{' '}
        <a href="mailto:support@postcommand.app" style={{ color:'var(--accent)', textDecoration:'none' }}>support@postcommand.app</a>.
      </div>
    </div>
  )
}
