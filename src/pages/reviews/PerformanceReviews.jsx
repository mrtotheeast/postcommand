import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast, ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const PERIODS = ['Q1 2026','Q2 2026','Q3 2026','Q4 2026','Q1 2025','Q2 2025','Q3 2025','Q4 2025']
const CATS    = ['Attendance','Professionalism','Performance','Communication','Teamwork']
const Q_STARTS = { Q1:'01-01', Q2:'04-01', Q3:'07-01', Q4:'10-01' }
const Q_ENDS   = { Q1:'03-31', Q2:'06-30', Q3:'09-30', Q4:'12-31' }
function periodToDates(period) {
  const [q, year] = period.split(' ')
  return { review_period_start:`${year}-${Q_STARTS[q]}`, review_period_end:`${year}-${Q_ENDS[q]}` }
}
function fmtPeriod(start) {
  if (!start) return '—'
  const d = new Date(start + 'T12:00:00Z')
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear()
  return (m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4') + ' ' + y
}
const s = {
  page:    { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading: { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:     { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  card:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' },
  th:      { textAlign:'left', fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', padding:'8px 14px', borderBottom:'1px solid var(--border)' },
  tr:      { borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 150ms ease' },
  td:      { padding:'12px 14px', fontSize:'13px', color:'var(--text-secondary)', verticalAlign:'middle' },
  tdName:  { padding:'12px 14px', fontSize:'13px', color:'var(--text-primary)', fontWeight:600, verticalAlign:'middle' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' },
  modal:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'560px', boxShadow:'var(--shadow-modal)', flexShrink:0 },
  lbl:     { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:     { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' },
  ghost:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
}
function Stars({ value, onChange, readOnly=false }) {
  return (
    <div style={{ display:'flex', gap:'4px' }}>
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => !readOnly && onChange(i)} style={{ background:'none', border:'none', cursor:readOnly?'default':'pointer', fontSize:'18px', color:i<=value?'#f59e0b':'#e5e7eb', padding:'0', minHeight:'auto', minWidth:'auto' }}>★</button>
      ))}
    </div>
  )
}
export default function PerformanceReviews() {
  const { profile } = useAuth()
  const isAdmin = atLeast(profile?.role, 'lieutenant')
  const [employees, setEmployees] = useState([])
  const [reviews,   setReviews]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEmp,   setEditEmp]   = useState(null)  // employee being reviewed
  const [histEmp,   setHistEmp]   = useState(null)  // employee history panel
  const [search,    setSearch]    = useState('')
  useEffect(() => { if (profile?.company_id) load() }, [profile])
  async function load() {
    setLoading(true)
    const [{ data:emps }, { data:revs }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role,position_title,status').eq('company_id',profile.company_id).eq('status','active').order('last_name'),
      supabase.from('performance_review').select('*').eq('company_id',profile.company_id).order('created_at',{ascending:false}),
    ])
    setEmployees(emps||[]); setReviews(revs||[]); setLoading(false)
  }
  const filtered = useMemo(() => employees.filter(e => !search || `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase())), [employees,search])
  const empReviews = (id) => reviews.filter(r=>r.employee_id===id)
  const lastReview = (id) => { const r=empReviews(id); return r.length ? r[0] : null }
  if (loading) return <div style={{padding:'24px'}}>{[...Array(5)].map((_,i)=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px',marginBottom:'10px'}}/>)}</div>
  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>PERFORMANCE REVIEWS</h2>
      <p style={s.sub}>Employee evaluations — track performance across key competencies.</p>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
        <input style={s.inp} placeholder="Search employees..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={e=>e.target.style.borderColor='var(--border-focus)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
      </div>
      <div style={s.card}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Employee','Role','Last Review','Period','Overall','Actions'].map(h=><th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((emp,i) => {
              const lr = lastReview(emp.id)
              const cnt = empReviews(emp.id).length
              return (
                <tr key={emp.id} style={s.tr} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={s.tdName}>{emp.first_name} {emp.last_name}<div style={{fontSize:'11px',color:'var(--text-muted)',fontWeight:400,marginTop:'1px'}}>{emp.position_title||'—'}</div></td>
                  <td style={s.td}>{ROLE_LABELS[emp.role]||emp.role}</td>
                  <td style={s.td}>{lr ? new Date(lr.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : <span style={{color:'var(--text-muted)'}}>Never reviewed</span>}</td>
                  <td style={s.td}>{lr ? fmtPeriod(lr.review_period_start) : '—'}</td>
                  <td style={s.td}>{lr ? <Stars value={lr.overall_rating||0} readOnly /> : '—'}</td>
                  <td style={s.td} onClick={e=>e.stopPropagation()}>
                    <div style={{display:'flex',gap:'6px'}}>
                      {isAdmin && <button style={{...s.btn,height:'32px',padding:'0 12px',fontSize:'11px'}} onClick={()=>{setEditEmp(emp);setShowModal(true)}}><Icon name="edit" size={12}/>REVIEW</button>}
                      {cnt>0 && <button style={{...s.ghost,height:'32px',padding:'0 12px',fontSize:'11px'}} onClick={()=>setHistEmp(emp)}><Icon name="clock" size={12}/>HISTORY ({cnt})</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {showModal && editEmp && <ReviewModal emp={editEmp} profile={profile} onClose={()=>{setShowModal(false);setEditEmp(null)}} onSaved={()=>{setShowModal(false);setEditEmp(null);load()}} />}
      {histEmp && <HistoryPanel emp={histEmp} reviews={empReviews(histEmp.id)} onClose={()=>setHistEmp(null)} />}
    </div>
  )
}
function ReviewModal({ emp, profile, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ period:PERIODS[0], rating:0, attendance:3, professionalism:3, performance:3, communication:3, teamwork:3, comments:'' })
  const [saving, setSaving] = useState(false)
  function setF(k,v) { setForm(p=>({...p,[k]:v})) }
  const f=e=>{e.target.style.borderColor='var(--border-focus)'}; const b=e=>{e.target.style.borderColor='var(--border)'}
  async function save() {
    if (form.rating===0) { alert('Please set an overall rating.'); return }
    setSaving(true)
    try {
      const { data:reviewer } = await supabase.from('employee').select('id').eq('user_id',profile.id).maybeSingle()
      const dates = periodToDates(form.period)
      const { data:inserted, error } = await supabase
        .from('performance_review')
        .insert({
          company_id:          profile.company_id,
          employee_id:         emp.id,
          reviewer_id:         reviewer?.id,
          review_period_start: dates.review_period_start,
          review_period_end:   dates.review_period_end,
          review_date:         new Date().toISOString().slice(0, 10),
          overall_rating:      form.rating,
          attendance:          form.attendance,
          professionalism:     form.professionalism,
          performance:         form.performance,
          communication:       form.communication,
          teamwork:            form.teamwork,
          reviewer_comments:   form.comments,
        })
        .select('id')
        .single()
      if (error) throw error
      if (!inserted?.id) throw new Error('Review was not saved — no record returned')
      toast('Review saved')
      onSaved()
    } catch(e) {
      toast(e?.message || 'Failed to save review', 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div style={s.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={s.modal}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
          <div><div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'1.5px',color:'var(--text-primary)'}}>PERFORMANCE REVIEW</div><div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{emp.first_name} {emp.last_name}</div></div>
          <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div style={{marginBottom:'12px'}}>
          <div style={s.lbl}>Review Period</div>
          <select style={{...s.inp,cursor:'pointer'}} value={form.period} onChange={e=>setF('period',e.target.value)}>
            {PERIODS.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div style={{marginBottom:'14px'}}>
          <div style={s.lbl}>Overall Rating *</div>
          <Stars value={form.rating} onChange={v=>setF('rating',v)}/>
        </div>
        <div style={{marginBottom:'12px'}}>
          <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>Category Ratings</div>
          {CATS.map(cat=>(
            <div key={cat} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:'13px',color:'var(--text-primary)'}}>{cat}</span>
              <Stars value={form[cat.toLowerCase()]} onChange={v=>setF(cat.toLowerCase(),v)}/>
            </div>
          ))}
        </div>
        <div style={{marginBottom:'18px'}}>
          <div style={s.lbl}>Comments</div>
          <textarea style={{...s.inp,minHeight:'80px',resize:'vertical',lineHeight:1.5}} value={form.comments} onChange={e=>setF('comments',e.target.value)} onFocus={f} onBlur={b} placeholder="Strengths, areas for improvement, goals..."/>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button style={{...s.btn,opacity:saving?0.6:1}} onClick={save} disabled={saving}><Icon name="save" size={14}/>{saving?'SAVING...':'SAVE REVIEW'}</button>
          <button style={s.ghost} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
function HistoryPanel({ emp, reviews, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:'min(420px,100vw)',background:'var(--bg-surface)',borderLeft:'1px solid var(--border)',zIndex:301,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'18px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div><div style={{fontFamily:'var(--font-display)',fontSize:'16px',letterSpacing:'2px',color:'var(--text-primary)'}}>REVIEW HISTORY</div><div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{emp.first_name} {emp.last_name}</div></div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',display:'flex',minHeight:'44px',minWidth:'44px',alignItems:'center',justifyContent:'center'}}><Icon name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
          {reviews.map((r,i)=>(
            <div key={r.id} style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px',marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                <div style={{fontFamily:'var(--font-condensed)',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px'}}>{fmtPeriod(r.review_period_start)}</div>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
              </div>
              <Stars value={r.overall_rating||0} readOnly />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginTop:'10px'}}>
                {CATS.map(cat=>(
                  <div key={cat} style={{fontSize:'11px',color:'var(--text-secondary)'}}>
                    <span style={{color:'var(--text-muted)'}}>{cat}: </span>{'★'.repeat(r[cat.toLowerCase()]||0)+'☆'.repeat(5-(r[cat.toLowerCase()]||0))}
                  </div>
                ))}
              </div>
              {r.reviewer_comments && <div style={{marginTop:'10px',fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.6,padding:'8px',background:'var(--bg-surface)',borderRadius:'var(--radius-sm)'}}>{r.reviewer_comments}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
