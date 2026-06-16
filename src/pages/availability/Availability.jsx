import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { atLeast } from '../../config/roles'
import Icon from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR     = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Availability() {
  const { profile } = useAuth()
  const toast = useToast()
  const canReview = atLeast(profile?.role, 'sergeant')

  const [myEmpId, setMyEmpId]       = useState(null)
  const [myAvail, setMyAvail]       = useState([])
  const [teamAvail, setTeamAvail]   = useState([])
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [newDate, setNewDate]       = useState('')
  const [newDateNote, setNewDateNote] = useState('')
  const [newDay, setNewDay]         = useState('')
  const [newDayNote, setNewDayNote] = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { if (profile?.company_id) load() }, [profile])

  async function load() {
    setLoading(true)
    const [{ data: empMe }, { data: myData }, { data: teamData }, { data: empAll }] = await Promise.all([
      supabase.from('employee').select('id').eq('user_id', profile.id).eq('company_id', profile.company_id).maybeSingle(),
      supabase.from('employee_availability').select('*').eq('company_id', profile.company_id).order('date', { ascending: true }),
      canReview ? supabase.from('employee_availability').select('*').eq('company_id', profile.company_id) : Promise.resolve({ data: [] }),
      canReview ? supabase.from('employee').select('id,first_name,last_name').eq('company_id', profile.company_id).eq('status', 'active').order('last_name') : Promise.resolve({ data: [] }),
    ])
    const me = empMe?.id || null
    setMyEmpId(me)
    setMyAvail((myData || []).filter(a => a.employee_id === me))
    setTeamAvail(teamData || [])
    setEmployees(empAll || [])
    setLoading(false)
  }

  async function addBlockedDate() {
    if (!newDate || !myEmpId) return
    setSaving(true)
    const { error } = await supabase.from('employee_availability').insert({
      company_id: profile.company_id,
      employee_id: myEmpId,
      availability_type: 'block_date',
      date: newDate,
      notes: newDateNote || null,
    })
    if (error) toast(error.message, 'error')
    else toast('Blocked date added')
    setNewDate(''); setNewDateNote('')
    setSaving(false)
    load()
  }

  async function addRecurringDay() {
    if (newDay === '' || !myEmpId) return
    const dow = parseInt(newDay, 10)
    // Check not already set
    if (myAvail.some(a => a.availability_type === 'recurring_day' && a.recurring_day_of_week === dow)) {
      toast('Already blocking that day of week', 'info'); return
    }
    setSaving(true)
    const { error } = await supabase.from('employee_availability').insert({
      company_id: profile.company_id,
      employee_id: myEmpId,
      availability_type: 'recurring_day',
      recurring_day_of_week: dow,
      notes: newDayNote || null,
    })
    if (error) toast(error.message, 'error')
    else toast('Recurring unavailability added')
    setNewDay(''); setNewDayNote('')
    setSaving(false)
    load()
  }

  async function deleteAvail(id) {
    await supabase.from('employee_availability').delete().eq('id', id)
    load()
  }

  function empName(id) { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : '—' }

  const myBlockedDates = myAvail.filter(a => a.availability_type === 'block_date').sort((a, b) => a.date > b.date ? 1 : -1)
  const myRecurring    = myAvail.filter(a => a.availability_type === 'recurring_day').sort((a, b) => a.recurring_day_of_week - b.recurring_day_of_week)

  const inpStyle = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', fontFamily:'var(--font-body)' }
  const lbl = { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'var(--font-condensed)', marginBottom:'5px' }
  const addBtn = { display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 16px', height:'38px', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', opacity:saving?0.6:1 }
  const delBtn = { background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', borderRadius:'var(--radius-sm)' }

  if (loading) return (
    <div style={{ padding: '24px' }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '8px', marginBottom: '10px' }} />)}
    </div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', animation: 'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1 }}>AVAILABILITY</h2>
        <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>Block specific dates or recurring days you are unavailable.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: canReview ? '1fr 1fr' : '1fr', gap:'24px' }}>
        {/* Left column: my availability */}
        <div>
          {/* Blocked Dates */}
          <div style={{ marginBottom:'24px' }}>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>My Blocked Dates</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {myBlockedDates.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'12px 0' }}>No blocked dates set.</div>
              ) : myBlockedDates.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'10px 14px' }}>
                  <Icon name="calendar" size={14} color="var(--color-danger)" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:600 }}>
                      {new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })}
                    </div>
                    {a.notes && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{a.notes}</div>}
                  </div>
                  <button style={delBtn} onClick={() => deleteAvail(a.id)} title="Remove"><Icon name="trash-2" size={14} /></button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 130px' }}>
                <div style={lbl}>Date</div>
                <input type="date" style={{...inpStyle, width:'100%', boxSizing:'border-box'}} value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div style={{ flex:'2 1 160px' }}>
                <div style={lbl}>Note (optional)</div>
                <input style={{...inpStyle, width:'100%', boxSizing:'border-box'}} value={newDateNote} onChange={e => setNewDateNote(e.target.value)} placeholder="e.g. Medical appointment" />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <button style={addBtn} onClick={addBlockedDate} disabled={!newDate || saving}>
                  <Icon name="plus" size={13} />ADD
                </button>
              </div>
            </div>
          </div>

          {/* Recurring Days */}
          <div>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>Recurring Unavailability</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {myRecurring.length === 0 ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'12px 0' }}>No recurring blocks set.</div>
              ) : myRecurring.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', padding:'10px 14px' }}>
                  <Icon name="refresh-cw" size={14} color="var(--color-warning)" />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:600 }}>
                      Every {DAYS_OF_WEEK[a.recurring_day_of_week] || '—'}
                    </div>
                    {a.notes && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{a.notes}</div>}
                  </div>
                  <button style={delBtn} onClick={() => deleteAvail(a.id)} title="Remove"><Icon name="trash-2" size={14} /></button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 140px' }}>
                <div style={lbl}>Day of Week</div>
                <select style={{...inpStyle, width:'100%', boxSizing:'border-box', cursor:'pointer'}} value={newDay} onChange={e => setNewDay(e.target.value)}>
                  <option value="">Select day...</option>
                  {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div style={{ flex:'2 1 160px' }}>
                <div style={lbl}>Note (optional)</div>
                <input style={{...inpStyle, width:'100%', boxSizing:'border-box'}} value={newDayNote} onChange={e => setNewDayNote(e.target.value)} placeholder="e.g. School pickup" />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <button style={addBtn} onClick={addRecurringDay} disabled={newDay === '' || saving}>
                  <Icon name="plus" size={13} />ADD
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: team grid (sergeant+) */}
        {canReview && (
          <div>
            <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>Team Recurring Unavailability</div>
            {employees.length === 0 ? (
              <div style={{ fontSize:'13px', color:'var(--text-muted)', padding:'12px 0' }}>No active employees.</div>
            ) : (
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border)' }}>
                      <th style={{ textAlign:'left', padding:'10px 14px', fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap' }}>Employee</th>
                      {DAY_ABBR.map(d => (
                        <th key={d} style={{ textAlign:'center', padding:'10px 6px', fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', textTransform:'uppercase', letterSpacing:'1px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, ei) => {
                      const empRecurring = teamAvail.filter(a => a.employee_id === emp.id && a.availability_type === 'recurring_day')
                      const blockedDows  = new Set(empRecurring.map(a => a.recurring_day_of_week))
                      return (
                        <tr key={emp.id} style={{ borderBottom: ei < employees.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding:'10px 14px', fontSize:'13px', color:'var(--text-primary)', fontWeight:600, whiteSpace:'nowrap' }}>{emp.first_name} {emp.last_name}</td>
                          {[0,1,2,3,4,5,6].map(dow => (
                            <td key={dow} style={{ textAlign:'center', padding:'10px 6px' }}>
                              {blockedDows.has(dow) ? (
                                <div title="Unavailable" style={{ width:'18px', height:'18px', borderRadius:'50%', background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.4)', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                                  <Icon name="x" size={10} color="var(--color-danger)" />
                                </div>
                              ) : (
                                <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:'var(--color-success-bg)', border:'1px solid rgba(58,170,106,0.3)', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                                  <Icon name="check" size={10} color="var(--color-success)" />
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Blocked dates summary */}
            <div style={{ marginTop:'20px' }}>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid var(--border)' }}>Team Blocked Dates (Next 30 Days)</div>
              {(() => {
                const today = new Date()
                const in30  = new Date(today); in30.setDate(today.getDate() + 30)
                const upcoming = teamAvail
                  .filter(a => a.availability_type === 'block_date' && a.date >= today.toISOString().split('T')[0] && a.date <= in30.toISOString().split('T')[0])
                  .sort((a, b) => a.date > b.date ? 1 : -1)
                if (upcoming.length === 0) return <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No upcoming blocked dates.</div>
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    {upcoming.map(a => (
                      <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', fontSize:'12px' }}>
                        <Icon name="calendar" size={13} color="var(--color-danger)" />
                        <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</span>
                        <span style={{ color:'var(--text-muted)' }}>{empName(a.employee_id)}</span>
                        {a.notes && <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>· {a.notes}</span>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
