import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'

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

  // ── Personal channels / chat state ─────────────────────────────────────────
  const [activeTab, setActiveTab]             = useState('channels')
  const [activeChannel, setActiveChannel]     = useState(null)  // personal Channels tab ONLY — never touched by Groups tab
  const [activeDM, setActiveDM]               = useState(null)
  const [channels, setChannels]               = useState([])
  const [messages, setMessages]               = useState([])
  const [dmThreads, setDmThreads]             = useState([])
  const [employees, setEmployees]             = useState([])
  const [input, setInput]                     = useState('')
  const [sending, setSending]                 = useState(false)
  const [showDMPicker, setShowDMPicker]       = useState(false)
  const [dmSearch, setDmSearch]               = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName]             = useState('')
  const [creatingGroup, setCreatingGroup]     = useState(false)
  const [scheduleMode, setScheduleMode]       = useState(false)
  const [scheduleAt, setScheduleAt]           = useState('')

  // ── Groups management tab state — completely isolated from activeChannel ───
  const [allChannels, setAllChannels]               = useState([])
  const [groupMemberCounts, setGroupMemberCounts]   = useState({})
  const [managingChannelId, setManagingChannelId]   = useState(null)
  const [groupMembers, setGroupMembers]             = useState([])
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)
  const [showGroupAddPicker, setShowGroupAddPicker] = useState(false)
  const [groupAddSearch, setGroupAddSearch]         = useState('')
  const [renameValue, setRenameValue]               = useState('')
  const [renaming, setRenaming]                     = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const subRef         = useRef(null)

  const isAdmin      = atLeast(profile?.role, 'lieutenant')
  const canBroadcast = atLeast(profile?.role, 'sergeant')

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadChannels() },          [profile?.employee_id, profile?.company_id])
  useEffect(() => { loadEmployees() },         [profile])
  useEffect(() => { loadMessages(); subscribeToMessages(); return () => subRef.current?.unsubscribe() }, [profile, activeChannel, activeDM, activeTab])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])
  useEffect(() => { if (activeTab === 'dms')    loadDMThreads() },   [activeTab])
  useEffect(() => { if (activeTab === 'groups') loadAllChannels() }, [activeTab, profile?.company_id])
  useEffect(() => { if (managingChannelId) loadGroupMembers() },     [managingChannelId])

  // ── Personal channels tab ──────────────────────────────────────────────────
  async function loadChannels() {
    if (!profile?.employee_id || !profile?.company_id) return
    const { data } = await supabase
      .from('channel_member')
      .select('channel_id, channel:channel_id(id, name, is_general, created_by)')
      .eq('employee_id', profile.employee_id)
    const list = (data || [])
      .map(row => row.channel)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.is_general && !b.is_general) return -1
        if (!a.is_general && b.is_general) return 1
        return a.name.localeCompare(b.name)
      })
    setChannels(list)
    setActiveChannel(prev => {
      if (prev && list.find(c => c.id === prev)) return prev
      const general = list.find(c => c.is_general)
      return (general || list[0])?.id || null
    })
  }

  // ── Groups management tab ──────────────────────────────────────────────────
  async function loadAllChannels() {
    if (!profile?.company_id) return
    const { data: chData } = await supabase
      .from('channel')
      .select('id, name, is_general, created_by, created_at')
      .eq('company_id', profile.company_id)
      .order('is_general', { ascending: false })
      .order('name')
    const list = chData || []
    setAllChannels(list)
    if (list.length > 0) {
      const { data: memberRows } = await supabase
        .from('channel_member')
        .select('channel_id')
        .in('channel_id', list.map(c => c.id))
      const countMap = {}
      for (const row of (memberRows || [])) {
        countMap[row.channel_id] = (countMap[row.channel_id] || 0) + 1
      }
      setGroupMemberCounts(countMap)
    }
  }

  async function loadGroupMembers() {
    if (!managingChannelId) return
    setGroupMembersLoading(true)
    const { data } = await supabase
      .from('channel_member')
      .select('id, employee_id, employee:employee_id(id, first_name, last_name, role, position_title)')
      .eq('channel_id', managingChannelId)
    setGroupMembers(
      (data || [])
        .filter(row => row.employee)
        .sort((a, b) => a.employee.last_name.localeCompare(b.employee.last_name))
    )
    setGroupMembersLoading(false)
  }

  function selectManageChannel(ch) {
    setManagingChannelId(ch.id)
    setRenameValue(ch.name)
    // activeChannel is intentionally NOT touched here
  }

  async function renameChannel() {
    if (!renameValue.trim() || renaming || !managingChannelId) return
    setRenaming(true)
    const { error } = await supabase
      .from('channel')
      .update({ name: renameValue.trim() })
      .eq('id', managingChannelId)
    if (error) {
      alert(`Rename failed: ${error.message}`)
    } else {
      await loadAllChannels()
    }
    setRenaming(false)
  }

  async function removeMember(memberId) {
    const { error } = await supabase
      .from('channel_member')
      .delete()
      .eq('id', memberId)
    if (error) {
      alert(`Remove failed: ${error.message}`)
    } else {
      await Promise.all([loadGroupMembers(), loadAllChannels()])
    }
  }

  async function addGroupMember(empId) {
    const { error } = await supabase
      .from('channel_member')
      .insert({ channel_id: managingChannelId, employee_id: empId, added_by: profile.employee_id })
    if (error) {
      alert(`Add member failed: ${error.message}`)
    } else {
      setShowGroupAddPicker(false)
      setGroupAddSearch('')
      await Promise.all([loadGroupMembers(), loadAllChannels()])
    }
  }

  async function deleteChannel() {
    const ch = allChannels.find(c => c.id === managingChannelId)
    if (!ch || ch.is_general) return
    if (!confirm(`Delete group "${ch.name}"? All members will be removed. This cannot be undone.`)) return
    const { error } = await supabase.from('channel').delete().eq('id', managingChannelId)
    if (error) {
      alert(`Delete failed: ${error.message}`)
    } else {
      setManagingChannelId(null)
      setGroupMembers([])
      setRenameValue('')
      await loadAllChannels()
    }
  }

  // ── Shared message functions ───────────────────────────────────────────────
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
    const ch = channels.find(c => c.id === activeChannel)
    if (scheduleMode && scheduleAt) {
      await supabase.from('scheduled_message').insert({ company_id:profile.company_id, channel_id:activeChannel, channel_name:ch?.name||activeChannel, sender_id:profile.employee_id||null, sender_name:`${profile.first_name} ${profile.last_name}`, sender_role:profile.role, content:input.trim(), send_at:new Date(scheduleAt).toISOString() })
      setInput(''); setSending(false); setScheduleMode(false); setScheduleAt(''); inputRef.current?.focus(); return
    }
    const channelId = activeTab === 'channels' ? activeChannel : getDMId(profile.employee_id||'', activeDM)
    setSending(true)
    await supabase.from('message').insert({ company_id:profile.company_id, channel_id:channelId, channel_name:activeTab==='channels'?ch?.name:'DM', sender_id:profile.employee_id||null, sender_name:`${profile.first_name} ${profile.last_name}`, sender_role:profile.role, content:input.trim() })
    setInput(''); setSending(false); inputRef.current?.focus()
  }

  async function createGroup() {
    if (!groupName.trim() || creatingGroup) return
    setCreatingGroup(true)
    try {
      const { data: ch, error: chErr } = await supabase
        .from('channel')
        .insert({ company_id: profile.company_id, name: groupName.trim(), is_general: false, created_by: profile.employee_id })
        .select('id')
        .single()
      if (chErr) throw chErr

      // Self-join with retry — RLS "channel creator can self-join own channel" policy covers this
      let joined = false
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500))
        const { error: memErr } = await supabase.from('channel_member').insert({ channel_id: ch.id, employee_id: profile.employee_id })
        if (!memErr) { joined = true; break }
      }
      if (!joined) {
        alert(`Group "${groupName.trim()}" was created, but you were not added as a member. Ask a lieutenant or admin to add you manually.`)
        setShowCreateGroup(false)
        setGroupName('')
        await loadChannels()
        return
      }

      setShowCreateGroup(false)
      setGroupName('')
      await loadChannels()
      setActiveChannel(ch.id)
    } catch {
      alert('Failed to create group. Please try again.')
    } finally {
      setCreatingGroup(false)
    }
  }

  function handleKeyDown(e) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage() } }

  // ── Derived values ─────────────────────────────────────────────────────────
  const canPost = useMemo(() => {
    if (activeTab === 'dms') return !!activeDM
    return !!activeChannel
  }, [activeTab, activeChannel, activeDM])

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

  const managingChannel = allChannels.find(c => c.id === managingChannelId) || null
  const groupMemberIds  = useMemo(() => new Set(groupMembers.map(m => m.employee_id)), [groupMembers])
  const groupAddEmps    = employees.filter(e =>
    !groupMemberIds.has(e.id) &&
    (!groupAddSearch || `${e.first_name} ${e.last_name}`.toLowerCase().includes(groupAddSearch.toLowerCase()))
  )

  const activeChInfo = channels.find(c => c.id === activeChannel)
  const activeDMEmp  = employees.find(e => e.id === activeDM)

  // ── Styles shared across tabs ──────────────────────────────────────────────
  const pickerOverlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, backdropFilter:'blur(2px)' }
  const pickerCard    = { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(400px,95vw)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', zIndex:201, display:'flex', flexDirection:'column', maxHeight:'80vh', boxShadow:'var(--shadow-modal)' }

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>

      {/* ── Sidebar ── */}
      <div style={{width:'260px',flexShrink:0,borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',background:'var(--bg-surface)'}}>
        <div style={{padding:'16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'18px',letterSpacing:'2px',color:'var(--text-primary)',lineHeight:1,marginBottom:'12px'}}>MESSAGING</h2>
          <div style={{display:'flex',gap:'2px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',padding:'3px'}}>
            {[['channels','Channels'],['dms','Direct'],...(isAdmin?[['groups','Groups'],['dmmonitor','DM Monitor']]:[])]
              .map(([v,l])=>(
              <button key={v} onClick={()=>setActiveTab(v)} style={{flex:1,height:'30px',border:'none',borderRadius:'4px',background:activeTab===v?'var(--accent-bg)':'transparent',color:activeTab===v?'var(--accent)':'var(--text-muted)',cursor:'pointer',fontSize:'10px',fontFamily:'var(--font-condensed)',fontWeight:600}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
          {activeTab==='channels' ? (
            <>
              {canBroadcast && (
                <button onClick={()=>setShowCreateGroup(true)} style={{display:'flex',alignItems:'center',gap:'8px',width:'100%',padding:'10px 12px',border:'1px dashed var(--border-subtle)',borderRadius:'var(--radius-md)',background:'transparent',cursor:'pointer',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',fontWeight:600,marginBottom:'8px'}}>
                  <Icon name="plus" size={14}/>NEW GROUP
                </button>
              )}
              {channels.map(ch=>(
                <button key={ch.id} onClick={()=>setActiveChannel(ch.id)}
                  style={{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 12px',border:'none',borderRadius:'var(--radius-md)',background:activeChannel===ch.id?'var(--accent-bg)':'transparent',cursor:'pointer',textAlign:'left',marginBottom:'2px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'8px',background:activeChannel===ch.id?'var(--accent)':'var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Icon name={ch.is_general?'message-circle':'message-square'} size={15} color={activeChannel===ch.id?'var(--text-inverse)':'var(--text-muted)'}/>
                  </div>
                  <div style={{fontSize:'13px',fontWeight:600,color:activeChannel===ch.id?'var(--accent)':'var(--text-primary)'}}>{ch.name}</div>
                </button>
              ))}
            </>
          ) : activeTab==='groups' ? (
            // Groups sidebar: ALL company channels, not filtered by membership
            <>
              {allChannels.map(ch=>(
                <button key={ch.id} onClick={()=>selectManageChannel(ch)}
                  style={{display:'flex',alignItems:'center',gap:'10px',width:'100%',padding:'10px 12px',border:'none',borderRadius:'var(--radius-md)',background:managingChannelId===ch.id?'var(--accent-bg)':'transparent',cursor:'pointer',textAlign:'left',marginBottom:'2px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'8px',background:managingChannelId===ch.id?'var(--accent)':'var(--bg-card)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Icon name={ch.is_general?'lock':'message-square'} size={14} color={managingChannelId===ch.id?'var(--text-inverse)':'var(--text-muted)'}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'13px',fontWeight:600,color:managingChannelId===ch.id?'var(--accent)':'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.name}</div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{groupMemberCounts[ch.id]||0} members{ch.is_general?' · Protected':''}</div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            // DMs tab (also shown when activeTab is 'dmmonitor')
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

      {/* ── DM Monitor ── */}
      {activeTab==='dmmonitor' && (
        <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'var(--color-warning-bg)',flexShrink:0}}>
            <div style={{fontSize:'12px',color:'var(--color-warning)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'}}><Icon name="eye" size={14}/>DM MONITORING — For compliance and safety purposes only. Read-only.</div>
          </div>
          <DMMonitorPanel companyId={profile.company_id} employees={employees} />
        </div>
      )}

      {/* ── Groups management panel ── */}
      {activeTab==='groups' && (
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0}}>
            <div style={{fontSize:'12px',color:'var(--text-muted)',fontFamily:'var(--font-condensed)',letterSpacing:'1px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'}}>
              <Icon name="settings" size={13} color="var(--text-muted)"/>GROUP MANAGEMENT — Lieutenant+ only
            </div>
          </div>

          {!managingChannelId ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px',color:'var(--text-muted)'}}>
              <Icon name="message-square" size={40} color="var(--border-subtle)"/>
              <div style={{fontSize:'14px'}}>Select a group to manage</div>
            </div>
          ) : (
            <div style={{flex:1,overflowY:'auto',padding:'24px',maxWidth:'640px'}}>

              {/* ── Name + rename ── */}
              <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'20px',marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
                  <Icon name={managingChannel?.is_general?'lock':'message-square'} size={16} color="var(--accent)"/>
                  <span style={{fontFamily:'var(--font-condensed)',fontSize:'15px',fontWeight:700,color:'var(--text-primary)',letterSpacing:'0.5px'}}>{managingChannel?.name}</span>
                  {managingChannel?.is_general && (
                    <span style={{fontSize:'10px',fontWeight:700,fontFamily:'var(--font-condensed)',letterSpacing:'1px',color:'var(--text-muted)',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',padding:'2px 7px',borderRadius:'4px'}}>PROTECTED</span>
                  )}
                </div>
                <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>Rename</div>
                <div style={{display:'flex',gap:'8px'}}>
                  <input
                    value={renameValue}
                    onChange={e=>setRenameValue(e.target.value)}
                    onKeyDown={e=>{ if (e.key==='Enter') renameChannel() }}
                    placeholder="Channel name"
                    style={{flex:1,padding:'9px 12px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:'13px',color:'var(--text-primary)',outline:'none',fontFamily:'inherit',transition:'border-color 150ms'}}
                    onFocus={e=>e.target.style.borderColor='var(--border-focus)'}
                    onBlur={e=>e.target.style.borderColor='var(--border)'}
                  />
                  <button
                    onClick={renameChannel}
                    disabled={!renameValue.trim()||renaming||renameValue.trim()===managingChannel?.name}
                    style={{height:'38px',padding:'0 16px',background:'var(--accent)',color:'var(--text-inverse)',border:'none',borderRadius:'var(--radius-sm)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',opacity:renameValue.trim()&&!renaming&&renameValue.trim()!==managingChannel?.name?1:0.4,transition:'opacity 150ms',flexShrink:0}}>
                    {renaming?'SAVING...':'RENAME'}
                  </button>
                </div>
              </div>

              {/* ── Member list ── */}
              <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'20px',marginBottom:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                  <div style={{fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',color:'var(--text-muted)',textTransform:'uppercase'}}>
                    Members ({groupMembers.length})
                  </div>
                  <button
                    onClick={()=>setShowGroupAddPicker(true)}
                    style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',background:'var(--accent-bg)',color:'var(--accent)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,letterSpacing:'1px',cursor:'pointer'}}>
                    <Icon name="plus" size={12}/>ADD MEMBER
                  </button>
                </div>
                {groupMembersLoading ? (
                  <div style={{padding:'16px',textAlign:'center',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>
                ) : groupMembers.length === 0 ? (
                  <div style={{padding:'16px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>No members yet.</div>
                ) : groupMembers.map(m=>(
                  <div key={m.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid var(--border-subtle)'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--bg-surface)',border:'1px solid var(--border-subtle)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                      {m.employee.first_name[0]}{m.employee.last_name[0]}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)'}}>{m.employee.first_name} {m.employee.last_name}</div>
                      <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{m.employee.position_title||roleLabel(m.employee.role)}</div>
                    </div>
                    <span style={{fontSize:'10px',fontWeight:700,color:roleColor(m.employee.role),background:'var(--bg-surface)',padding:'2px 6px',borderRadius:'4px',flexShrink:0}}>{roleLabel(m.employee.role)}</span>
                    <button
                      onClick={()=>removeMember(m.id)}
                      disabled={!!managingChannel?.is_general}
                      title={managingChannel?.is_general?'Cannot remove members from the General channel':'Remove from channel'}
                      style={{padding:'5px 10px',background:'transparent',color:managingChannel?.is_general?'var(--text-muted)':'#e53e3e',border:`1px solid ${managingChannel?.is_general?'var(--border-subtle)':'#e53e3e'}`,borderRadius:'var(--radius-sm)',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,cursor:managingChannel?.is_general?'not-allowed':'pointer',opacity:managingChannel?.is_general?0.35:1,transition:'opacity 150ms',flexShrink:0}}>
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>

              {/* ── Delete group (hidden for General) ── */}
              {!managingChannel?.is_general && (
                <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>Delete Group</div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Removes all members. Cannot be undone.</div>
                  </div>
                  <button
                    onClick={deleteChannel}
                    style={{padding:'8px 16px',background:'transparent',color:'#e53e3e',border:'1px solid #e53e3e',borderRadius:'var(--radius-sm)',fontFamily:'var(--font-condensed)',fontSize:'12px',fontWeight:700,letterSpacing:'1px',cursor:'pointer',flexShrink:0}}>
                    DELETE GROUP
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add member picker — reuses showDMPicker overlay+card pattern exactly */}
          {showGroupAddPicker&&<>
            <div onClick={()=>{setShowGroupAddPicker(false);setGroupAddSearch('')}} style={pickerOverlay}/>
            <div style={pickerCard}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>ADD MEMBER</div>
                <button onClick={()=>{setShowGroupAddPicker(false);setGroupAddSearch('')}} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
              </div>
              <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <input type="search" value={groupAddSearch} onChange={e=>setGroupAddSearch(e.target.value)} placeholder="Search employees..." autoFocus
                  style={{width:'100%',padding:'10px 14px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                {groupAddEmps.length===0 ? (
                  <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:'12px'}}>
                    {groupAddSearch?'No employees match your search.':'All employees are already members.'}
                  </div>
                ) : groupAddEmps.map(e=>(
                  <button key={e.id} onClick={()=>addGroupMember(e.id)}
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
      )}

      {/* ── Chat area + modals (hidden in dmmonitor and groups modes) ── */}
      {activeTab!=='dmmonitor' && activeTab!=='groups' && <><div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'12px',flexShrink:0,background:'var(--bg-surface)'}}>
          {activeTab==='channels' ? <>
            <div style={{width:'36px',height:'36px',borderRadius:'8px',background:'var(--accent-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name={activeChInfo?.is_general?'message-circle':'message-square'} size={17} color="var(--accent)"/>
            </div>
            <div>
              <div style={{fontFamily:'var(--font-condensed)',fontSize:'15px',fontWeight:700,color:'var(--text-primary)'}}>{activeChInfo?.name}</div>
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
              {activeTab==='dms'?'Select a conversation':'Select a channel'}
            </div>
          ) : (
            <>
              {scheduleMode && (
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',padding:'8px 12px',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)'}}>
                  <Icon name="clock" size={14} color="var(--accent)"/>
                  <span style={{fontSize:'12px',color:'var(--accent)',fontFamily:'var(--font-condensed)',letterSpacing:'0.5px'}}>SCHEDULE FOR:</span>
                  <input type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)} style={{background:'var(--bg-input)',border:'1px solid var(--accent-border)',borderRadius:'var(--radius-sm)',padding:'4px 8px',fontSize:'12px',color:'var(--text-primary)',outline:'none',fontFamily:'var(--font-body)'}}/>
                  <button onClick={()=>{setScheduleMode(false);setScheduleAt('')}} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'2px',display:'flex'}}><Icon name="x" size={14}/></button>
                </div>
              )}
              <div style={{display:'flex',gap:'10px',alignItems:'flex-end'}}>
                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder={activeTab==='channels'?`Message #${activeChInfo?.name?.toLowerCase()}...`:`Message ${activeDMEmp?.first_name||''}...`}
                  rows={1} style={{flex:1,padding:'10px 14px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',color:'var(--text-primary)',fontSize:'14px',resize:'none',outline:'none',lineHeight:1.5,maxHeight:'120px',overflowY:'auto',fontFamily:'inherit'}}
                  onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'}}
                  onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}/>
                {canBroadcast && activeTab==='channels' && !scheduleMode && (
                  <button onClick={()=>setScheduleMode(true)} title="Schedule message" style={{width:'44px',height:'44px',borderRadius:'50%',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 150ms ease'}}>
                    <Icon name="clock" size={17} color="var(--text-muted)"/>
                  </button>
                )}
                <button onClick={sendMessage} disabled={!input.trim()||sending||(scheduleMode&&!scheduleAt)}
                  style={{width:'44px',height:'44px',borderRadius:'50%',background:input.trim()&&(!scheduleMode||scheduleAt)?'var(--accent)':'var(--bg-card)',border:'1px solid var(--border-subtle)',cursor:input.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 150ms ease'}}>
                  <Icon name={scheduleMode?'clock':'send'} size={17} color={input.trim()&&(!scheduleMode||scheduleAt)?'var(--text-inverse)':'var(--text-muted)'}/>
                </button>
              </div>
            </>
          )}
          <div style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'6px'}}>{scheduleMode?'Message will be scheduled · click the clock to send':'Enter to send · Shift+Enter for new line'}</div>
        </div>
      </div>

      {showDMPicker&&<>
        <div onClick={()=>{setShowDMPicker(false);setDmSearch('')}} style={pickerOverlay}/>
        <div style={pickerCard}>
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

      {showCreateGroup&&<>
        <div onClick={()=>{setShowCreateGroup(false);setGroupName('')}} style={pickerOverlay}/>
        <div style={{...pickerCard,maxHeight:'unset'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>NEW GROUP</div>
            <button onClick={()=>{setShowCreateGroup(false);setGroupName('')}} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'44px',minWidth:'44px'}}><Icon name="x" size={18}/></button>
          </div>
          <div style={{padding:'20px'}}>
            <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'6px'}}>Group Name</div>
            <input
              value={groupName}
              onChange={e=>setGroupName(e.target.value)}
              onKeyDown={e=>{ if (e.key==='Enter') createGroup() }}
              placeholder="e.g. Night Shift, Investigations..."
              autoFocus
              style={{width:'100%',padding:'10px 14px',background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
              onFocus={e=>e.target.style.borderColor='var(--border-focus)'}
              onBlur={e=>e.target.style.borderColor='var(--border-subtle)'}
            />
            <button
              onClick={createGroup}
              disabled={!groupName.trim()||creatingGroup}
              style={{marginTop:'16px',width:'100%',height:'44px',background:groupName.trim()&&!creatingGroup?'var(--accent)':'var(--bg-card)',color:groupName.trim()&&!creatingGroup?'var(--text-inverse)':'var(--text-muted)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',fontFamily:'var(--font-condensed)',fontSize:'13px',fontWeight:700,letterSpacing:'1px',cursor:groupName.trim()&&!creatingGroup?'pointer':'default',transition:'all 150ms ease'}}>
              {creatingGroup?'CREATING...':'CREATE GROUP'}
            </button>
          </div>
        </div>
      </>}
      </> }
    </div>
  )
}

function DMMonitorPanel({ companyId, employees }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [viewing, setViewing] = useState(null)
  const [msgs,    setMsgs]    = useState([])
  useEffect(() => { load() }, [companyId])
  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('message').select('channel_id,created_at,content,sender_name').eq('company_id',companyId).like('channel_id','dm_%').order('created_at',{ascending:false}).limit(200)
      const map = {}
      for (const m of (data||[])) { if (!map[m.channel_id]) map[m.channel_id]={id:m.channel_id,last:m.created_at,preview:m.content?.slice(0,50),count:0}; map[m.channel_id].count++ }
      setThreads(Object.values(map).sort((a,b)=>new Date(b.last)-new Date(a.last)))
    } finally {
      setLoading(false)
    }
  }, { setLoading })
  async function openThread(id) {
    setViewing(id)
    const { data } = await supabase.from('message').select('*').eq('company_id',companyId).eq('channel_id',id).order('created_at')
    setMsgs(data||[])
  }
  const filteredThreads = threads.filter(t => !search || t.id.includes(search.toLowerCase()))
  if (loading) return <div style={{padding:'20px',color:'var(--text-muted)',fontSize:'12px',fontFamily:'var(--font-condensed)',letterSpacing:'1px'}}>LOADING...</div>
  return (
    <div style={{display:'flex',flex:1,overflow:'hidden'}}>
      <div style={{width:'260px',borderRight:'1px solid var(--border)',overflowY:'auto'}}>
        <div style={{padding:'10px 14px'}}><input style={{width:'100%',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'7px 10px',fontSize:'12px',color:'var(--text-primary)',outline:'none',fontFamily:'var(--font-body)'}} placeholder="Search threads..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
        {filteredThreads.map(t=>(
          <button key={t.id} onClick={()=>openThread(t.id)} style={{display:'block',width:'100%',padding:'10px 14px',borderBottom:'1px solid var(--border)',background:viewing===t.id?'var(--accent-bg)':'transparent',border:'none',cursor:'pointer',textAlign:'left'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-primary)',marginBottom:'2px'}}>Thread ({t.count} msgs)</div>
            <div style={{fontSize:'11px',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.preview}</div>
            <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'2px'}}>{new Date(t.last).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
          </button>
        ))}
        {filteredThreads.length===0 && <div style={{padding:'20px',textAlign:'center',color:'var(--text-muted)',fontSize:'12px'}}>No DM threads found.</div>}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {!viewing ? (
          <div style={{padding:'40px',textAlign:'center',color:'var(--text-muted)',fontSize:'13px'}}>Select a thread to view.</div>
        ) : (
          <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
            {msgs.map(m=>(
              <div key={m.id} style={{marginBottom:'12px'}}>
                <div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'2px'}}>{m.sender_name} · {new Date(m.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
                <div style={{background:'var(--bg-surface)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:'13px',color:'var(--text-primary)'}}>{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
