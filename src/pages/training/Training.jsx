import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { supabase } from '../../lib/supabase'
import { atLeast, ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { emailTrainingAssigned } from '../../lib/email'

const COURSE_STATUS  = { draft:'Draft', active:'Active', archived:'Archived' }
const ASSIGN_STATUS  = { pending:'Pending', in_progress:'In Progress', completed:'Completed', overdue:'Overdue' }

const s = {
  page:     { padding:'24px', maxWidth:'1100px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' },
  tabs:     { display:'flex', gap:'2px', marginBottom:'22px', borderBottom:'1px solid var(--border)', paddingBottom:0 },
  tab:      { padding:'10px 18px', fontSize:'13px', color:'var(--text-secondary)', background:'transparent', border:'none', cursor:'pointer', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  tabAct:   { color:'var(--accent)', borderBottom:'2px solid var(--accent)', fontWeight:700 },
  stats:    { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'10px', marginBottom:'20px' },
  statCard: { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px' },
  statLbl:  { fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'4px' },
  statVal:  { fontFamily:'var(--font-display)', fontSize:'26px', letterSpacing:'1px', lineHeight:1 },
  toolbar:  { display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' },
  search:   { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', outline:'none', flex:1, minWidth:'160px', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  sel:      { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' },
  addBtn:   { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'42px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 },
  pill:     { display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', whiteSpace:'nowrap' },
  // Course cards
  grid:     { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'14px' },
  courseCard:{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px', display:'flex', flexDirection:'column', gap:'10px', transition:'all 150ms ease', cursor:'pointer' },
  courseTitle:{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1.2 },
  courseDesc:{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.5, flex:1 },
  courseMeta:{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' },
  // Assignment rows
  aRow:     { display:'flex', alignItems:'center', gap:'14px', padding:'14px 18px', borderBottom:'1px solid var(--border)', transition:'background 150ms ease' },
  aName:    { fontSize:'13px', fontWeight:600, color:'var(--text-primary)' },
  aMeta:    { fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' },
  // Modals
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' },
  modal:    { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'28px', width:'100%', maxWidth:'640px', boxShadow:'var(--shadow-modal)', flexShrink:0 },
  mHead:    { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'22px' },
  mTitle:   { fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)' },
  closeBtn: { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' },
  lbl:      { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' },
  inp:      { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', transition:'border-color 150ms ease' },
  ta:       { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', width:'100%', fontFamily:'var(--font-body)', resize:'vertical', lineHeight:1.6, minHeight:'80px' },
  field:    { marginBottom:'14px' },
  saveBtn:  { display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 22px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease' },
  ghostBtn: { display:'inline-flex', alignItems:'center', gap:'8px', background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  dangerBtn:{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-danger-bg)', color:'var(--color-danger)', border:'1px solid rgba(192,57,43,0.3)', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', letterSpacing:'1px', cursor:'pointer' },
  sectionLbl:{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', margin:'18px 0 10px', borderBottom:'1px solid var(--border)', paddingBottom:'6px' },
  progressBar:{ height:'6px', borderRadius:'3px', background:'var(--border)', overflow:'hidden', marginTop:'4px' },
  progressFill:{ height:'100%', borderRadius:'3px', background:'var(--color-success)', transition:'width 400ms ease' },
}

function assignStatusMeta(status) {
  return {
    pending:     { bg:'var(--border)',              color:'var(--text-muted)',    label:'Pending' },
    in_progress: { bg:'var(--color-info-bg)',       color:'var(--color-info)',    label:'In Progress' },
    completed:   { bg:'var(--color-success-bg)',    color:'var(--color-success)', label:'Completed' },
    overdue:     { bg:'var(--color-danger-bg)',     color:'var(--color-danger)',  label:'Overdue' },
  }[status] || { bg:'var(--border)', color:'var(--text-muted)', label:status }
}

export default function Training() {
  const { profile }          = useAuth()
  const { incrementBadge, clearBadge } = useNotifications()
  const isAdmin = atLeast(profile?.role, 'sergeant')
  const [tab, setTab]               = useState(isAdmin ? 'library' : 'my')
  const [employee, setEmployee]     = useState(null)
  const [courses, setCourses]       = useState([])
  const [assignments, setAssignments] = useState([])
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState(null)
  const [viewing, setViewing]       = useState(null)
  const [assigning, setAssigning]   = useState(null)
  const [search, setSearch]         = useState('')

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const [{ data: empData }, { data: allEmp }, { data: courseData }, { data: assignData }] = await Promise.all([
      supabase.from('employee').select('id,first_name,last_name,role').eq('user_id', profile.id).single(),
      supabase.from('employee').select('id,first_name,last_name,role,status').eq('company_id', profile.company_id).eq('status','active').order('last_name'),
      supabase.from('training_course').select('*').eq('company_id', profile.company_id).order('created_at', { ascending:false }),
      supabase.from('training_assignment').select('*').eq('company_id', profile.company_id).order('created_at', { ascending:false }),
    ])
    setEmployee(empData)
    setEmployees(allEmp || [])
    setCourses(courseData || [])
    setAssignments(assignData || [])

    // Badge: pending assignments for this employee
    const pending = (assignData||[]).filter(a => empData && a.employee_id === empData.id && (a.status === 'pending' || a.status === 'in_progress'))
    if (pending.length > 0) incrementBadge('pending_training')
    else clearBadge('pending_training')

    setLoading(false)
  }

  async function deleteCourse(id) {
    await supabase.from('training_course').delete().eq('id', id)
    setViewing(null); load()
  }

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]))

  // My assignments (for officer view)
  const myAssignments = useMemo(() => {
    if (!employee) return []
    return assignments.filter(a => a.employee_id === employee.id)
      .map(a => ({ ...a, course: courses.find(c => c.id === a.course_id) }))
      .filter(a => a.course)
  }, [assignments, employee, courses])

  // Completion stats per course
  const courseStats = useMemo(() => {
    const m = {}
    for (const c of courses) {
      const ca = assignments.filter(a => a.course_id === c.id)
      m[c.id] = { total: ca.length, completed: ca.filter(a => a.status === 'completed').length, pending: ca.filter(a => a.status === 'pending' || a.status === 'in_progress').length }
    }
    return m
  }, [courses, assignments])

  const filteredCourses = courses.filter(c => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalAssigned    = assignments.length
  const totalCompleted   = assignments.filter(a => a.status === 'completed').length
  const completionRate   = totalAssigned > 0 ? Math.round((totalCompleted/totalAssigned)*100) : 0
  const myPending        = myAssignments.filter(a => a.status === 'pending' || a.status === 'in_progress').length

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:'120px', borderRadius:'10px', marginBottom:'12px' }} />)}</div>

  const TABS = [
    ...(isAdmin ? [{ id:'library', label:'Course Library' }, { id:'assignments', label:`Assignments (${totalAssigned})` }] : []),
    { id:'my', label:`My Training${myPending > 0 ? ` (${myPending})` : ''}` },
  ]

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .course-card:hover{border-color:var(--accent-border)!important;background:var(--bg-card-hover)!important;}`}</style>
      <h2 style={s.heading}>TRAINING</h2>
      <p style={s.sub}>Build courses, assign training, and track completion.</p>

      {isAdmin && (
        <div style={s.stats}>
          {[
            { label:'Courses',         value:courses.filter(c=>c.status==='active').length, color:'var(--text-primary)' },
            { label:'Total Assigned',  value:totalAssigned,   color:'var(--color-info)' },
            { label:'Completed',       value:totalCompleted,  color:'var(--color-success)' },
            { label:'Completion Rate', value:`${completionRate}%`, color: completionRate >= 80 ? 'var(--color-success)' : completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' },
          ].map(c => (
            <div key={c.label} style={s.statCard}>
              <div style={s.statLbl}>{c.label}</div>
              <div style={{ ...s.statVal, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.tabs}>
        {TABS.map(t => <button key={t.id} style={{ ...s.tab, ...(tab===t.id?s.tabAct:{}) }} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {/* ── Course Library ── */}
      {tab === 'library' && (
        <>
          <div style={s.toolbar}>
            <input style={s.search} placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => e.target.style.borderColor='var(--border-focus)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
            <button style={s.addBtn} onClick={() => setEditing('new')}><Icon name="plus" size={15} />NEW COURSE</button>
          </div>
          <div style={s.grid}>
            {filteredCourses.map(course => {
              const st = courseStats[course.id] || { total:0, completed:0, pending:0 }
              const pct = st.total > 0 ? Math.round((st.completed/st.total)*100) : 0
              return (
                <div key={course.id} className="course-card" style={s.courseCard} onClick={() => setViewing(course)}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon name="book-open" size={18} color="var(--accent)" />
                    </div>
                    <span style={{ ...s.pill, background: course.status==='active'?'var(--color-success-bg)':course.status==='draft'?'var(--border)':'rgba(130,130,130,0.12)', color: course.status==='active'?'var(--color-success)':course.status==='draft'?'var(--text-muted)':'#8899aa' }}>
                      {COURSE_STATUS[course.status]?.toUpperCase()}
                    </span>
                  </div>
                  <div style={s.courseTitle}>{course.title}</div>
                  {course.description && <div style={s.courseDesc}>{course.description.slice(0,100)}{course.description.length>100?'...':''}</div>}
                  <div style={s.courseMeta}>
                    {course.duration_minutes && <span style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px' }}><Icon name="clock" size={11} />{course.duration_minutes} min</span>}
                    {st.total > 0 && <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{st.completed}/{st.total} completed</span>}
                  </div>
                  {st.total > 0 && (
                    <div style={s.progressBar}>
                      <div style={{ ...s.progressFill, width:`${pct}%` }} />
                    </div>
                  )}
                  <button style={{ ...s.addBtn, background:'transparent', color:'var(--accent)', border:'1px dashed var(--accent-border)', height:'34px', fontSize:'11px', padding:'0 12px', marginTop:'4px', alignSelf:'flex-start' }}
                    onClick={e => { e.stopPropagation(); setAssigning(course) }}>
                    <Icon name="user-plus" size={12} />ASSIGN
                  </button>
                </div>
              )
            })}
            {filteredCourses.length === 0 && (
              <div style={{ gridColumn:'1/-1', padding:'40px', textAlign:'center', color:'var(--text-muted)' }}>No courses found. Create your first course.</div>
            )}
          </div>
        </>
      )}

      {/* ── Assignments ── */}
      {tab === 'assignments' && (
        <AssignmentsTab assignments={assignments} courses={courses} empMap={empMap} onRefresh={load} />
      )}

      {/* ── My Training ── */}
      {tab === 'my' && (
        <MyTrainingTab assignments={myAssignments} employee={employee} onRefresh={load} />
      )}

      {editing && <CourseFormModal course={editing==='new'?null:editing} companyId={profile.company_id} employeeId={employee?.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {viewing && <CourseDetailPanel course={viewing} stats={courseStats[viewing.id]} assignments={assignments.filter(a=>a.course_id===viewing.id)} empMap={empMap} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null) }} onDelete={deleteCourse} onAssign={() => { setAssigning(viewing); setViewing(null) }} />}
      {assigning && <AssignModal course={assigning} employees={employees} assignments={assignments} companyId={profile.company_id} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); load() }} />}
    </div>
  )
}

// ── Assignments Tab ───────────────────────────────────────────────────────────

function AssignmentsTab({ assignments, courses, empMap, onRefresh }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const courseMap = Object.fromEntries(courses.map(c=>[c.id,c]))
  const visible = assignments.filter(a => filterStatus==='all'||a.status===filterStatus)

  async function markComplete(id) {
    await supabase.from('training_assignment').update({ status:'completed', completed_at:new Date().toISOString() }).eq('id',id)
    onRefresh()
  }

  return (
    <>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
        <select style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', outline:'none', cursor:'pointer', fontFamily:'var(--font-body)' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {Object.entries(ASSIGN_STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'var(--text-muted)' }}>No assignments found.</div>
        ) : visible.map((a,i) => {
          const emp    = empMap[a.employee_id]
          const course = courseMap[a.course_id]
          const meta   = assignStatusMeta(a.status)
          return (
            <div key={a.id} style={{ ...s.aRow, borderBottom: i<visible.length-1?'1px solid var(--border)':'none' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={s.aName}>{course?.title ?? 'Unknown Course'}</div>
                <div style={s.aMeta}>{emp ? `${emp.first_name} ${emp.last_name}` : '—'} · {ROLE_LABELS[emp?.role]??'—'}{a.due_date ? ` · Due ${new Date(a.due_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : ''}</div>
              </div>
              <span style={{ ...s.pill, background:meta.bg, color:meta.color }}>{meta.label}</span>
              {a.status !== 'completed' && (
                <button style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)', borderRadius:'var(--radius-sm)', padding:'0 12px', height:'34px', fontFamily:'var(--font-condensed)', fontSize:'11px', letterSpacing:'1px', cursor:'pointer' }}
                  onClick={() => markComplete(a.id)}>
                  <Icon name="check" size={12} />COMPLETE
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── My Training Tab ───────────────────────────────────────────────────────────

function MyTrainingTab({ assignments, employee, onRefresh }) {
  const [reading, setReading] = useState(null)

  async function startOrComplete(assignment) {
    if (assignment.status === 'pending') {
      await supabase.from('training_assignment').update({ status:'in_progress' }).eq('id', assignment.id)
      onRefresh()
    }
    setReading(assignment)
  }

  async function markComplete(id) {
    await supabase.from('training_assignment').update({ status:'completed', completed_at:new Date().toISOString() }).eq('id', id)
    setReading(null); onRefresh()
  }

  if (assignments.length === 0) {
    return (
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'48px', textAlign:'center' }}>
        <Icon name="check-circle" size={32} color="var(--color-success)" />
        <div style={{ marginTop:'12px', fontFamily:'var(--font-condensed)', fontSize:'14px', color:'var(--color-success)', letterSpacing:'1px' }}>ALL CAUGHT UP</div>
        <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'6px' }}>No training assignments.</div>
      </div>
    )
  }

  return (
    <>
      <div style={s.grid}>
        {assignments.map(a => {
          const meta = assignStatusMeta(a.status)
          const isDone = a.status === 'completed'
          return (
            <div key={a.id} className="course-card" style={{ ...s.courseCard, opacity: isDone ? 0.7 : 1 }} onClick={() => !isDone && startOrComplete(a)}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div style={{ width:'38px', height:'38px', borderRadius:'var(--radius-sm)', background: isDone ? 'var(--color-success-bg)' : 'var(--accent-bg)', border:`1px solid ${isDone?'rgba(58,170,106,0.3)':'var(--accent-border)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon name={isDone?'check-circle':'book-open'} size={18} color={isDone?'var(--color-success)':'var(--accent)'} />
                </div>
                <span style={{ ...s.pill, background:meta.bg, color:meta.color }}>{meta.label}</span>
              </div>
              <div style={s.courseTitle}>{a.course?.title}</div>
              {a.course?.description && <div style={s.courseDesc}>{a.course.description.slice(0,100)}</div>}
              <div style={{ fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'12px' }}>
                {a.course?.duration_minutes && <span><Icon name="clock" size={11} /> {a.course.duration_minutes} min</span>}
                {a.due_date && <span>Due {new Date(a.due_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
              </div>
              {isDone
                ? <div style={{ fontSize:'12px', color:'var(--color-success)' }}>Completed {new Date(a.completed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                : <div style={{ ...s.addBtn, justifyContent:'center', height:'36px', fontSize:'12px', padding:'0 14px', background: a.status==='in_progress'?'var(--color-info)':'var(--accent)' }}>
                    {a.status==='in_progress' ? 'CONTINUE' : 'START'}
                  </div>
              }
            </div>
          )
        })}
      </div>

      {reading && (
        <CourseReadModal assignment={reading} onClose={() => setReading(null)} onComplete={() => markComplete(reading.id)} />
      )}
    </>
  )
}

// ── Course Read Modal ────────────────────────────────────────────────────────

function CourseReadModal({ assignment, onClose, onComplete }) {
  const course = assignment.course
  const isDone = assignment.status === 'completed'
  const [questions, setQuestions] = useState([])
  const [phase, setPhase] = useState('read') // read | quiz | result | cert
  const [answers, setAnswers] = useState({})
  const [score, setScore] = useState(null)
  const PASS = 70

  useEffect(() => {
    if (course?.id) supabase.from('training_quiz_question').select('*').eq('course_id', course.id).order('order_index').then(({data})=>setQuestions(data||[]))
  }, [course?.id])

  function submitQuiz() {
    let correct = 0
    questions.forEach((q,i) => { if (answers[i] === q.correct_answer_index) correct++ })
    const pct = questions.length > 0 ? Math.round((correct/questions.length)*100) : 100
    setScore(pct)
    setPhase(pct >= PASS ? 'cert' : 'result')
  }

  function printCert() {
    const w = window.open('', '_blank', 'width=800,height=600')
    const now = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    w.document.write(`<!DOCTYPE html><html><head><title>Certificate</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Georgia',serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px}
    .cert{border:12px double #c8a84b;padding:60px 80px;text-align:center;max-width:700px;width:100%}
    h1{font-size:42px;color:#0d1f35;letter-spacing:4px;margin-bottom:8px;font-family:'Georgia',serif}
    .sub{font-size:14px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:40px}
    .to{font-size:16px;color:#555;margin-bottom:8px}
    .name{font-size:32px;color:#0d1f35;border-bottom:2px solid #c8a84b;padding-bottom:12px;margin-bottom:24px}
    .body{font-size:15px;color:#444;line-height:1.8;margin-bottom:32px}
    .course{font-size:22px;font-weight:bold;color:#0d1f35;margin:12px 0}
    .date{font-size:13px;color:#888;margin-top:32px}.score{font-size:14px;color:#c8a84b;margin-top:8px;font-weight:bold}
    </style></head><body><div class="cert">
    <h1>POSTCOMMAND</h1><div class="sub">Certificate of Completion</div>
    <div class="to">This certifies that</div>
    <div class="name">${assignment.employee_name||'Officer'}</div>
    <div class="body">has successfully completed the training course</div>
    <div class="course">${course?.title}</div>
    ${score !== null ? `<div class="score">Score: ${score}%</div>` : ''}
    <div class="date">Issued ${now}</div>
    </div></body></html>`)
    w.document.close(); w.print()
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ ...s.modal, maxWidth:'720px' }}>
        <div style={s.mHead}>
          <div>
            <div style={s.mTitle}>{phase==='cert'?'CERTIFICATE':'READ COURSE'}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{course?.title}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {phase === 'read' && (
          <>
            <div style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.8, whiteSpace:'pre-wrap', maxHeight:'50vh', overflowY:'auto', padding:'16px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', marginBottom:'20px' }}>
              {course?.content || 'No content has been added to this course yet.'}
            </div>
            {!isDone && (
              <div style={{ display:'flex', gap:'10px' }}>
                {questions.length > 0 ? (
                  <button style={s.saveBtn} onClick={()=>setPhase('quiz')}><Icon name="help-circle" size={15}/>TAKE QUIZ ({questions.length} questions)</button>
                ) : (
                  <button style={s.saveBtn} onClick={onComplete}><Icon name="check-circle" size={15}/>MARK COMPLETE</button>
                )}
                <button style={s.ghostBtn} onClick={onClose}>CLOSE</button>
              </div>
            )}
            {isDone && <button style={s.ghostBtn} onClick={onClose}>CLOSE</button>}
          </>
        )}

        {phase === 'quiz' && (
          <>
            <div style={{ maxHeight:'55vh', overflowY:'auto', marginBottom:'16px' }}>
              {questions.map((q,qi)=>(
                <div key={q.id} style={{ marginBottom:'18px', padding:'14px', background:'var(--bg-surface)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', marginBottom:'10px' }}>{qi+1}. {q.question}</div>
                  {(q.options||[]).filter(Boolean).map((opt,oi)=>(
                    <label key={oi} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'var(--radius-sm)', marginBottom:'6px', cursor:'pointer', background:answers[qi]===oi?'var(--accent-bg)':'transparent', border:`1px solid ${answers[qi]===oi?'var(--accent-border)':'var(--border)'}`, transition:'all 150ms ease' }}>
                      <input type="radio" checked={answers[qi]===oi} onChange={()=>setAnswers(p=>({...p,[qi]:oi}))} style={{ accentColor:'var(--accent)', cursor:'pointer' }}/>
                      <span style={{ fontSize:'13px', color:'var(--text-primary)' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...s.saveBtn, opacity:Object.keys(answers).length<questions.length?0.6:1 }} onClick={submitQuiz} disabled={Object.keys(answers).length<questions.length}>SUBMIT QUIZ</button>
              <button style={s.ghostBtn} onClick={()=>setPhase('read')}>BACK</button>
            </div>
          </>
        )}

        {phase === 'result' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'48px', fontFamily:'var(--font-display)', color:'var(--color-danger)', letterSpacing:'2px', marginBottom:'8px' }}>{score}%</div>
            <div style={{ fontSize:'14px', color:'var(--text-secondary)', marginBottom:'20px' }}>Score below {PASS}% — please review the material and try again.</div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button style={s.saveBtn} onClick={()=>{setPhase('read');setAnswers({})}}>REVIEW & RETRY</button>
              <button style={s.ghostBtn} onClick={onClose}>CLOSE</button>
            </div>
          </div>
        )}

        {phase === 'cert' && (
          <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
            <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:'var(--color-success-bg)', border:'3px solid var(--color-success)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Icon name="award" size={36} color="var(--color-success)"/>
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'6px' }}>PASSED!</div>
            <div style={{ fontSize:'14px', color:'var(--text-secondary)', marginBottom:'20px' }}>Score: <strong style={{color:'var(--color-success)'}}>{score}%</strong> — {course?.title}</div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button style={s.saveBtn} onClick={()=>{onComplete();printCert()}}><Icon name="award" size={14}/>COMPLETE & PRINT CERTIFICATE</button>
              <button style={{ ...s.saveBtn, background:'var(--color-success-bg)', color:'var(--color-success)', border:'1px solid rgba(58,170,106,0.3)' }} onClick={onComplete}><Icon name="check" size={14}/>COMPLETE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Course Form Modal ─────────────────────────────────────────────────────────

function CourseFormModal({ course, companyId, employeeId, onClose, onSaved }) {
  const [form, setForm] = useState(course ? { title:course.title, description:course.description||'', content:course.content||'', duration_minutes:course.duration_minutes||'', status:course.status||'active' } : { title:'', description:'', content:'', duration_minutes:'', status:'active' })
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  function setF(k,v) { setForm(prev=>({...prev,[k]:v})) }
  const inputF = e => { e.target.style.borderColor='var(--border-focus)' }
  const inputB = e => { e.target.style.borderColor='var(--border)' }

  useEffect(() => {
    if (course?.id) supabase.from('training_quiz_question').select('*').eq('course_id', course.id).order('order_index').then(({data})=>setQuestions(data||[]))
  }, [course?.id])

  function addQ() { setQuestions(p=>[...p,{_id:Date.now(),question:'',options:['','','',''],correct_answer_index:0,order_index:p.length}]) }
  function removeQ(idx) { setQuestions(p=>p.filter((_,i)=>i!==idx)) }
  function setQ(idx,field,val) { setQuestions(p=>{ const n=[...p]; n[idx]={...n[idx],[field]:val}; return n }) }
  function setOpt(qIdx,oIdx,val) { setQuestions(p=>{ const n=[...p]; const opts=[...n[qIdx].options]; opts[oIdx]=val; n[qIdx]={...n[qIdx],options:opts}; return n }) }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = { company_id:companyId, title:form.title.trim(), description:form.description.trim()||null, content:form.content.trim()||null, duration_minutes:parseInt(form.duration_minutes)||null, status:form.status, created_by:employeeId||null }
    let courseId = course?.id
    if (course?.id) { await supabase.from('training_course').update(payload).eq('id',course.id) }
    else { const {data} = await supabase.from('training_course').insert(payload).select().single(); courseId=data?.id }
    if (courseId) {
      await supabase.from('training_quiz_question').delete().eq('course_id', courseId)
      const validQs = questions.filter(q=>q.question.trim()&&q.options.some(o=>o.trim()))
      if (validQs.length > 0) await supabase.from('training_quiz_question').insert(validQs.map((q,i)=>({course_id:courseId,question:q.question.trim(),options:q.options,correct_answer_index:q.correct_answer_index,order_index:i})))
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={s.overlay} onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={s.modal}>
        <div style={s.mHead}>
          <div style={s.mTitle}>{course ? 'EDIT COURSE' : 'NEW COURSE'}</div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Title *</div>
          <input style={s.inp} value={form.title} onChange={e=>setF('title',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="e.g. Use of Force Policy" />
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Description</div>
          <input style={s.inp} value={form.description} onChange={e=>setF('description',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Brief summary shown on the card..." />
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Course Content</div>
          <textarea style={{ ...s.ta, minHeight:'180px' }} value={form.content} onChange={e=>setF('content',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="Enter the full course material here. Supports plain text." />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
          <div>
            <div style={s.lbl}>Duration (minutes)</div>
            <input style={s.inp} type="number" min="1" value={form.duration_minutes} onChange={e=>setF('duration_minutes',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder="30" />
          </div>
          <div>
            <div style={s.lbl}>Status</div>
            <select style={{ ...s.inp, cursor:'pointer' }} value={form.status} onChange={e=>setF('status',e.target.value)}>
              {Object.entries(COURSE_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div style={s.sectionLbl}>Quiz Questions (optional)</div>
        {questions.map((q,qi)=>(
          <div key={q._id||q.id||qi} style={{background:'var(--bg-surface)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',padding:'12px',marginBottom:'10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
              <input style={{...s.inp,flex:1}} value={q.question} onChange={e=>setQ(qi,'question',e.target.value)} onFocus={inputF} onBlur={inputB} placeholder={`Question ${qi+1}`}/>
              <button style={{background:'transparent',border:'none',color:'var(--text-muted)',cursor:'pointer',padding:'4px',display:'flex'}} onClick={()=>removeQ(qi)}><Icon name="trash-2" size={13}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
              {q.options.map((opt,oi)=>(
                <div key={oi} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <input type="radio" checked={q.correct_answer_index===oi} onChange={()=>setQ(qi,'correct_answer_index',oi)} style={{accentColor:'var(--accent)',cursor:'pointer',flexShrink:0}} title="Mark as correct"/>
                  <input style={{...s.inp,fontSize:'12px',padding:'7px 10px'}} value={opt} onChange={e=>setOpt(qi,oi,e.target.value)} onFocus={inputF} onBlur={inputB} placeholder={`Option ${oi+1}${q.correct_answer_index===oi?' (correct)':''}`}/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button style={{...s.ghostBtn,height:'34px',fontSize:'11px',padding:'0 14px',marginBottom:'16px',borderStyle:'dashed'}} onClick={addQ}><Icon name="plus" size={12}/>ADD QUESTION</button>

        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.saveBtn, opacity:(!form.title.trim()||saving)?0.6:1 }} onClick={save} disabled={!form.title.trim()||saving}>
            <Icon name="save" size={14} />{saving?'SAVING...':'SAVE COURSE'}
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Course Detail Panel ───────────────────────────────────────────────────────

function CourseDetailPanel({ course, stats, assignments, empMap, onClose, onEdit, onDelete, onAssign }) {
  const meta = assignStatusMeta
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:400, display:'flex', alignItems:'stretch', justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ width:'420px', maxWidth:'100vw', background:'var(--bg-card)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', animation:'slideIn 200ms ease' }} onClick={e=>e.stopPropagation()}>
        <style>{`@keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'20px 22px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1.1 }}>{course.title}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{COURSE_STATUS[course.status]} · {stats?.total??0} assigned</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>
          {course.description && <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'16px' }}>{course.description}</p>}
          {stats && stats.total > 0 && (
            <div style={{ marginBottom:'18px' }}>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'8px' }}>Completion</div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1, ...s.progressBar }}><div style={{ ...s.progressFill, width:`${stats.total?Math.round(stats.completed/stats.total*100):0}%` }} /></div>
                <span style={{ fontSize:'13px', color:'var(--color-success)', fontFamily:'var(--font-condensed)', fontWeight:700 }}>{stats.completed}/{stats.total}</span>
              </div>
            </div>
          )}
          <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'10px' }}>Assigned Employees</div>
          {assignments.length === 0 ? (
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No one assigned yet.</div>
          ) : assignments.map((a,i) => {
            const emp = empMap[a.employee_id]
            const m = assignStatusMeta(a.status)
            return (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom: i<assignments.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', color:'var(--text-primary)' }}>{emp?`${emp.first_name} ${emp.last_name}`:'—'}</div>
                  {a.due_date && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>Due {new Date(a.due_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>}
                </div>
                <span style={{ ...s.pill, background:m.bg, color:m.color }}>{m.label}</span>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'16px 22px', borderTop:'1px solid var(--border)', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0 }}>
          <button style={{ ...s.saveBtn, height:'38px', fontSize:'12px', padding:'0 16px' }} onClick={onAssign}><Icon name="user-plus" size={13} />ASSIGN</button>
          <button style={{ ...s.ghostBtn, height:'38px', fontSize:'12px', padding:'0 14px' }} onClick={onEdit}><Icon name="edit-2" size={13} />EDIT</button>
          <button style={{ ...s.dangerBtn, height:'38px', fontSize:'12px', padding:'0 12px' }} onClick={() => { if(window.confirm('Delete this course?')) onDelete(course.id) }}><Icon name="trash-2" size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Assign Modal ──────────────────────────────────────────────────────────────

function AssignModal({ course, employees, assignments, companyId, onClose, onSaved }) {
  const [selected, setSelected] = useState([])
  const [dueDate, setDueDate]   = useState('')
  const [saving, setSaving]     = useState(false)
  const alreadyAssigned = new Set(assignments.filter(a=>a.course_id===course.id).map(a=>a.employee_id))

  function toggle(id) { setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]) }
  function selectAll() { setSelected(employees.filter(e=>!alreadyAssigned.has(e.id)).map(e=>e.id)) }

  async function save() {
    if (selected.length === 0) return
    setSaving(true)
    await supabase.from('training_assignment').insert(
      selected.map(eid => ({ company_id:companyId, course_id:course.id, employee_id:eid, status:'pending', due_date:dueDate||null }))
    )
    // Email each assigned employee
    for (const eid of selected) {
      const emp = employees.find(e=>e.id===eid)
      if (emp?.email) {
        const dueFmt = dueDate ? new Date(dueDate+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : null
        emailTrainingAssigned({ to:emp.email, firstName:emp.first_name, courseTitle:course.title, dueDate:dueFmt, duration:course.duration_minutes })
      }
    }
    setSaving(false); onSaved()
  }

  const eligible = employees.filter(e=>!alreadyAssigned.has(e.id))

  return (
    <div style={s.overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ ...s.modal, maxWidth:'480px' }}>
        <div style={s.mHead}>
          <div>
            <div style={s.mTitle}>ASSIGN COURSE</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>{course.title}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={s.field}>
          <div style={s.lbl}>Due Date (optional)</div>
          <input style={s.inp} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}
            onFocus={e=>e.target.style.borderColor='var(--border-focus)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'}
          />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          <div style={s.lbl}>Select Employees</div>
          <button style={{ background:'transparent', border:'none', fontSize:'12px', color:'var(--accent)', cursor:'pointer', padding:'0' }} onClick={selectAll}>Select All</button>
        </div>
        <div style={{ maxHeight:'260px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:'18px' }}>
          {eligible.length === 0 ? (
            <div style={{ padding:'20px', textAlign:'center', fontSize:'13px', color:'var(--text-muted)' }}>All employees are already assigned.</div>
          ) : eligible.map((emp,i) => (
            <label key={emp.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px', borderBottom: i<eligible.length-1?'1px solid var(--border)':'none', cursor:'pointer', background: selected.includes(emp.id)?'var(--accent-bg)':'transparent', transition:'background 150ms ease' }}>
              <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} style={{ accentColor:'var(--accent)', width:'16px', height:'16px', cursor:'pointer' }} />
              <div>
                <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{emp.first_name} {emp.last_name}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{ROLE_LABELS[emp.role]??emp.role}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={{ ...s.saveBtn, opacity:(selected.length===0||saving)?0.6:1 }} onClick={save} disabled={selected.length===0||saving}>
            <Icon name="user-plus" size={14} />{saving?'ASSIGNING...': `ASSIGN TO ${selected.length || ''} EMPLOYEE${selected.length!==1?'S':''}`}
          </button>
          <button style={s.ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
