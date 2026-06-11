import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { supabase } from '../../lib/supabase'
import { DASHBOARD_TILES, ROLE_LABELS, atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import Badge from '../../components/ui/Badge'

export default function Dashboard() {
  const { profile, effectiveRole, companyId } = useAuth()
  const { badges } = useNotifications()
  const navigate = useNavigate()

  if (!profile) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',color:'var(--text-muted)',fontSize:'14px'}}>
      Loading your dashboard...
    </div>
  )

  // Route to role-specific dashboard
  if (effectiveRole === 'client')   return <ClientDashboard profile={profile} />

  if (effectiveRole === 'corporal') return <CorporalDashboard profile={profile} badges={badges} navigate={navigate} />
  if (effectiveRole === 'officer')  return <OfficerDashboard profile={profile} badges={badges} navigate={navigate} />

  return <MainDashboard profile={profile} effectiveRole={effectiveRole} badges={badges} navigate={navigate} />
}

// ── DAR Widgets ───────────────────────────────────────────────────────────────

function DarDueWidget({ profile, navigate }) {
  const [due, setDue] = useState([])
  useEffect(() => {
    if (!profile?.company_id || !atLeast(profile.role, 'sergeant')) return
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('site').select('id,name').eq('company_id', profile.company_id).eq('requires_dar', true)
      .then(({ data: darSites }) => {
        if (!darSites?.length) return
        supabase.from('dar').select('site_id').eq('company_id', profile.company_id).eq('shift_date', today)
          .then(({ data: todayDars }) => {
            const covered = new Set((todayDars||[]).map(d => d.site_id))
            setDue((darSites||[]).filter(s => !covered.has(s.id)))
          })
      })
  }, [profile])
  if (!due.length) return null
  return (
    <div style={{ background:'var(--color-warning-bg)', border:'1px solid rgba(232,148,58,0.4)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', cursor:'pointer' }}
      onClick={() => navigate('/dar')}
    >
      <Icon name="alert-circle" size={16} color="var(--color-warning)" />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--color-warning)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>DAR REQUIRED TODAY</div>
        <div style={{ fontSize:'11px', color:'var(--text-secondary)', marginTop:'2px' }}>{due.map(s => s.name).join(', ')}</div>
      </div>
      <Icon name="chevron-right" size={14} color="var(--color-warning)" />
    </div>
  )
}

function ClientDarWidget({ profile, navigate }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('dar_recipient').select('id,read_at,dar:dar_id(shift_date,site:site_id(name))').eq('user_id', profile.id).order('created_at',{ascending:false}).limit(4)
      .then(({ data }) => {
        setItems(data||[])
        setUnread((data||[]).filter(i => !i.read_at).length)
      })
  }, [profile])
  if (!items.length) return null
  return (
    <div style={{ marginBottom:'20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <div style={{ fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'var(--font-condensed)', display:'flex', alignItems:'center', gap:'8px' }}>
          Activity Reports
          {unread > 0 && <span style={{ background:'var(--accent)', color:'var(--text-inverse)', borderRadius:'10px', padding:'1px 7px', fontSize:'10px', fontWeight:700 }}>{unread}</span>}
        </div>
        <button onClick={() => navigate('/inbox')} style={{ background:'transparent', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'0.5px' }}>VIEW ALL</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {items.map(item => {
          const isRead = !!item.read_at
          const fmtDate = item.dar?.shift_date ? new Date(item.dar.shift_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'
          return (
            <div key={item.id} onClick={() => navigate('/inbox')}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'background 150ms ease' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--bg-card)'}
            >
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:isRead?'transparent':'var(--accent)', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'12px', fontWeight:isRead?400:600, color:'var(--text-primary)' }}>{item.dar?.site?.name || 'Unknown Site'}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>Daily Activity Report · {fmtDate}</div>
              </div>
              <Icon name="chevron-right" size={13} color="var(--text-muted)" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Dashboard (Chief / Lieutenant / Sergeant / HR / Accounting) ──────────

function OnboardingChecklist({ companyId }) {
  const [data, setData] = useState(null)
  const navigate = useNavigate()
  const DISMISSED_KEY = `pc-onboard-done-${companyId}`

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) { setData('dismissed'); return }
    if (!companyId) return
    Promise.all([
      supabase.from('company').select('name').eq('id', companyId).single(),
      supabase.from('site').select('id').eq('company_id', companyId).limit(1),
      supabase.from('employee').select('id').eq('company_id', companyId).limit(1),
      supabase.from('shift').select('id').eq('company_id', companyId).limit(1),
    ]).then(([{ data: co }, { data: sites }, { data: emps }, { data: shifts }]) => {
      setData({ hasCompanyName: !!co?.name?.trim(), hasSite: !!(sites?.length), hasEmployee: !!(emps?.length), hasSchedule: !!(shifts?.length) })
    })
  }, [companyId])

  if (!data || data === 'dismissed') return null

  const items = [
    { done: data.hasCompanyName, label: 'Add your company info', path: '/settings', hint: 'Settings → Company Profile' },
    { done: data.hasSite,        label: 'Add your first site',   path: '/sites',    hint: 'Site Management' },
    { done: data.hasEmployee,    label: 'Add your first employee', path: '/personnel', hint: 'Personnel' },
    { done: data.hasSchedule,    label: 'Set up your first schedule', path: '/scheduling', hint: 'Scheduling' },
    { done: false,               label: 'Connect Gusto for payroll', path: '/payroll', hint: 'Optional — Payroll' },
  ]
  const allDone = items.filter(i => i.done).length >= 4

  if (allDone) {
    localStorage.setItem(DISMISSED_KEY, '1')
    return null
  }

  return (
    <div style={{ background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-lg)', padding:'20px 24px', marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'1.5px', color:'var(--accent)' }}>GETTING STARTED</div>
        <button onClick={() => { localStorage.setItem(DISMISSED_KEY,'1'); setData('dismissed') }} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-condensed)' }}>DISMISS</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {items.map((item, i) => (
          <div key={i} onClick={() => !item.done && navigate(item.path)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:item.done?'var(--color-success-bg)':'var(--bg-card)', border:`1px solid ${item.done?'rgba(58,170,106,0.3)':'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', cursor:item.done?'default':'pointer', transition:'all 150ms ease' }}
            onMouseEnter={e=>{ if (!item.done) e.currentTarget.style.borderColor='var(--accent-border)' }}
            onMouseLeave={e=>{ if (!item.done) e.currentTarget.style.borderColor='var(--border-subtle)' }}
          >
            <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${item.done?'var(--color-success)':'var(--border)'}`, background:item.done?'var(--color-success)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'13px', fontWeight:600, color:item.done?'var(--color-success)':'var(--text-primary)', textDecoration:item.done?'line-through':'none' }}>{item.label}</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{item.hint}</div>
            </div>
            {!item.done && <Icon name="chevron-right" size={14} color="var(--text-muted)"/>}
          </div>
        ))}
      </div>
    </div>
  )
}

function MainDashboard({ profile, effectiveRole, badges, navigate }) {
  const tiles = DASHBOARD_TILES.filter(t => t.roles.includes(effectiveRole))
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const timeStr = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})

  const tileColors = {
    blue:{bg:'var(--tile-blue)',icon:'var(--tile-blue-icon)'},
    gold:{bg:'var(--tile-gold)',icon:'var(--tile-gold-icon)'},
    red:{bg:'var(--tile-red)',icon:'var(--tile-red-icon)'},
    green:{bg:'var(--tile-green)',icon:'var(--tile-green-icon)'},
    purple:{bg:'var(--tile-purple)',icon:'var(--tile-purple-icon)'},
    teal:{bg:'var(--tile-teal)',icon:'var(--tile-teal-icon)'},
  }

  return (
    <div style={{padding:'24px',maxWidth:'1100px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {['super_admin','chief','lieutenant'].includes(effectiveRole) && <OnboardingChecklist companyId={profile?.company_id}/>}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'28px',gap:'16px'}}>
        <div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{greeting},</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:'32px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1.1,margin:'2px 0 4px'}}>{profile?.first_name || ROLE_LABELS[effectiveRole] || 'Welcome'}</div>
          <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{ROLE_LABELS[effectiveRole]} · {dateStr}</div>
        </div>
        <div style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--accent)',lineHeight:1,flexShrink:0}}>{timeStr}</div>
      </div>

      <StatCards role={effectiveRole} badges={badges} />

      {atLeast(effectiveRole, 'sergeant') && <DarDueWidget profile={profile} navigate={navigate} />}

      <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Quick Access</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
        {tiles.map(tile => {
          const count = tile.badgeKey ? badges[tile.badgeKey] : 0
          const col = tileColors[tile.color] || tileColors.blue
          return (
            <button key={tile.id} onClick={() => navigate(tile.path)}
              style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'18px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',boxShadow:'var(--shadow-card)',display:'flex',flexDirection:'column',gap:'6px',minHeight:'44px'}}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-border)'; e.currentTarget.style.background='var(--bg-card-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-card)' }}
            >
              <div style={{width:'36px',height:'36px',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px',background:col.bg}}>
                <Icon name={tile.icon} size={20} color={col.icon} />
              </div>
              <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                {tile.label}{count > 0 && <Badge count={count} />}
              </div>
              <div style={{fontSize:'12px',color:'var(--text-muted)',lineHeight:1.4}}>{tile.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatCards({ role, badges }) {
  const isAdmin = ['super_admin','chief','lieutenant'].includes(role)
  const isSupervisor = role === 'sergeant'
  const isAccounting = role === 'accounting'
  const cards = []

  if (isAdmin) {
    cards.push(
      {label:'Open Incidents',value:badges.open_incidents||0,color:badges.open_incidents>0?'#e05555':'var(--text-secondary)',sub:'Awaiting review'},
      {label:'Pending Timesheets',value:badges.pending_timesheets||0,color:badges.pending_timesheets>0?'#e8943a':'var(--text-secondary)',sub:'Awaiting approval'},
      {label:'Unread Messages',value:badges.unread_messages||0,color:badges.unread_messages>0?'#5b9fe0':'var(--text-secondary)',sub:'Internal + client'},
    )
  } else if (isSupervisor) {
    cards.push(
      {label:'Open Incidents',value:badges.open_incidents||0,color:badges.open_incidents>0?'#e05555':'var(--text-secondary)',sub:'Your site'},
      {label:'Messages',value:badges.unread_messages||0,color:badges.unread_messages>0?'#5b9fe0':'var(--text-secondary)',sub:'Unread'},
    )
  } else if (isAccounting) {
    cards.push(
      {label:'Pending Invoices',value:badges.pending_invoices||0,color:'var(--text-secondary)',sub:'Awaiting payment'},
    )
  }

  if (!cards.length) return null
  return (
    <div style={{marginBottom:'28px'}}>
      <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Status</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'12px'}}>
        {cards.map((c,i) => (
          <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',boxShadow:'var(--shadow-card)'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>{c.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'1px',lineHeight:1,color:c.color}}>{c.value}</div>
            <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'4px'}}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Officer Dashboard ─────────────────────────────────────────────────────────

function OfficerDashboard({ profile, badges, navigate }) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const dateStr = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
  const displayName = profile?.first_name
    || (profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Officer')
  const [shifts, setShifts] = useState([])
  const [shiftsLoading, setShiftsLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) { setShiftsLoading(false); return }
    const today = new Date().toISOString().slice(0, 10)
    async function load() {
      const { data: emp } = await supabase.from('employee')
        .select('id')
        .eq('email', profile.email || '')
        .eq('company_id', profile.company_id)
        .maybeSingle()
      if (!emp?.id) { setShiftsLoading(false); return }
      const { data } = await supabase.from('shift')
        .select('id,date,start_time,end_time,site:site_id(name)')
        .eq('employee_id', emp.id)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(5)
      setShifts(data || [])
      setShiftsLoading(false)
    }
    load().catch(() => setShiftsLoading(false))
  }, [profile])

  function fmtShift(s) {
    const d = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
    const t = v => v ? new Date('1970-01-01T' + v).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : ''
    return `${d}${s.start_time ? ' · ' + t(s.start_time) : ''}${s.end_time ? ' – ' + t(s.end_time) : ''}`
  }

  return (
    <div style={{padding:'24px',maxWidth:'800px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{marginBottom:'24px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{greeting},</div>
        <div style={{fontFamily:'var(--font-display)',fontSize:'32px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1.1,margin:'2px 0 4px'}}>{displayName}</div>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>Officer · {dateStr}</div>
      </div>

      {/* Prominent Clock In CTA */}
      <button onClick={() => navigate('/clockin')}
        style={{display:'flex',alignItems:'center',gap:'14px',width:'100%',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-md)',padding:'16px 20px',marginBottom:'20px',cursor:'pointer',textAlign:'left',boxShadow:'0 4px 16px rgba(201,162,39,0.25)',transition:'opacity 150ms ease'}}
        onMouseEnter={e=>e.currentTarget.style.opacity='0.9'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
        <div style={{width:'42px',height:'42px',borderRadius:'var(--radius-sm)',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon name="log-in" size={22} color="var(--text-inverse)"/>
        </div>
        <div>
          <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'1.5px'}}>CLOCK IN / OUT</div>
          <div style={{fontSize:'12px',opacity:0.8,marginTop:'2px'}}>Start or end your shift</div>
        </div>
      </button>

      {/* Upcoming shifts */}
      <div style={{marginBottom:'24px'}}>
        <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Upcoming Shifts</div>
        {shiftsLoading ? (
          <div style={{color:'var(--text-muted)',fontSize:'12px',padding:'14px 16px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)'}}>Loading...</div>
        ) : shifts.length === 0 ? (
          <div style={{color:'var(--text-muted)',fontSize:'13px',padding:'14px 16px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)'}}>No shifts scheduled yet.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {shifts.map(s => (
              <div key={s.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px'}}>
                <Icon name="calendar" size={15} color="var(--accent)"/>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{s.site?.name || 'Unassigned'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>{fmtShift(s)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Quick Access</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px'}}>
        {[
          {label:'My Schedule',   desc:'View your upcoming shifts',  path:'/scheduling', icon:'calendar',       color:'#5b9fe0'},
          {label:'My Timesheets', desc:'Review your hours',           path:'/timesheets', icon:'clock',          color:'#c9a227'},
          {label:'File Incident', desc:'Submit a field report',       path:'/incidents',  icon:'file-check',     color:'#e05555'},
          {label:'Patrol Log',    desc:'Log patrol checkpoints',      path:'/patrol',     icon:'activity',       color:'#5b9fe0'},
          {label:'SOS',           desc:'Emergency alert',             path:'/sos',        icon:'alert-triangle', color:'#e05555'},
          {label:'Messaging',     desc:'Team communication',          path:'/messaging',  icon:'message-circle', color:'#a07ae0', badge:badges.unread_messages},
          {label:'Training',      desc:'My assigned courses',         path:'/training',   icon:'book-open',      color:'#3aaa6a'},
          {label:'Activity Reports',desc:'Daily activity reports',     path:'/dar',        icon:'file-text',      color:'#5b9fe0'},
        ].map(t => (
          <button key={t.path} onClick={() => navigate(t.path)}
            style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',display:'flex',flexDirection:'column',gap:'6px'}}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-border)'; e.currentTarget.style.background='var(--bg-card-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-card)' }}
          >
            <div style={{width:'34px',height:'34px',borderRadius:'8px',background:`${t.color}22`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'2px'}}>
              <Icon name={t.icon} size={18} color={t.color}/>
            </div>
            <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:'6px'}}>
              {t.label}{t.badge > 0 && <Badge count={t.badge}/>}
            </div>
            <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Corporal Dashboard ────────────────────────────────────────────────────────

function CorporalDashboard({ profile, badges, navigate }) {
  const [teamStatus, setTeamStatus] = useState([])
  const [pendingTS, setPendingTS] = useState(0)
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  useEffect(() => {
    if (!profile?.company_id) return
    const today = new Date().toISOString().slice(0,10)
    Promise.all([
      supabase.from('timesheet').select('id,employee_id,clock_in,clock_out,status').eq('company_id', profile.company_id).eq('date', today),
      supabase.from('timesheet').select('id').eq('company_id', profile.company_id).eq('status','pending'),
    ]).then(([{data: ts}, {data: pending}]) => {
      setTeamStatus(ts||[])
      setPendingTS(pending?.length||0)
      setLoading(false)
    })
  }, [profile])

  const clockedIn = (teamStatus || []).filter(t => t.clock_in && !t.clock_out).length
  const clockedOut = (teamStatus || []).filter(t => t.clock_in && t.clock_out).length

  return (
    <div style={{padding:'24px',maxWidth:'900px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{marginBottom:'24px'}}>
        <div style={{fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{greeting},</div>
        <div style={{fontFamily:'var(--font-display)',fontSize:'32px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1.1,margin:'2px 0 4px'}}>{profile?.first_name || 'Corporal'}</div>
        <div style={{fontSize:'12px',color:'var(--text-muted)'}}>Corporal · {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'12px',marginBottom:'24px'}}>
        {[
          {label:'Clocked In Today',value:clockedIn,color:'var(--color-success)'},
          {label:'Completed Shifts',value:clockedOut,color:'var(--text-primary)'},
          {label:'Pending Timesheets',value:pendingTS,color:pendingTS>0?'var(--color-warning)':'var(--text-secondary)'},
          {label:'Messages',value:badges.unread_messages||0,color:badges.unread_messages>0?'#5b9fe0':'var(--text-secondary)'},
        ].map((c,i) => (
          <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px'}}>
            <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>{c.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'28px',color:c.color,lineHeight:1}}>{loading?'—':c.value}</div>
          </div>
        ))}
      </div>

      <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Quick Access</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px'}}>
        {[
          {label:'Clock In / Out',desc:'Start or end your shift',path:'/clockin',icon:'log-in',color:'#3aaa6a'},
          {label:'Timesheets',desc:'Approve team timesheets',path:'/timesheets',icon:'clock',color:'var(--accent)',badge:pendingTS},
          {label:'Schedule',desc:'Team schedule view',path:'/scheduling',icon:'calendar',color:'#5b9fe0'},
          {label:'Incidents',desc:'View and file incidents',path:'/incidents',icon:'file-check',color:'#e05555',badge:badges.open_incidents},
          {label:'Patrol Logs',desc:'Team patrol activity',path:'/patrol',icon:'activity',color:'#5b9fe0'},
          {label:'SOS',desc:'Emergency alert',path:'/sos',icon:'alert-triangle',color:'#e05555'},
          {label:'Messaging',desc:'Team communication',path:'/messaging',icon:'message-circle',color:'#a07ae0',badge:badges.unread_messages},
          {label:'Training',desc:'Team training progress',path:'/training',icon:'book-open',color:'#3aaa6a'},
          {label:'Activity Reports',desc:'Daily activity reports',path:'/dar',icon:'file-text',color:'#5b9fe0'},
        ].map(t => (
          <button key={t.path} onClick={() => navigate(t.path)}
            style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',display:'flex',flexDirection:'column',gap:'6px'}}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent-border)'; e.currentTarget.style.background='var(--bg-card-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-subtle)'; e.currentTarget.style.background='var(--bg-card)' }}
          >
            <div style={{width:'34px',height:'34px',borderRadius:'8px',background:`${t.color}22`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'2px'}}>
              <Icon name={t.icon} size={18} color={t.color}/>
            </div>
            <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:'6px'}}>
              {t.label}{t.badge > 0 && <Badge count={t.badge}/>}
            </div>
            <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Client Dashboard ──────────────────────────────────────────────────────────

function ClientDashboard({ profile }) {
  const navigate = useNavigate()
  const [data, setData] = useState({ sites:[], incidents:[], patrols:[] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.company_id) return
    const since = new Date(Date.now() - 30*86400000).toISOString()
    Promise.all([
      supabase.from('site').select('id,name,address,status').eq('company_id', profile.company_id).limit(10),
      supabase.from('incident_report').select('id,incident_type,status,created_at,site_id').eq('company_id', profile.company_id).gte('created_at', since).order('created_at',{ascending:false}).limit(10),
      supabase.from('patrol_log').select('id,site_id,started_at,ended_at,status').eq('company_id', profile.company_id).gte('started_at', since).order('started_at',{ascending:false}).limit(8),
    ]).then(([{data:sites},{data:incidents},{data:patrols}]) => {
      setData({ sites:sites||[], incidents:incidents||[], patrols:patrols||[] })
      setLoading(false)
    })
  }, [profile])

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

  return (
    <div style={{padding:'24px',maxWidth:'1000px',animation:'fadeIn 200ms ease'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{marginBottom:'24px'}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1}}>CLIENT PORTAL</div>
        <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'4px'}}>Security activity for your account · Last 30 days</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
        <div>
          <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Your Sites</div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div> :
              data.sites.length === 0 ? <div style={{color:'var(--text-muted)',fontSize:'13px',padding:'16px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)'}}>No sites on file.</div> :
              data.sites.map(site => (
                <div key={site.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:site.status==='active'?'var(--color-success)':'var(--border)',flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{site.name}</div>
                    {site.address && <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{site.address}</div>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div>
          <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Recent Incidents</div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {loading ? <div style={{color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div> :
              data.incidents.length === 0 ? <div style={{color:'var(--text-muted)',fontSize:'13px',padding:'16px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)'}}>No incidents in the last 30 days.</div> :
              data.incidents.slice(0,5).map(inc => (
                <div key={inc.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'10px 14px'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-primary)',textTransform:'capitalize'}}>{inc.incident_type?.replace(/_/g,' ') || 'Incident'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px',display:'flex',gap:'10px'}}>
                    <span>{fmtDate(inc.created_at)}</span>
                    <span style={{color:inc.status==='closed'?'var(--color-success)':'var(--color-warning)',fontWeight:600}}>{inc.status}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div>
        <div style={{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Recent Patrol Activity</div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',overflow:'hidden'}}>
          {loading ? <div style={{padding:'16px',color:'var(--text-muted)',fontSize:'12px'}}>Loading...</div> :
            data.patrols.length === 0 ? <div style={{padding:'16px',color:'var(--text-muted)',fontSize:'13px'}}>No patrol activity in the last 30 days.</div> :
            data.patrols.map((p,i) => (
              <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:i<data.patrols.length-1?'1px solid var(--border)':'none'}}>
                <div style={{fontSize:'12px',color:'var(--text-primary)',fontWeight:500}}>Patrol Session</div>
                <div style={{fontSize:'11px',color:'var(--text-muted)',display:'flex',gap:'12px'}}>
                  <span>{fmtDate(p.started_at)}</span>
                  <span style={{color:p.status==='completed'?'var(--color-success)':'var(--color-info)',fontWeight:600,fontFamily:'var(--font-condensed)',fontSize:'10px'}}>{p.status?.toUpperCase()}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      <ClientDarWidget profile={profile} navigate={navigate} />

      <div style={{marginTop:'20px',padding:'16px 20px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-md)',display:'flex',gap:'16px',alignItems:'center',flexWrap:'wrap'}}>
        <Icon name="phone" size={20} color="var(--accent)"/>
        <div>
          <div style={{fontSize:'13px',fontWeight:600,color:'var(--accent)',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>CONTACT YOUR ACCOUNT MANAGER</div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>support@postcommand.app</div>
        </div>
      </div>
    </div>
  )
}
