import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'

export default function Inbox() {
  const { profile } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    if (profile?.id) load()
  }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('dar_recipient')
      .select('id, dar_id, read_at, created_at, dar:dar_id(id, shift_label, shift_date, status, created_at, site:site_id(name))')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function openItem(item) {
    setSelected(item)
    if (!item.read_at) {
      await supabase
        .from('dar_recipient')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.id)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
    }
  }

  const filtered = items.filter(i => {
    if (filter === 'unread') return !i.read_at
    if (filter === 'read')   return  !!i.read_at
    return true
  })

  const unreadCount = items.filter(i => !i.read_at).length

  return (
    <div style={{ padding:'24px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, display:'flex', alignItems:'center', gap:'12px' }}>
            INBOX
            {unreadCount > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:'22px', height:'22px', borderRadius:'11px', background:'var(--accent)', color:'var(--text-inverse)', fontSize:'11px', fontFamily:'var(--font-condensed)', fontWeight:700, padding:'0 6px' }}>
                {unreadCount}
              </span>
            )}
          </h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>Daily Activity Reports delivered to you</p>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {['all','unread','read'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'6px 14px', borderRadius:'var(--radius-sm)', border:`1px solid ${filter===f?'var(--accent-border)':'var(--border)'}`, background: filter===f ? 'var(--accent-bg)' : 'transparent', color: filter===f ? 'var(--accent)' : 'var(--text-muted)', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'0.5px', fontWeight:700, cursor:'pointer', textTransform:'uppercase', transition:'all 150ms ease' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div>{[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:'70px', borderRadius:'8px', marginBottom:'8px' }} />)}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
          <Icon name="mail" size={40} color="var(--border-subtle)" />
          <div style={{ marginTop:'16px', fontSize:'15px' }}>
            {filter === 'unread' ? 'No unread reports' : 'No reports yet'}
          </div>
          <div style={{ fontSize:'12px', marginTop:'6px' }}>
            {filter === 'unread' ? "You're all caught up." : 'Daily Activity Reports sent to you will appear here.'}
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          {filtered.map((item, i) => {
            const dar    = item.dar
            const isRead = !!item.read_at
            const fmtDate = dar?.shift_date
              ? new Date(dar.shift_date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
              : '—'
            const receivedDate = new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })
            return (
              <div key={item.id} onClick={() => openItem(item)}
                style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 150ms ease', background: isRead ? '' : 'rgba(201,162,39,0.03)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background= isRead ? '' : 'rgba(201,162,39,0.03)'}
              >
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: isRead ? 'transparent' : 'var(--accent)', flexShrink:0, transition:'background 200ms ease' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'13px', fontWeight: isRead ? 400 : 700, color:'var(--text-primary)', whiteSpace:'nowrap' }}>
                      {dar?.site?.name || 'Unknown Site'}
                    </span>
                    {dar?.shift_label && (
                      <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{dar.shift_label}</span>
                    )}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'3px' }}>
                    Daily Activity Report · {fmtDate}
                  </div>
                </div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', flexShrink:0, whiteSpace:'nowrap' }}>{receivedDate}</div>
                <Icon name="chevron-right" size={14} color="var(--text-muted)" />
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <InboxDarModal item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function InboxDarModal({ item, onClose }) {
  const [dar, setDar] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('dar')
      .select('*, site:site_id(name,address,city,state), company:company_id(name,logo_url,company_phone,company_email)')
      .eq('id', item.dar_id)
      .maybeSingle()
      .then(({ data }) => { setDar(data); setLoading(false) })
  }, [item.dar_id])

  function Section({ title, content }) {
    if (!content?.trim()) return null
    return (
      <div style={{ marginBottom:'18px' }}>
        <div style={{ fontSize:'10px', fontFamily:'var(--font-condensed)', letterSpacing:'1.5px', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'6px', borderBottom:'1px solid var(--border)', paddingBottom:'4px' }}>{title}</div>
        <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{content}</div>
      </div>
    )
  }

  const fmtDate = dar?.shift_date
    ? new Date(dar.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
    : ''

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'32px', width:'100%', maxWidth:'620px', boxShadow:'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>Loading...</div>
        ) : !dar ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--color-danger)' }}>Report not found.</div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', gap:'12px' }}>
              <div>
                {dar.company?.logo_url && (
                  <img src={dar.company.logo_url} alt="logo" style={{ height:'36px', objectFit:'contain', marginBottom:'12px', display:'block' }} />
                )}
                <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>DAILY ACTIVITY REPORT</div>
                <div style={{ fontSize:'14px', color:'var(--text-secondary)', marginTop:'6px', fontWeight:600 }}>{dar.site?.name || '—'}</div>
                {dar.site?.city && (
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{dar.site.city}{dar.site.state ? `, ${dar.site.state}` : ''}</div>
                )}
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{dar.shift_label || 'General Shift'} · {fmtDate}</div>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                {dar.pdf_url && (
                  <a href={dar.pdf_url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 14px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-secondary)', textDecoration:'none', cursor:'pointer', letterSpacing:'0.5px' }}
                  >
                    <Icon name="download" size={13} />PDF
                  </a>
                )}
                <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' }}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>

            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'20px' }}>
              <Section title="Officers on Duty"           content={dar.officers_on_duty} />
              <Section title="Incident Summary"           content={dar.incident_summary} />
              <Section title="Patrol Summary"             content={dar.patrol_summary} />
              <Section title="Maintenance Concerns"       content={dar.maintenance_concerns} />
              <Section title="Resident / Client Concerns" content={dar.resident_concerns} />
              <Section title="Other Notes"                content={dar.other_notes} />
            </div>

            {(dar.company?.company_phone || dar.company?.company_email) && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px', marginTop:'4px', fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                {dar.company.company_phone && <span><Icon name="phone" size={11} /> {dar.company.company_phone}</span>}
                {dar.company.company_email && <span><Icon name="mail" size={11} /> {dar.company.company_email}</span>}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', borderTop:'1px solid var(--border)', paddingTop:'16px', marginTop:'16px' }}>
              <button onClick={onClose} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'1px', color:'var(--text-secondary)', cursor:'pointer' }}>
                CLOSE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
