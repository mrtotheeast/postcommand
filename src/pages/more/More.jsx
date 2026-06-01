import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'

// ── Tile data ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'people',
    label: 'People & HR',
    icon: 'users',
    tiles: [
      { title:'Employee Directory',       desc:'Add, manage, and invite employees',                  path:'/personnel' },
      { title:'Profile Photo Approvals',  desc:'Approve employee profile photos',                    path:'/personnel',  soon:true },
      { title:'Team Assignments',         desc:'Assign employees to supervisors',                    path:'/personnel' },
      { title:'Bulk Employee Actions',    desc:'Mass employee operations',                           path:'/personnel' },
      { title:'Onboarding Management',    desc:'Manage new hire docs, tasks & compliance',           path:'/hr' },
      { title:'Performance Reviews',      desc:'Employee evaluations',                               soon:true },
      { title:'Recognition System',       desc:'Recognize employee achievements',                    soon:true },
      { title:'Position Management',      desc:'Manage roles and pay rates',                         soon:true },
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    icon: 'activity',
    tiles: [
      { title:'Scheduling',              desc:'Create and manage schedules',                         path:'/scheduling' },
      { title:'Timesheet Management',    desc:'Review & approve timesheets',                         path:'/timesheets' },
      { title:'Patrol Review',           desc:'Review completed patrol sessions',                    path:'/patrol' },
      { title:'Patrol Playback',         desc:'Replay patrol routes with maps',                      path:'/patrol' },
      { title:'Live Map',                desc:'Track officers in real-time',                         path:'/map' },
      { title:'GPS Violations',          desc:'View geofence violations',                            path:'/hr' },
      { title:'QR Code Management',      desc:'Create and manage site QR codes',                     path:'/sites' },
      { title:'Site Check-In Config',    desc:'Configure site check-in settings',                    path:'/settings' },
      { title:'Site Inspections',        desc:'Inspection checklists',                               path:'/sites' },
      { title:'Shift Bidding',           desc:'Employees bid on open shifts',                        soon:true },
    ],
  },
  {
    id: 'incidents',
    label: 'Incidents & Security',
    icon: 'file-check',
    tiles: [
      { title:'Incident Approval',        desc:'Review and approve incident reports',                path:'/incidents' },
      { title:'Create Incident (AI)',     desc:'AI-assisted incident filing',                        path:'/incidents' },
      { title:'Incident Analysis',        desc:'Incident reporting & management',                    path:'/incidents' },
      { title:'AI Incident Analysis',     desc:'AI-powered pattern detection',                       soon:true },
      { title:'State Licensing',          desc:'Manage state security licenses',                     soon:true },
      { title:'Credentials Dashboard',    desc:'Monitor expiring licenses',                          path:'/hr' },
      { title:'Credentials Management',   desc:'Track employee certifications',                      path:'/hr' },
    ],
  },
  {
    id: 'clients',
    label: 'Clients & Sites',
    icon: 'briefcase',
    tiles: [
      { title:'Client Management',        desc:'Manage client accounts',                             soon:true },
      { title:'Client Onboarding',        desc:'Step-by-step new client setup',                     soon:true },
      { title:'Site Management',          desc:'Manage job sites and locations',                     path:'/sites' },
      { title:'Client Contracts',         desc:'Manage client agreements',                           soon:true },
      { title:'Client Communication Hub', desc:'Client messaging & updates',                         path:'/messaging' },
    ],
  },
  {
    id: 'training',
    label: 'Training & Development',
    icon: 'book-open',
    tiles: [
      { title:'Training Management',      desc:'Manage training courses',                            path:'/training' },
      { title:'AI Training Builder',      desc:'Generate AI-powered training',                       path:'/training' },
      { title:'Training Assignments',     desc:'Assign & track training progress',                   path:'/training' },
      { title:'Training Leaderboard',     desc:'Top training performers',                            path:'/training' },
      { title:'Badge Management',         desc:'Create training badges & rewards',                   soon:true },
      { title:'Certificate Templates',    desc:'Upload completion certificates',                     soon:true },
      { title:'Training Suggestions (AI)',desc:'AI-powered recommendations',                         soon:true },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Payroll',
    icon: 'dollar-sign',
    tiles: [
      { title:'Accounting Dashboard',     desc:'AR, aging reports & revenue',                        path:'/reports' },
      { title:'Invoices',                 desc:'View and manage all invoices',                        path:'/invoices' },
      { title:'Create Invoice',           desc:'Create a new client invoice',                        path:'/invoices' },
      { title:'Payroll Export',           desc:'Export payroll data to CSV / ADP / Paychex',         path:'/timesheets' },
      { title:'Payroll Settings',         desc:'Configure payroll provider & column mappings',       path:'/settings' },
      { title:'Tax Forms (W-2 & 1099)',   desc:'Generate year-end tax forms',                        soon:true },
      { title:'PTO Approval',             desc:'Approve/deny time off requests',                     path:'/timesheets' },
      { title:'PTO Calendar',             desc:'Full team time off calendar',                        path:'/timesheets' },
      { title:'PTO Settings',             desc:'Configure accrual rates & carryover',                path:'/settings' },
    ],
  },
  {
    id: 'docs',
    label: 'Documents & Communication',
    icon: 'message-circle',
    tiles: [
      { title:'Document Library',         desc:'Upload policies & company forms',                    path:'/hr' },
      { title:'Policy Management',        desc:'Company policies with AI',                           soon:true },
      { title:'Announcements',            desc:'Post company-wide announcements',                    path:'/messaging' },
      { title:'Team Messenger',           desc:'Team communication',                                  path:'/messaging' },
      { title:'DM Monitor (Admin)',        desc:'Security review of direct messages',                 path:'/messaging' },
      { title:'Uniform Inventory',        desc:'Track and manage uniform stock',                     path:'/uniforms' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics & Reports',
    icon: 'bar-chart-2',
    tiles: [
      { title:'Analytics Dashboard',      desc:'Comprehensive metrics & AI insights',                path:'/reports' },
      { title:'Reporting Dashboard',      desc:'All reports and exports',                            path:'/reports' },
      { title:'Patrol Analytics',         desc:'Patrol trends & completion rates',                   path:'/patrol' },
      { title:'Officer Analytics',        desc:'Individual officer performance',                     path:'/reports' },
      { title:'AI Reports',               desc:'Scheduled AI analytics',                             soon:true },
      { title:'Report Automation',        desc:'Automated report generation',                        soon:true },
      { title:'Weekly Site Reports',      desc:'Per-site weekly summaries',                          soon:true },
    ],
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: 'database',
    tiles: [
      { title:'Bulk Import Employees',    desc:'Import employees via CSV or AI PDF extraction',      path:'/personnel' },
      { title:'Bulk Import Job Sites',    desc:'Import sites via CSV or AI PDF extraction',          path:'/sites' },
    ],
  },
  {
    id: 'reference',
    label: 'Reference Tools',
    icon: 'map',
    tiles: [
      { title:'CCW Reciprocity Map',      desc:'Concealed carry laws & state reciprocity',           path:'/reciprocity', external:true },
    ],
  },
  {
    id: 'system',
    label: 'System & Settings',
    icon: 'settings',
    tiles: [
      { title:'Settings',                 desc:'App branding, PTO, scheduling & more',               path:'/settings' },
      { title:'Roles & Permissions',      desc:'Role-based access control',                          path:'/settings' },
      { title:'Audit Log',                desc:'View system audit trail',                            path:'/settings' },
      { title:'Super Admin',              desc:'Platform-wide oversight',                            path:'/admin',      superOnly:true },
    ],
  },
]

const QUICK_ACCESS = [
  { label:'Settings',   path:'/settings',   icon:'settings' },
  { label:'Schedule',   path:'/scheduling', icon:'calendar' },
  { label:'Timesheets', path:'/timesheets', icon:'clock' },
  { label:'Live Map',   path:'/map',        icon:'map-pin' },
  { label:'Incidents',  path:'/incidents',  icon:'file-check' },
  { label:'Training',   path:'/training',   icon:'book-open' },
  { label:'Invoices',   path:'/invoices',   icon:'credit-card' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page:       { padding:'24px', maxWidth:'1200px', animation:'fadeIn 200ms ease' },
  profileCard:{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'20px 24px', marginBottom:'28px', display:'flex', alignItems:'center', gap:'18px', flexWrap:'wrap' },
  avatar:     { width:'58px', height:'58px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'2px', color:'var(--text-inverse)', flexShrink:0 },
  name:       { fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 },
  email:      { fontSize:'13px', color:'var(--text-secondary)', marginTop:'4px' },
  roleBadge:  { display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'1px', background:'var(--accent-bg)', color:'var(--accent)', marginTop:'8px' },
  secWrap:    { marginBottom:'28px' },
  secHead:    { display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' },
  secIcon:    { width:'28px', height:'28px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  secLabel:   { fontFamily:'var(--font-condensed)', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'2px' },
  secLine:    { flex:1, height:'1px', background:'var(--border)' },
  tileGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'10px' },
  quickGrid:  { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'8px', marginBottom:'28px' },
  quickTile:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:'7px', cursor:'pointer', transition:'all 150ms ease' },
  quickIcon:  { width:'36px', height:'36px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center' },
  quickLabel: { fontSize:'11px', fontWeight:600, color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', textAlign:'center' },
  tile:       { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px', cursor:'pointer', transition:'all 150ms ease', display:'flex', flexDirection:'column', gap:'4px', position:'relative' },
  tileSoon:   { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 16px', cursor:'default', opacity:0.45, display:'flex', flexDirection:'column', gap:'4px', position:'relative' },
  tileTitle:  { fontSize:'13px', fontWeight:600, color:'var(--text-primary)', lineHeight:1.2 },
  tileDesc:   { fontSize:'11px', color:'var(--text-muted)', lineHeight:1.4 },
  soonBadge:  { position:'absolute', top:'8px', right:'8px', fontSize:'9px', fontFamily:'var(--font-condensed)', letterSpacing:'1px', color:'var(--text-muted)', background:'var(--border)', padding:'1px 6px', borderRadius:'4px' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function More() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role
  const [toast, setToast] = useState(null)

  const initials = profile
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
    : 'A'

  // Count coming-soon tiles across all sections
  const comingSoonCount = SECTIONS.reduce((acc, sec) => acc + sec.tiles.filter(t => t.soon).length, 0)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function go(tile) {
    if (tile.soon) { showToast('This feature is coming soon. Check back for updates.'); return }
    if (tile.external) { window.open(tile.path, '_blank'); return }
    navigate(tile.path)
  }

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(20px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
        .hub-tile:hover  { border-color:var(--accent-border)!important; background:var(--bg-card-hover)!important; }
        .hub-quick:hover { border-color:var(--accent-border)!important; background:var(--accent-bg)!important; }
      `}</style>

      {/* Coming-soon toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:500, background:'var(--bg-sidebar)', color:'var(--text-primary)', borderRadius:'var(--radius-md)', padding:'12px 20px', fontSize:'13px', boxShadow:'var(--shadow-modal)', whiteSpace:'nowrap', animation:'toastIn 200ms ease', border:'1px solid var(--border-subtle)' }}>
          {toast}
        </div>
      )}

      {/* Profile card */}
      <div style={s.profileCard}>
        <div style={s.avatar}>{initials}</div>
        <div style={{ flex:1 }}>
          <div style={s.name}>{profile?.first_name} {profile?.last_name}</div>
          <div style={s.email}>{profile?.email}</div>
          <div style={s.roleBadge}>
            <Icon name="shield" size={11} />{ROLE_LABELS[role] || role}
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1px' }}>Company</div>
            <div style={{ fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, color:'var(--accent)', letterSpacing:'1.5px' }}>
              {profile?.company_slug?.toUpperCase() || '—'}
            </div>
          </div>
          <button
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
            onClick={signOut}
          >
            <Icon name="log-out" size={13} />SIGN OUT
          </button>
        </div>
      </div>

      {/* Features in development count */}
      <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'16px', marginTop:'-8px' }}>
        {comingSoonCount} feature{comingSoonCount !== 1 ? 's' : ''} in development
      </div>

      {/* Quick Access */}
      <div style={s.secWrap}>
        <div style={s.secHead}>
          <div style={s.secIcon}><Icon name="zap" size={14} color="var(--accent)" /></div>
          <div style={s.secLabel}>Quick Access</div>
          <div style={s.secLine} />
        </div>
        <div style={s.quickGrid}>
          {QUICK_ACCESS.map(q => (
            <button key={q.path} className="hub-quick" style={s.quickTile} onClick={() => navigate(q.path)}>
              <div style={s.quickIcon}><Icon name={q.icon} size={18} color="var(--accent)" /></div>
              <div style={s.quickLabel}>{q.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => {
        const tiles = section.tiles.filter(t => !t.superOnly || role === 'super_admin')
        return (
          <div key={section.id} style={s.secWrap}>
            <div style={s.secHead}>
              <div style={s.secIcon}><Icon name={section.icon} size={14} color="var(--accent)" /></div>
              <div style={s.secLabel}>{section.label}</div>
              <div style={s.secLine} />
            </div>
            <div style={s.tileGrid}>
              {tiles.map(tile => (
                <div
                  key={tile.title}
                  className={tile.soon ? '' : 'hub-tile'}
                  style={tile.soon ? s.tileSoon : s.tile}
                  onClick={() => go(tile)}
                >
                  {tile.soon && <span style={s.soonBadge}>SOON</span>}
                  <div style={s.tileTitle}>{tile.title}</div>
                  <div style={s.tileDesc}>{tile.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
