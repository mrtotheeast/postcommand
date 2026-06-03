import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNotifications } from '../../context/NotificationContext'
import { NAV_ITEMS, ROLE_LABELS, atLeast } from '../../config/roles'
import { isNative } from '../../lib/platform'
import Icon from '../ui/Icon'
import Badge from '../ui/Badge'

const s = {
  shell:{display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg-base)'},
  sidebar:{width:'var(--sidebar-width)',minWidth:'var(--sidebar-width)',background:'var(--bg-sidebar)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'},
  logoBar:{padding:'20px 18px 16px',borderBottom:'1px solid var(--border)',flexShrink:0},
  logo:{fontFamily:'var(--font-display)',fontSize:'22px',letterSpacing:'3px',color:'var(--accent)',lineHeight:1},
  logoSub:{fontSize:'10px',color:'var(--text-muted)',letterSpacing:'1px',textTransform:'uppercase',marginTop:'4px'},
  nav:{flex:1,padding:'10px 0',overflowY:'auto'},
  navSection:{fontSize:'9px',color:'var(--text-muted)',letterSpacing:'1.5px',textTransform:'uppercase',padding:'14px 18px 5px',fontFamily:'var(--font-condensed)'},
  navItem:{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 18px',fontSize:'13px',color:'var(--text-secondary)',background:'transparent',border:'none',borderLeft:'3px solid transparent',textAlign:'left',cursor:'pointer',transition:'all 150ms ease',minHeight:'44px'},
  navItemActive:{color:'var(--accent)',background:'var(--accent-bg)',borderLeft:'3px solid var(--accent)',fontWeight:600},
  navLabel:{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  footer:{padding:'14px 18px',borderTop:'1px solid var(--border)',flexShrink:0},
  userPill:{display:'flex',alignItems:'center',gap:'10px'},
  avatar:{width:'34px',height:'34px',minWidth:'34px',borderRadius:'50%',background:'var(--accent)',color:'var(--text-inverse)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'},
  userInfo:{flex:1,minWidth:0},
  userName:{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'},
  userRole:{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'1px'},
  signOutBtn:{background:'transparent',border:'none',color:'var(--text-muted)',padding:'6px',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:'44px',minWidth:'44px'},
  main:{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0},
  topbar:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',height:'58px',minHeight:'58px',background:'var(--bg-surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  topbarLeft:{display:'flex',alignItems:'center',gap:'12px'},
  pageTitle:{fontFamily:'var(--font-display)',fontSize:'18px',fontWeight:400,letterSpacing:'2.5px',color:'var(--text-primary)'},
  topbarRight:{display:'flex',alignItems:'center',gap:'8px'},
  iconBtn:{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',color:'var(--text-secondary)',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:'44px',minWidth:'44px',position:'relative',transition:'all 150ms ease'},
  notifDot:{position:'absolute',top:'8px',right:'8px',width:'8px',height:'8px',borderRadius:'50%',background:'var(--badge-bg)',border:'2px solid var(--bg-surface)'},
  notifPanel:{position:'absolute',top:'calc(100% + 8px)',right:0,width:'300px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-modal)',zIndex:200,overflow:'hidden'},
  notifHeader:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid var(--border)',fontSize:'13px',fontWeight:600,color:'var(--text-primary)'},
  notifClear:{background:'transparent',border:'none',fontSize:'12px',color:'var(--accent)',cursor:'pointer',minHeight:'44px',padding:'0 4px'},
  notifList:{maxHeight:'300px',overflowY:'auto'},
  notifEmpty:{padding:'24px',textAlign:'center',fontSize:'13px',color:'var(--text-muted)'},
  notifItem:{padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer'},
  notifTitle:{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'},
  notifMsg:{fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.4},
  content:{flex:1,overflowY:'auto',overflowX:'hidden'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:299},
  drawer:{position:'fixed',top:0,left:0,bottom:0,width:'var(--sidebar-width)',background:'var(--bg-sidebar)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',zIndex:300,transform:'translateX(-100%)',transition:'transform 250ms cubic-bezier(0.4,0,0.2,1)',boxShadow:'var(--shadow-modal)'},
  drawerOpen:{transform:'translateX(0)'},
  menuBtn:{display:'none',background:'transparent',border:'none',color:'var(--text-secondary)',padding:'8px',borderRadius:'var(--radius-sm)',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px',cursor:'pointer'},
}

export default function AppLayout({ children }) {
  const { profile, signOut, viewRole, switchViewAs, exitViewAs, effectiveRole } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { badges, totalUnread, notifications, markAllRead, markRead } = useNotifications()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [expandedSections, setExpandedSections] = useState(() => {
    const init = {}
    NAV_ITEMS.forEach(sec => { init[sec.section] = true })
    return init
  })
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const location = useLocation()
  const navigate = useNavigate()
  const actualRole = profile?.role
  const role = effectiveRole   // used everywhere below for nav filtering

  const canViewAs = atLeast(actualRole, 'sergeant')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setDrawerOpen(false); setNotifOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const native = isNative()
  const visibleSections = NAV_ITEMS
    .map(sec => ({ ...sec, items: sec.items.filter(item => item.roles.includes(role) && !(native && item.hideOnNative)) }))
    .filter(sec => sec.items.length > 0)

  const initials = profile ? `${profile.first_name?.[0]??''}${profile.last_name?.[0]??''}`.toUpperCase() || 'U' : 'U'
  const pageTitle = visibleSections.flatMap(s => s.items).find(item => location.pathname.startsWith(item.path))?.label ?? 'Command Center'

  function getBadgeCount(item) {
    if (!item.badge) return 0
    const map = { timesheets:'pending_timesheets', incidents:'open_incidents', messaging:'unread_messages', sos:'active_sos', training:'pending_training' }
    return badges[map[item.id]] || 0
  }

  const SidebarContent = () => (
    <>
      <div style={s.logoBar}>
        <div style={s.logo}>POST<span style={{color:'var(--text-primary)'}}>COMMAND</span></div>
        <div style={s.logoSub}>Security Workforce Management</div>
        {profile?.company_slug && (
          <div style={{display:'inline-block',marginTop:'6px',fontSize:'10px',fontFamily:'var(--font-condensed)',letterSpacing:'1.5px',color:'var(--accent)',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',padding:'2px 8px'}}>
            {profile.company_slug.toUpperCase()}
          </div>
        )}
        {profile?.company_id && (
          <div style={{marginTop:'4px',fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px'}}>
            Company ID: {profile.company_id}
          </div>
        )}
      </div>
      <nav style={s.nav}>
        {visibleSections.map(sec => {
          const isExpanded = expandedSections[sec.section] !== false
          return (
            <div key={sec.section}>
              <button onClick={() => setExpandedSections(prev => ({...prev, [sec.section]: !isExpanded}))}
                style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',background:'transparent',border:'none',cursor:'pointer',padding:'0'}}>
                <div style={s.navSection}>{sec.section}</div>
                <div style={{paddingRight:'14px',color:'var(--text-muted)',display:'flex',alignItems:'center'}}>
                  <Icon name={isExpanded?'chevron-up':'chevron-down'} size={11}/>
                </div>
              </button>
              {isExpanded && sec.items.map(item => {
                const active = location.pathname.startsWith(item.path)
                const count = getBadgeCount(item)
                return (
                  <button key={item.id} style={{...s.navItem,...(active?s.navItemActive:{})}}
                    onClick={() => { navigate(item.path); document.getElementById('main-content')?.scrollTo(0,0) }}
                    aria-current={active?'page':undefined}
                    data-tour={item.id}>
                    <Icon name={item.icon} size={17} />
                    <span style={s.navLabel}>{item.label}</span>
                    {count > 0 && <Badge count={count} />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>
      <div style={s.footer}>
        <div style={s.userPill}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.userInfo}>
            <div style={s.userName}>{profile?.first_name} {profile?.last_name}</div>
            <div style={s.userRole}>{ROLE_LABELS[actualRole] ?? actualRole}</div>
          </div>
          <button style={s.signOutBtn} onClick={signOut} aria-label="Sign out"><Icon name="log-out" size={16} /></button>
        </div>
        {canViewAs && (
          <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
            <Icon name="eye" size={12} color="var(--text-muted)"/>
            <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', flexShrink:0 }}>View As:</span>
            <select
              value={viewRole || ''}
              onChange={e => e.target.value ? switchViewAs(e.target.value) : exitViewAs()}
              style={{ flex:1, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'4px 6px', fontSize:'11px', color: viewRole ? 'var(--accent)' : 'var(--text-muted)', fontFamily:'var(--font-condensed)', cursor:'pointer', outline:'none' }}
            >
              <option value="">— Self ({ROLE_LABELS[actualRole]}) —</option>
              {['officer','corporal','sergeant','lieutenant','client'].filter(r => r !== actualRole).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div style={s.shell}>
      {!isMobile && <aside style={s.sidebar} className="sidebar" data-tour="sidebar"><SidebarContent /></aside>}
      {isMobile && drawerOpen && <div style={s.overlay} onClick={() => setDrawerOpen(false)} />}
      {isMobile && (
        <aside style={{...s.drawer,...(drawerOpen?s.drawerOpen:{})}} className="sidebar">
          <SidebarContent />
        </aside>
      )}
      <div style={s.main}>
        <header style={s.topbar}>
          <div style={s.topbarLeft}>
            {isMobile && (
              <button style={{...s.menuBtn,display:'flex'}} onClick={() => setDrawerOpen(o => !o)} aria-label="Open navigation">
                <Icon name="menu" size={20} />
              </button>
            )}
            {location.pathname !== '/dashboard' && (
              <button style={s.iconBtn} onClick={() => navigate(-1)} aria-label="Go back">
                <Icon name="arrow-left" size={18} />
              </button>
            )}
            <h1 style={s.pageTitle}>{pageTitle.toUpperCase()}</h1>
          </div>
          <div style={s.topbarRight}>
            <button style={s.iconBtn} onClick={toggleTheme} aria-label={`Switch to ${isDark?'light':'dark'} mode`}>
              <Icon name={isDark?'sun':'moon'} size={18} />
            </button>
            <div style={{position:'relative'}}>
              <button style={s.iconBtn} onClick={() => setNotifOpen(o => !o)} aria-label={`${totalUnread} notifications`}>
                <Icon name="bell" size={18} />
                {totalUnread > 0 && (
                  <span style={{...s.notifDot, display:'flex', alignItems:'center', justifyContent:'center', width:totalUnread>9?'16px':'12px', height:totalUnread>9?'16px':'12px', top:'5px', right:'5px', fontSize:'8px', color:'#fff', fontFamily:'var(--font-condensed)', fontWeight:700}}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={s.notifPanel}>
                  <div style={s.notifHeader}>
                    <span>Notifications {totalUnread > 0 && <span style={{fontSize:'11px',background:'var(--badge-bg)',color:'#fff',padding:'1px 6px',borderRadius:'10px',marginLeft:'4px'}}>{totalUnread}</span>}</span>
                    <button style={s.notifClear} onClick={markAllRead}>Mark all read</button>
                  </div>
                  <div style={s.notifList}>
                    {notifications.length === 0
                      ? <div style={s.notifEmpty}>No notifications</div>
                      : notifications.slice(0,20).map(n => {
                          const iconMap = { sos_alert:'alert-circle', timesheet_pending:'clock', incident_new:'flag', credential_expiring:'shield', geofence_override:'map-pin', general:'bell' }
                          const timeAgo = n.created_at ? (() => {
                            const diff = (Date.now() - new Date(n.created_at)) / 1000
                            if (diff < 60) return 'just now'
                            if (diff < 3600) return `${Math.floor(diff/60)}m ago`
                            if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
                            return `${Math.floor(diff/86400)}d ago`
                          })() : ''
                          return (
                            <div key={n.id}
                              style={{...s.notifItem,...(!n.read?{borderLeft:'3px solid var(--accent)'}:{}),cursor:n.target_url?'pointer':'default'}}
                              onClick={() => { if (n.target_url) { navigate(n.target_url); setNotifOpen(false) } markRead(n.id) }}
                            >
                              <div style={{display:'flex',alignItems:'flex-start',gap:'8px'}}>
                                <div style={{flexShrink:0,marginTop:'2px'}}><Icon name={iconMap[n.type]||'bell'} size={13} color={n.read?'var(--text-muted)':'var(--accent)'}/></div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{...s.notifTitle,color:n.read?'var(--text-muted)':'var(--text-primary)'}}>{n.title}</div>
                                  {n.message && <div style={s.notifMsg}>{n.message}</div>}
                                  <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'3px',fontFamily:'var(--font-condensed)'}}>{timeAgo}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {!isOnline && (
          <div style={{ background:'var(--color-warning)', color:'#fff', textAlign:'center', padding:'6px', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontWeight:700, flexShrink:0 }}>
            OFFLINE — Changes will sync when connection is restored
          </div>
        )}
        {viewRole && (
          <button onClick={exitViewAs} style={{ background:'var(--accent)', color:'var(--text-inverse)', textAlign:'center', padding:'7px 16px', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'1px', fontWeight:700, flexShrink:0, border:'none', cursor:'pointer', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
            <Icon name="eye" size={13}/>VIEWING AS {ROLE_LABELS[viewRole]?.toUpperCase() || viewRole.toUpperCase()} — CLICK TO EXIT
          </button>
        )}
        <main style={s.content} id="main-content">{children}</main>
      </div>
    </div>
  )
}
