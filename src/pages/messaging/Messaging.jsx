import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const CHANNELS = [
  { id:'general',       name:'General',       icon:'message-circle', desc:'All staff' },
  { id:'dispatch',      name:'Dispatch',      icon:'radio',          desc:'Operational comms' },
  { id:'supervisors',   name:'Supervisors',   icon:'shield',         desc:'Supervisors only' },
  { id:'announcements', name:'Announcements', icon:'bell',           desc:'Admin broadcasts' },
]

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
}
function roleColor(role) {
  const map = { super_admin:'var(--accent)', chief:'var(--accent)', lieutenant:'#7b68ee', sergeant:'#5ba3e8', corporal:'#5ba3e8', officer:'var(--text-secondary)', office_staff:'var(--text-muted)' }
  return map[role] || 'var(--text-muted)'
}
function roleLabel(role) {
  const map = { super_admin:'ADMIN', chief:'CHIEF', lieutenant:'LT', sergeant:'SGT', corporal:'CPL', officer:'OFC', office_staff:'STAFF', hr:'HR', accounting:'ACCTG' }
  return map[role] || role?.toUpperCase()
}

export default function Messaging() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab]         = useState('channels')
  const [activeChannel, setActiveChannel] = useState('general')
  const [activeDM, setActiveDM]           = useState(null)
  const [messages, setMessages]           = useState([])
  const [dmThreads, setDmThreads]         = useState([])
  const [employees, setEmployees]         = useState([])
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [showDMPicker, setShowDMPicker]   = useState(false)
  const [dmSearch, setDmSearch]           = useState('')
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const subRef         = useRef(null)

  const isAdmin      = atLeast(profile?.role, 'lieutenant')
  const canBroadcast = atLeast(profile?.role, 'sergeant')

  const visibleChannels = CHANNELS.filter(ch => {
    if (ch.id === 'supervisors') return atLeast(profile?.role, 'sergeant')
    return true
  })

  useEffect(() => { loadEmployees() }, [profile])
  useEffect(() => { loadMessages(); subscribeToMessages(); return () => subRef.current?.unsubscribe() }, [profile, activeChannel, activeDM, activeTab])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { if (activeTab === 'dms') loadDMThreads() }, [activeTab])

  async function loadEmployees() {
    if (!profile?.company_id) return
    const { data } = await supabase.from('employee').select('id,first_name,last_name,role,position_title').eq('company_id', profile.company_id).order('first_name')
    setEmployees(data || [])
  }

  async function loadMessages() {
    if (!profile?.company_id) return
    const channelId = activeTab === 'channels' ? activeChannel : (activeDM ? getDMId(profile.employee_id||'', activeDM) : null)
    if (!channelId) { setMessages([]); return }
    const { data } = await supabase.from('message').select('*').eq('company_id', profile.company_id).eq('channel_id', channelId).order('created_at', { ascending:true }).limit(100)
    setMessages(data || [])
  }

  async function loadDMThreads() {
    if (!profile?.company_id) return
    const { data } = await supabase.from('message').select('channel_id,sender_id,sender_name,content,created_at').eq('company_id', profile.company_id).like('channel_id', 'dm_%').order('created_at', { ascending:false })
    if (!data) return
    const threads = {}
    data.forEach(m => { if (!threads[m.channel_id]) threads[m.channel_id] = m })
    setDmThreads(Object.values(threads))
  }

  function getDMId(a, b) { return `dm_${[a,b].sort().join('_')}` }

  function subscribeToMessages() {
    subRef.current?.unsubscribe()
    const channelId = activeTab === 'channels' ? activeChannel : (activeDM ? getDMId(profile.employee_id||'', activeDM) : null)
    if (!channelId) return
    subRef.current = supabase.channel(`msg:${channelId}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'message', filter:`channel_id=eq.${channelId}` },
        payload => setMessages(prev => [...prev, payload.new]))
      .subscribe()
  }

  async function sendMessage() {
    if (!input.trim() || sending) return
    const channelId = activeTab === 'channels' ? activeChannel : getDMId(profile.employee_id||'', activeDM)
    const ch = CHANNELS.find(c => c.id === activeChannel)
    setSending(true)
    await supabase.from('message').insert({ company_id:profile.company_id, channel_id:channelId, channel_name:activeTab==='channels'?ch?.name:'DM', sender_id:profile.employee_id||null, sender_name:`${profile.first_name} ${profile.last_name}`, sender_role:profile.role, content:input.trim() })
    setInput(''); setSending(false); inputRef.current?.focus()
  }

  function handleKeyDown(e) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage() } }

  const canPost = useMemo(() => {
    if (activeTab==='dms') return !!activeDM
    if (activeChannel==='announcements') return canBroadcast
    if (activeChannel==='supervisors') return atLeast(profile?.role,'sergeant')
    return true
  }, [activeTab, activeChannel, activeDM, profile])

  const groupedMessages = useMemo(() => {
    const groups = []; let lastDate = null
    messages.forEach(m => {
      const d = new Date(m.created_at).toDateString()
      if (d !== lastDate) { groups.push({ type:'date', label:d===new Date().toDateString()?'Today':new Date(m.created_at).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) }); lastDate=d }
      groups.push({ type:'message', data:m })
    })
    return groups
  }, [messages])

  const filteredEmps = employees.filter(e => {
    if (e.id === profile.employee_id) return false
    if (!dmSearch) return true
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(dmSearch.toLowerCase())
  })

  const activeChInfo = CHANNELS.find(c => c.id === activeChannel)
  const activeDMEmp  = employees.find(e => e.id === activeDM)

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>

      {/* Sidebar */}
      <div style={{width:'260px',flexShrink:0,borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',background:'var(--bg-surface)'}}>
        <div style={{padding:'16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1,marginBottom:'12px'}}>MESSAGING</h2>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {[['channels','Channels'],['dms','Direct']].map(([v,l])=>(
              <button key={v} onClick={()=>setActiveTab(v)} style={{flex:1,height:'30px',border:'none',borderRadius:'4px',background:activeTab===v?'var(--accent-bg)':'transparent',color:activeTab===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'11px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
          {activeTab==='channels' ? visibleChannels.map(ch=>(
            <button key={ch.id} onClick={()=>setActiveChannel(ch.id)}
              style={{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 12px',border:'none',borderRadius:'var(--radius-md)',background:activeChannel===ch.id?'var(--accent-bg)':'transparent',cursor:'pointer',textAlign:'left',marginBottom:'2px'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'8px',background:activeChannel===ch.id?'var(--accent)':'var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon name={ch.icon} size={15} color={activeChannel===ch.id?'var(--text-inverse)':'var(--text-muted)'}/>
              </div>
              <div>
                <div style={{fontSize:'13px',fontWeight:600,color:activeChannel===ch.id?'var(--accent)':'var(--text-primary)'}}>{ch.name}</div>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{ch.desc}</div>
              </div>
            </button>
          )) : (
            <>
              <button onClick={()=>setShowDMPicker(true)} style={{display:'flex',alignItems:'center',gap:'8px',width:'100%',padding:'10px 12px',border:'1px dashed var(--border-subtle)',borderRadius:'var(--radius-md)',background:'transparent',cursor:'pointer',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',fontWeight:600,marginBottom:'8px'}}>
                <Icon name="plus" size={14}/>NEW MESSAGE
              </button>
              {dmThreads.map(t => {
                const otherId = t.channel_id.replace('dm_','').split('_').find(id=>id!==profile.employee_id)
                const other = employees.find(e=>e.id===otherId)
                if (!other) return null
                return (
                  <button key={t.channel_id} onClick={()=>setActiveDM(otherId)}
                    style={{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 12px',border:'none',borderRadius:'var(--radius-md)',background:activeDM===otherId?'var(--accent-bg)':'transparent',cursor:'pointer',textAlign:'left',marginBottom:'2px'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                      {other.first_name[0]}{other.last_name[0]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:activeDM===otherId?'var(--accent)':'var(--text-primary)'}}>{other.first_name} {other.last_name}</div>
                      <div style={{fontSize:'11px',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.content?.slice(0,30)}</div>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
        {isAdmin&&<div style={{padding:'12px',borderTop:'1px solid var(--border)',flexShrink:0}}><div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',display:'flex',alignItems:'center',gap:'6px'}}><Icon name="eye" size={12} color="var(--text-muted)"/>Audit mode active</div></div>}
      </div>

      {/* Chat area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'12px',flexShrink:0,background:'var(--bg-surface)'}}>
          {activeTab==='channels' ? <>
            <div style={{width:'36px',height:'36px',borderRadius:'8px',background:'var(--accent-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name={activeChInfo?.icon||'message-circle'} size={17} color="var(--accent)"/>
            </div>
            <div>
              <div style={{fontFamily:'var(--font-condensed)',fontSize:'15px',fontWeight:700,color:'var(--text-primary)'}}>{activeChInfo?.name}</div>
              <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{activeChInfo?.desc}</div>
            </div>
          </> : activeDMEmp ? <>
            <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'var(--accent)'}}>
              {activeDMEmp.first_name[0]}{activeDMEmp.last_name[0]}
            </div>
            <div>
              <div style={{fontFamily:'var(--font-condensed)',fontSize:'15px',fontWeight:700,color:'var(--text-primary)'}}>{activeDMEmp.first_name} {activeDMEmp.last_name}</div>
              <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{activeDMEmp.position_title}</div>
            </div>
          </> : <div style={{fontSize:'13px',color:'var(--text-muted)'}}>Select a conversation</div>}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'2px'}}>
          {messages.length===0 ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px',color:'var(--text-muted)'}}>
              <Icon name="message-circle" size={40} color="var(--border-subtle)"/>
              <div style={{fontSize:'14px'}}>No messages yet</div>
            </div>
          ) : groupedMessages.map((item,i) => {
            if (item.type==='date') return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'12px',margin:'16px 0 8px'}}>
                <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
                <div style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',whiteSpace:'nowrap'}}>{item.label}</div>
                <div style={{flex:1,height:'1px',background:'var(--border)'}}/>
              </div>
            )
            const m = item.data
            const isMe = m.sender_id === profile.employee_id
            const prev = i>0&&groupedMessages[i-1]?.type==='message'?groupedMessages[i-1].data:null
            const showHeader = !prev||prev.sender_id!==m.sender_id||(new Date(m.created_at)-new Date(prev.created_at))>300000
            return (
              <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',marginTop:showHeader?'12px':'2px'}}>
                {showHeader&&<div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px',flexDirection:isMe?'row-reverse':'row'}}>
                  <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                    {m.sender_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',flexDirection:isMe?'row-reverse':'row'}}>
                    <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{m.sender_name}</span>
                    <span style={{fontSize:'10px',fontWeight:700,color:roleColor(m.sender_role),background:'var(--bg-card)',padding:'1px 5px',borderRadius:'4px'}}>{roleLabel(m.sender_role)}</span>
                    <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{fmtTime(m.created_at)}</span>
                  </div>
                </div>}
                <div style={{maxWidth:'70%',padding:'8px 12px',borderRadius:isMe?'16px 4px 16px 16px':'4px 16px 16px 16px',background:isMe?'var(--accent)':'var(--bg-card)',border:isMe?'none':'1px solid var(--border-subtle)',color:isMe?'var(--text-inverse)':'var(--text-primary)',fontSize:'14px',lineHeight:1.5,wordBreak:'break-word'}}>
                  {m.content}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef}/>
        </div>

        <div style={{padding:'12px 20px',borderTop:'1px solid var(--border)',flexShrink:0,background:'var(--bg-surface)'}}>
          {!canPost ? (
            <div style={{padding:'12px 16px',background:'var(--bg-card)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-subtle)',fontSize:'13px',color:'var(--text-muted)',textAlign:'center'}}>
              {activeTab==='dms'&&!activeDM?'Select a conversation':'Only supervisors can post here'}
            </div>
          ) : (
            <div style={{display:'flex',gap:'10px',alignItems:'flex-end'}}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={activeTab==='channels'?`Message #${activeChInfo?.name?.toLowerCase()}...`:`Message ${activeDMEmp?.first_name||''}...`}
                rows={1} style={{flex:1,padding:'10px 14px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',color:'var(--text-primary)',fontSize:'14px',resize:'none',outline:'none',lineHeight:1.5,maxHeight:'120px',overflowY:'auto',fontFamily:'inherit'}}
                onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}
                onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
              <button onClick={sendMessage} disabled={!input.trim()||sending}
                style={{width:'44px',height:'44px',borderRadius:'50%',background:input.trim()?'var(--accent)':'var(--bg-card)',border:'1px solid var(--border-subtle)',cursor:input.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 150ms ease'}}>
                <Icon name="send" size={17} color={input.trim()?'var(--text-inverse)':'var(--text-muted)'}/>
              </button>
            </div>
          )}
          <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'6px'}}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {showDMPicker&&<>
        <div onClick={()=>{setShowDMPicker(false);setDmSearch('')}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,backdropFilter:'blur(2px)'}}/>
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(400px,95vw)',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',zIndex:201,display:'flex',flexDirection:'column',maxHeight:'80vh',boxShadow:'var(--shadow-modal)'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>NEW MESSAGE</div>
            <button onClick={()=>{setShowDMPicker(false);setDmSearch('')}} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
          </div>
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <input type="search" value={dmSearch} onChange={e=>setDmSearch(e.target.value)} placeholder="Search employees..." autoFocus
              style={{width:'100%',padding:'10px 14px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
            {filteredEmps.map(e=>(
              <button key={e.id} onClick={()=>{setActiveDM(e.id);setActiveTab('dms');setShowDMPicker(false);setDmSearch('')}}
                style={{display:'flex',alignItems:'center',gap:'12px',width:'100%',padding:'10px 12px',border:'none',borderRadius:'var(--radius-md)',background:'transparent',cursor:'pointer',textAlign:'left',marginBottom:'2px'}}>
                <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{e.first_name} {e.last_name}</div>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{e.position_title}</div>
                </div>
                <span style={{marginLeft:'auto',fontSize:'10px',fontWeight:700,color:roleColor(e.role),background:'var(--bg-card)',padding:'2px 6px',borderRadius:'4px'}}>{roleLabel(e.role)}</span>
              </button>
            ))}
          </div>
        </div>
      </>}
    </div>
  )
}