import { useState, useEffect, useMemo, Fragment } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const STEP_LABELS = ['Basic Info', 'AI Summary', 'Add. Notes', 'Review & Send']

const STATUS_STYLES = {
  draft: { bg:'rgba(130,130,130,0.15)', color:'#8899aa', label:'Draft' },
  sent:  { bg:'rgba(58,170,106,0.15)',  color:'#3aaa6a', label:'Sent'  },
}

const EMPTY_FORM = {
  site_id: '',
  shift_label: '',
  shift_date: new Date().toISOString().slice(0, 10),
  officers_on_duty: '',
  incident_summary: '',
  patrol_summary: '',
  maintenance_concerns: '',
  resident_concerns: '',
  other_notes: '',
}

const inp = {
  width:'100%', padding:'10px 12px',
  background:'var(--bg-input)', border:'1px solid var(--border-subtle)',
  borderRadius:'var(--radius-md)', color:'var(--text-primary)',
  fontSize:'13px', outline:'none', boxSizing:'border-box', height:'44px',
  fontFamily:'var(--font-body)',
}
const lbl = {
  fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase',
  letterSpacing:'1px', fontFamily:'var(--font-condensed)', display:'block', marginBottom:'6px',
}
const ta = { ...inp, height:'auto', minHeight:'96px', resize:'vertical', lineHeight:1.6 }
const fld = { marginBottom:'16px' }

export default function DAR() {
  const { profile } = useAuth()
  const toast = useToast()

  const [view, setView]       = useState('list')
  const [dars, setDars]       = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [sites, setSites]     = useState([])
  const [darDue, setDarDue]   = useState([])
  const [filterSite, setFilterSite]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch]   = useState('')

  const canCreate = atLeast(profile?.role, 'sergeant') || profile?.role === 'client'

  useEffect(() => {
    if (profile?.company_id) {
      load()
      loadSites()
      checkDarDue()
    }
  }, [profile])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('dar')
        .select('id, company_id, site_id, shift_label, shift_date, status, created_by, created_at, sent_at, site:site_id(name), creator:created_by(first_name,last_name)')
        .eq('company_id', profile.company_id)
        .order('shift_date', { ascending: false })
      setDars(data || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function loadSites() {
    const { data } = await supabase
      .from('site')
      .select('id, name, requires_dar')
      .eq('company_id', profile.company_id)
      .order('name')
    setSites(data || [])
  }

  async function checkDarDue() {
    if (!atLeast(profile?.role, 'sergeant')) return
    const today = new Date().toISOString().slice(0, 10)
    const { data: darSites } = await supabase
      .from('site')
      .select('id, name')
      .eq('company_id', profile.company_id)
      .eq('requires_dar', true)
    if (!darSites?.length) return
    const { data: todayDars } = await supabase
      .from('dar')
      .select('site_id')
      .eq('company_id', profile.company_id)
      .eq('shift_date', today)
    const covered = new Set((todayDars || []).map(d => d.site_id))
    setDarDue((darSites || []).filter(s => !covered.has(s.id)))
  }

  const filtered = useMemo(() => dars.filter(d => {
    if (filterSite !== 'all' && d.site_id !== filterSite) return false
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const matchSite  = d.site?.name?.toLowerCase().includes(q)
      const matchLabel = d.shift_label?.toLowerCase().includes(q)
      const matchDate  = d.shift_date?.includes(q)
      if (!matchSite && !matchLabel && !matchDate) return false
    }
    return true
  }), [dars, filterSite, filterStatus, search])

  const stats = useMemo(() => {
    const now = new Date()
    return {
      total:     dars.length,
      thisMonth: dars.filter(d => {
        const dt = new Date(d.shift_date + 'T00:00:00')
        return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
      }).length,
      draft: dars.filter(d => d.status === 'draft').length,
      sent:  dars.filter(d => d.status === 'sent').length,
    }
  }, [dars])

  if (view === 'new') return (
    <DarForm
      profile={profile}
      sites={sites}
      toast={toast}
      onBack={() => { setView('list'); load(); checkDarDue() }}
    />
  )

  return (
    <div style={{ padding:'24px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {darDue.length > 0 && (
        <div style={{ background:'var(--color-warning-bg)', border:'1px solid rgba(232,148,58,0.4)', borderRadius:'var(--radius-md)', padding:'12px 16px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <Icon name="alert-circle" size={16} color="var(--color-warning)" />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'var(--color-warning)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>DAR REQUIRED</div>
            <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'2px' }}>
              {darDue.map(s => s.name).join(', ')} — No Daily Activity Report submitted for today.
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setView('new')} style={{ background:'var(--color-warning)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'36px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 }}>
              CREATE NOW
            </button>
          )}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>DAILY ACTIVITY REPORTS</h2>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{dars.length} total reports</p>
        </div>
        {canCreate && (
          <button onClick={() => setView('new')} style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}>
            <Icon name="plus" size={16} />NEW DAR
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'10px', marginBottom:'20px' }}>
        {[
          { label:'Total',      value:stats.total,     color:'var(--text-primary)' },
          { label:'This Month', value:stats.thisMonth, color:'var(--color-info)' },
          { label:'Drafts',     value:stats.draft,     color:'#8899aa' },
          { label:'Sent',       value:stats.sent,      color:'var(--color-success)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' }}>{s.label}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
          <Icon name="search" size={15} color="var(--text-muted)" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
          <input type="search" placeholder="Search site, shift, or date..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft:'36px' }}
            onFocus={e => e.target.style.borderColor='var(--border-focus)'}
            onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
          />
        </div>
        <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{ ...inp, width:'auto', minWidth:'150px', cursor:'pointer' }}>
          <option value="all">All Sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width:'auto', minWidth:'130px', cursor:'pointer' }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
        </select>
      </div>

      {loading ? (
        <div>{[...Array(5)].map((_,i) => <div key={i} className="skeleton" style={{ height:'60px', borderRadius:'8px', marginBottom:'8px' }} />)}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
          <Icon name="file-text" size={40} color="var(--border-subtle)" />
          <div style={{ marginTop:'16px', fontSize:'15px' }}>No reports found</div>
          {canCreate && dars.length === 0 && <div style={{ fontSize:'13px', marginTop:'6px' }}>Create your first report with the "+ NEW DAR" button above.</div>}
        </div>
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto 20px', gap:'12px', padding:'8px 16px', borderBottom:'1px solid var(--border)', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)' }}>
            <span>Site / Shift</span><span>Date</span><span>Created By</span><span>Status</span><span></span>
          </div>
          {filtered.map((d, i) => {
            const st = STATUS_STYLES[d.status] || STATUS_STYLES.draft
            const creatorName = d.creator ? `${d.creator.first_name || ''} ${d.creator.last_name || ''}`.trim() : '—'
            const fmtDate = new Date(d.shift_date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
            return (
              <div key={d.id} onClick={() => setSelected(d)}
                style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto 20px', alignItems:'center', gap:'12px', padding:'13px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor:'pointer', transition:'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background=''}
              >
                <div>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>{d.site?.name || 'Unknown Site'}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{d.shift_label || '—'}</div>
                </div>
                <div style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{fmtDate}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{creatorName}</div>
                <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', background:st.bg, color:st.color, whiteSpace:'nowrap' }}>
                  {st.label.toUpperCase()}
                </span>
                <Icon name="chevron-right" size={14} color="var(--text-muted)" />
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <DarDetail
          dar={selected}
          profile={profile}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ── DAR Form (multi-step wizard) ─────────────────────────────────────────────

function DarForm({ profile, sites, toast, onBack }) {
  const [step, setStep]         = useState(0)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [employees, setEmployees] = useState([])
  const [clientUsers, setClientUsers] = useState([])
  const [inAppRecipients, setInAppRecipients] = useState([])
  const [externalEmails, setExternalEmails]   = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [sending, setSending]   = useState(false)
  const [darId, setDarId]       = useState(null)
  const [formError, setFormError] = useState(null)

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => {
    if (!form.site_id || !profile?.company_id) return
    const today = form.shift_date || new Date().toISOString().slice(0, 10)
    supabase
      .from('shift')
      .select('employee_id, employee:employee_id(first_name,last_name)')
      .eq('site_id', form.site_id)
      .eq('date', today)
      .then(({ data: shifts }) => {
        const names = (shifts || [])
          .filter(s => s.employee)
          .map(s => `${s.employee.first_name || ''} ${s.employee.last_name || ''}`.trim())
          .filter(Boolean)
        setEmployees(names)
        if (names.length > 0 && !form.officers_on_duty) {
          setF('officers_on_duty', names.join(', '))
        }
      })
    supabase
      .from('user_profile')
      .select('id, first_name, last_name, email')
      .eq('company_id', profile.company_id)
      .eq('role', 'client')
      .then(({ data }) => setClientUsers(data || []))
  }, [form.site_id, form.shift_date])

  async function generateAI() {
    if (!form.site_id || !form.shift_date) { toast('Select a site and date first', 'error'); return }
    setAiLoading(true)
    setFormError(null)
    try {
      const siteInfo  = sites.find(s => s.id === form.site_id)
      const today     = form.shift_date

      const [{ data: incidents }, { data: patrols }] = await Promise.all([
        supabase.from('incident_report')
          .select('incident_type, narrative')
          .eq('company_id', profile.company_id)
          .eq('site_id', form.site_id)
          .gte('created_at', today + 'T00:00:00')
          .lte('created_at', today + 'T23:59:59'),
        supabase.from('patrol_log')
          .select('status, started_at, ended_at')
          .eq('company_id', profile.company_id)
          .eq('site_id', form.site_id)
          .gte('started_at', today + 'T00:00:00')
          .lte('started_at', today + 'T23:59:59'),
      ])

      const incidentText = incidents?.length
        ? incidents.map(i => `- ${i.incident_type}: ${i.narrative || 'No additional details'}`).join('\n')
        : 'No incidents recorded.'

      const patrolText = patrols?.length
        ? patrols.map(p => {
            const start = p.started_at ? new Date(p.started_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : ''
            const end   = p.ended_at   ? new Date(p.ended_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : 'ongoing'
            return `- Patrol ${p.status || 'completed'}: ${start} to ${end}`
          }).join('\n')
        : 'No patrol activity recorded.'

      const prompt = `Generate a professional security Daily Activity Report. Be concise and factual.

Site: ${siteInfo?.name || 'Unknown'}
Date: ${form.shift_date}
Shift: ${form.shift_label || 'General Shift'}
Officers on Duty: ${form.officers_on_duty || 'Not specified'}

Incidents today:
${incidentText}

Patrol activity:
${patrolText}

Respond ONLY with valid JSON in this format:
{"incident_summary":"One to three sentence professional summary of incidents. If none, write: No incidents were reported during this shift period.","patrol_summary":"One to three sentence professional summary of patrol activity. If none, write: No patrol activity was logged during this shift period."}`

      const { data, error: fnErr } = await supabase.functions.invoke('ai-assistant', {
        body: { messages: [{ role:'user', content:prompt }] }
      })
      if (fnErr) throw fnErr

      const rawText = data?.content?.[0]?.text || ''
      let parsed = { incident_summary:'', patrol_summary:'' }
      try {
        const match = rawText.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
        else throw new Error('no json')
      } catch {
        parsed.incident_summary = rawText.trim()
      }

      if (parsed.incident_summary) setF('incident_summary', parsed.incident_summary)
      if (parsed.patrol_summary)   setF('patrol_summary',   parsed.patrol_summary)
      toast('AI summary generated — review and edit as needed')
    } catch {
      setFormError('AI generation failed. You can write the summaries manually.')
    }
    setAiLoading(false)
  }

  async function upsertDar(status) {
    const payload = {
      company_id:           profile.company_id,
      site_id:              form.site_id,
      shift_label:          form.shift_label || null,
      shift_date:           form.shift_date,
      officers_on_duty:     form.officers_on_duty || null,
      incident_summary:     form.incident_summary || null,
      patrol_summary:       form.patrol_summary   || null,
      maintenance_concerns: form.maintenance_concerns || null,
      resident_concerns:    form.resident_concerns   || null,
      other_notes:          form.other_notes         || null,
      status,
      created_by: profile.id,
    }
    let id = darId
    if (id) {
      const { error } = await supabase.from('dar').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from('dar').insert(payload).select('id').single()
      if (error) throw error
      id = data.id
      setDarId(id)
    }
    return id
  }

  async function saveDraft() {
    if (!form.site_id) { toast('Select a site', 'error'); return }
    setSaving(true)
    setFormError(null)
    try {
      await upsertDar('draft')
      toast('Draft saved')
      onBack()
    } catch (e) {
      setFormError(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  async function sendDAR() {
    if (!form.site_id) { toast('Select a site', 'error'); return }
    setSending(true)
    setFormError(null)
    try {
      const id = await upsertDar('draft')

      const { error: pdfErr } = await supabase.functions.invoke('generate-dar-pdf', {
        body: { dar_id: id }
      })
      if (pdfErr) throw new Error(pdfErr.message || 'PDF generation failed')

      const emails = externalEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.includes('@'))

      const { error: sendErr } = await supabase.functions.invoke('send-dar', {
        body: {
          dar_id: id,
          in_app_recipients: inAppRecipients,
          external_emails: emails,
        }
      })
      if (sendErr) throw new Error(sendErr.message || 'Send failed')

      toast('Daily Activity Report sent successfully')
      onBack()
    } catch (e) {
      setFormError(e.message || 'Send failed — check email addresses and try again')
    }
    setSending(false)
  }

  const selectedSite = sites.find(s => s.id === form.site_id)

  function NavBtns({ onBack: onPrev, onNext, nextLabel }) {
    return (
      <div style={{ display:'flex', gap:'10px', marginTop:'8px', flexWrap:'wrap' }}>
        {onPrev && (
          <button onClick={onPrev} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', color:'var(--text-secondary)', cursor:'pointer' }}>
            BACK
          </button>
        )}
        {onNext && (
          <button onClick={onNext} style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 24px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}>
            {nextLabel || 'NEXT'}<Icon name="arrow-right" size={15} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding:'24px', maxWidth:'680px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:0, fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'0.5px' }}>
          <Icon name="arrow-left" size={15} />BACK
        </button>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, margin:0 }}>NEW DAILY ACTIVITY REPORT</h2>
      </div>

      {/* Step indicator */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:'32px' }}>
        {STEP_LABELS.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div style={{ flex:1, height:'2px', background: step > i ? 'var(--accent)' : 'var(--border)', borderRadius:'1px', minWidth:'12px' }} />
            )}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', flexShrink:0 }}>
              <div style={{
                width:'28px', height:'28px', borderRadius:'50%',
                background: step > i ? 'var(--accent)' : step === i ? 'var(--text-primary)' : 'var(--bg-card)',
                border: step <= i ? `1px solid ${step === i ? 'transparent' : 'var(--border)'}` : 'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700,
                color: step > i ? 'var(--text-inverse)' : step === i ? 'var(--bg-base)' : 'var(--text-muted)',
              }}>
                {step > i
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : i + 1
                }
              </div>
              <div style={{ fontSize:'8px', color: step === i ? 'var(--accent)' : 'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap', textTransform:'uppercase' }}>{label}</div>
            </div>
          </Fragment>
        ))}
      </div>

      {formError && (
        <div style={{ background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'12px', color:'var(--color-danger)', marginBottom:'16px' }}>
          {formError}
        </div>
      )}

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <>
          <div style={fld}>
            <label style={lbl}>Site *</label>
            <select value={form.site_id} onChange={e => setF('site_id', e.target.value)}
              style={{ ...inp, cursor:'pointer' }}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            >
              <option value="">Select site...</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={fld}>
            <label style={lbl}>Shift Label</label>
            <input style={inp} value={form.shift_label} onChange={e => setF('shift_label', e.target.value)}
              placeholder="e.g. Day Shift, 0600-1400"
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <div style={fld}>
            <label style={lbl}>Shift Date *</label>
            <input type="date" style={inp} value={form.shift_date} onChange={e => setF('shift_date', e.target.value)}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <div style={fld}>
            <label style={lbl}>Officers on Duty</label>
            <textarea style={{ ...ta, minHeight:'72px' }}
              value={form.officers_on_duty}
              onChange={e => setF('officers_on_duty', e.target.value)}
              placeholder="Names of officers working this shift..."
              rows={3}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
            {employees.length > 0 && (
              <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>
                Auto-filled from today's shift schedule — edit as needed.
              </div>
            )}
          </div>
          <NavBtns onNext={() => { if (!form.site_id) { toast('Select a site to continue', 'error'); return }; setStep(1) }} nextLabel="NEXT: AI SUMMARY" />
        </>
      )}

      {/* Step 1: AI Summary */}
      {step === 1 && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', gap:'12px', flexWrap:'wrap' }}>
            <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.5 }}>
              AI will pull today's incidents and patrol activity for {selectedSite?.name} and generate professional summaries.
            </div>
            <button onClick={generateAI} disabled={aiLoading}
              style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--accent-bg)', color:'var(--accent)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-md)', padding:'0 16px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:aiLoading?'wait':'pointer', opacity:aiLoading?0.7:1, flexShrink:0, whiteSpace:'nowrap' }}
            >
              <Icon name={aiLoading ? 'loader' : 'cpu'} size={14} />
              {aiLoading ? 'GENERATING...' : 'GENERATE WITH AI'}
            </button>
          </div>
          <div style={fld}>
            <label style={lbl}>Incident Summary</label>
            <textarea style={{ ...ta, minHeight:'112px' }}
              value={form.incident_summary}
              onChange={e => setF('incident_summary', e.target.value)}
              placeholder="Professional summary of incidents during this shift. If none, state no incidents occurred."
              rows={5}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <div style={fld}>
            <label style={lbl}>Patrol Summary</label>
            <textarea style={{ ...ta, minHeight:'96px' }}
              value={form.patrol_summary}
              onChange={e => setF('patrol_summary', e.target.value)}
              placeholder="Summary of patrol activity, checkpoints covered, and security observations."
              rows={4}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <NavBtns onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="NEXT: ADD. NOTES" />
        </>
      )}

      {/* Step 2: Additional Notes */}
      {step === 2 && (
        <>
          <div style={fld}>
            <label style={lbl}>Maintenance Concerns</label>
            <textarea style={ta}
              value={form.maintenance_concerns}
              onChange={e => setF('maintenance_concerns', e.target.value)}
              placeholder="Any maintenance issues, equipment malfunctions, or facility concerns observed during the shift..."
              rows={3}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <div style={fld}>
            <label style={lbl}>Resident / Client Concerns</label>
            <textarea style={ta}
              value={form.resident_concerns}
              onChange={e => setF('resident_concerns', e.target.value)}
              placeholder="Any concerns, complaints, or requests raised by residents or clients during the shift..."
              rows={3}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <div style={fld}>
            <label style={lbl}>Other Notes</label>
            <textarea style={ta}
              value={form.other_notes}
              onChange={e => setF('other_notes', e.target.value)}
              placeholder="Additional observations, equipment status, officer notes..."
              rows={3}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
          </div>
          <NavBtns onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="NEXT: REVIEW & SEND" />
        </>
      )}

      {/* Step 3: Review & Send */}
      {step === 3 && (
        <>
          <DarPreviewCard form={form} sites={sites} />

          {clientUsers.length > 0 && (
            <div style={fld}>
              <label style={lbl}>In-App Recipients</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {clientUsers.map(u => (
                  <label key={u.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'var(--bg-card)', border:`1px solid ${inAppRecipients.includes(u.id)?'var(--accent-border)':'var(--border-subtle)'}`, borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all 150ms ease' }}>
                    <input type="checkbox"
                      checked={inAppRecipients.includes(u.id)}
                      onChange={() => setInAppRecipients(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      style={{ accentColor:'var(--accent)', width:'16px', height:'16px' }}
                    />
                    <div>
                      <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={fld}>
            <label style={lbl}>External Email Recipients</label>
            <input style={inp}
              value={externalEmails}
              onChange={e => setExternalEmails(e.target.value)}
              placeholder="email@example.com, another@example.com"
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
            />
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Comma-separated. A PDF copy will be attached to each email.</div>
          </div>

          <div style={{ display:'flex', gap:'10px', marginTop:'8px', flexWrap:'wrap' }}>
            <button onClick={() => setStep(2)} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', color:'var(--text-secondary)', cursor:'pointer' }}>
              BACK
            </button>
            <button onClick={saveDraft} disabled={saving || sending}
              style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', color:'var(--text-secondary)', cursor:saving?'wait':'pointer', opacity:saving?0.7:1 }}
            >
              {saving ? 'SAVING...' : 'SAVE DRAFT'}
            </button>
            <button onClick={sendDAR} disabled={sending || saving}
              style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 24px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:sending?'wait':'pointer', opacity:sending?0.7:1 }}
            >
              <Icon name="send" size={15} />
              {sending ? 'SENDING...' : 'SEND DAR'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Preview Card ──────────────────────────────────────────────────────────────

function DarPreviewCard({ form, sites }) {
  const site    = sites.find(s => s.id === form.site_id)
  const fmtDate = form.shift_date
    ? new Date(form.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
    : ''

  function Section({ title, content }) {
    if (!content?.trim()) return null
    return (
      <div style={{ marginBottom:'14px' }}>
        <div style={{ fontSize:'10px', fontFamily:'var(--font-condensed)', letterSpacing:'1.5px', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'5px', borderBottom:'1px solid var(--border)', paddingBottom:'4px' }}>{title}</div>
        <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{content}</div>
      </div>
    )
  }

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px 24px', marginBottom:'20px' }}>
      <div style={{ textAlign:'center', marginBottom:'16px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'4px' }}>DAILY ACTIVITY REPORT</div>
        <div style={{ fontSize:'13px', color:'var(--text-secondary)', fontWeight:600 }}>{site?.name || '—'}</div>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'3px' }}>
          {form.shift_label || 'General Shift'} · {fmtDate}
        </div>
      </div>
      <Section title="Officers on Duty"          content={form.officers_on_duty} />
      <Section title="Incident Summary"          content={form.incident_summary} />
      <Section title="Patrol Summary"            content={form.patrol_summary} />
      <Section title="Maintenance Concerns"      content={form.maintenance_concerns} />
      <Section title="Resident / Client Concerns" content={form.resident_concerns} />
      <Section title="Other Notes"               content={form.other_notes} />
    </div>
  )
}

// ── DAR Detail Modal ──────────────────────────────────────────────────────────

function DarDetail({ dar, profile, onClose, onRefresh }) {
  const [fullDar, setFullDar] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('dar')
      .select('*, site:site_id(name), creator:created_by(first_name,last_name)')
      .eq('id', dar.id)
      .maybeSingle()
      .then(({ data }) => { setFullDar(data); setLoading(false) })
  }, [dar.id])

  function fmtDate(d) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
  }

  function Section({ title, content }) {
    if (!content?.trim()) return null
    return (
      <div style={{ marginBottom:'18px' }}>
        <div style={{ fontSize:'10px', fontFamily:'var(--font-condensed)', letterSpacing:'1.5px', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:'6px', borderBottom:'1px solid var(--border)', paddingBottom:'4px' }}>{title}</div>
        <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{content}</div>
      </div>
    )
  }

  const st = fullDar ? (STATUS_STYLES[fullDar.status] || STATUS_STYLES.draft) : STATUS_STYLES.draft

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'32px', width:'100%', maxWidth:'640px', boxShadow:'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>Loading...</div>
        ) : !fullDar ? (
          <div style={{ textAlign:'center', padding:'48px', color:'var(--color-danger)' }}>Report not found.</div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', gap:'12px' }}>
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'20px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>DAILY ACTIVITY REPORT</div>
                <div style={{ fontSize:'14px', color:'var(--text-secondary)', marginTop:'6px', fontWeight:600 }}>{fullDar.site?.name || '—'}</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
                  {fullDar.shift_label || 'General Shift'} · {fmtDate(fullDar.shift_date)}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', flexWrap:'wrap' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', background:st.bg, color:st.color }}>
                    {st.label.toUpperCase()}
                  </span>
                  {fullDar.sent_at && (
                    <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                      Sent {new Date(fullDar.sent_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                {fullDar.pdf_url && (
                  <a href={fullDar.pdf_url} target="_blank" rel="noopener noreferrer"
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
              <Section title="Officers on Duty"           content={fullDar.officers_on_duty} />
              <Section title="Incident Summary"           content={fullDar.incident_summary} />
              <Section title="Patrol Summary"             content={fullDar.patrol_summary} />
              <Section title="Maintenance Concerns"       content={fullDar.maintenance_concerns} />
              <Section title="Resident / Client Concerns" content={fullDar.resident_concerns} />
              <Section title="Other Notes"                content={fullDar.other_notes} />
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid var(--border)', paddingTop:'16px', flexWrap:'wrap', gap:'8px' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                Created by {fullDar.creator ? `${fullDar.creator.first_name || ''} ${fullDar.creator.last_name || ''}`.trim() : '—'} ·{' '}
                {new Date(fullDar.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
              </div>
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
