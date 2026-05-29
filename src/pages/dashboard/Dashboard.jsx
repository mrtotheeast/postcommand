import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { DASHBOARD_TILES, ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import Badge from '../../components/ui/Badge'

export default function Dashboard() {
  const { profile } = useAuth()
  const { badges } = useNotifications()
  const navigate = useNavigate()
  const role = profile?.role
  const tiles = DASHBOARD_TILES.filter(t => t.roles.includes(role))
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
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'28px',gap:'16px'}}>
        <div>
          <div style={{fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)'}}>{greeting},</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:'32px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1.1,margin:'2px 0 4px'}}>{profile?.first_name ?? 'Officer'}</div>
          <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{ROLE_LABELS[role]} · {dateStr}</div>
        </div>
        <div style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--accent)',lineHeight:1,flexShrink:0}}>{timeStr}</div>
      </div>

      <StatCards role={role} badges={badges} />

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
