import { useState, useEffect, useCallback } from 'react'
import { getRoleLevel, ROLE_TITLES } from '../../config/roles'

export function getTourSteps(level, company) {
  const style = company?.role_style || 'military'
  const titles = ROLE_TITLES[style] || ROLE_TITLES.military
  const roleLabel = titles[level] || 'your role'

  const base = [
    { target:null, title:'Welcome to PostCommand', position:'center',
      body:`This quick tour shows the key features available to you as ${roleLabel}. It takes about 60 seconds.` },
    { target:'[data-tour="sidebar"]', title:'Navigation', position:'right',
      body:'Use the sidebar to move between sections. Your available sections depend on your access level.' },
  ]

  const officer = [
    { target:'[data-tour="clockin"]', title:'Clock In / Out', position:'right',
      body:'Tap Clock In at the start of your shift. GPS verifies you are at your assigned post. Tap Clock Out when your shift ends.' },
    { target:'[data-tour="incidents"]', title:'Incident Reports', position:'right',
      body:'File incident reports from your phone. Use AI Guided mode for step-by-step help, or Write Directly for freeform entry.' },
    { target:'[data-tour="sos"]', title:'SOS Alert', position:'right',
      body:'In an emergency, tap SOS. Your supervisors are immediately alerted with your GPS location. Hold for 3 seconds to trigger.' },
    { target:'[data-tour="scheduling"]', title:'Your Schedule', position:'right',
      body:'View your assigned shifts here. You receive a notification when new schedules are published.' },
  ]

  const corporal = [
    { target:'[data-tour="personnel"]', title:'Personnel', position:'right',
      body:'View employee profiles for staff assigned to your sites — credentials, training status, and contact information.' },
    { target:'[data-tour="incidents"]', title:'Incident Review', position:'right',
      body:'As a supervisor, you can review and approve incident reports filed by officers in your command.' },
  ]

  const lieutenant = [
    { target:'[data-tour="timesheets"]', title:'Timesheets', position:'right',
      body:'Review and approve officer timesheets, close pay periods, and export payroll data to ADP or Paychex.' },
    { target:'[data-tour="scheduling"]', title:'Schedule Management', position:'right',
      body:'Create shifts, assign officers to posts, and publish schedules. Officers are notified automatically.' },
    { target:'[data-tour="reports"]', title:'Reports', position:'right',
      body:'Access operational reports, performance analytics, and AI-generated summaries of your team activity.' },
  ]

  const admin = [
    { target:'[data-tour="personnel"]', title:'Personnel Management', position:'right',
      body:'Add employees, send app invites, manage credentials, and handle status changes. All changes are logged for compliance.' },
    { target:'[data-tour="settings"]', title:'Company Settings', position:'right',
      body:'Configure your company profile, role titles, supervisor assignments, and billing from Settings.' },
    { target:'[data-tour="billing"]', title:'Billing', position:'right',
      body:'Manage your PostCommand subscription, view usage stats, and upgrade your plan here.' },
  ]

  const superAdmin = [
    { target:'[data-tour="superadmin"]', title:'Super Admin Panel', position:'right',
      body:'Access platform-wide statistics, all companies, and system health from the Super Admin panel.' },
  ]

  const final = { target:'[data-tour="help"]', title:'Need Help?', position:'right', isFinal:true,
    body:'Tap Help at any time for FAQs and to replay this tour. Reach support at support@postcommand.app.' }

  let steps = [...base, ...officer]
  if (level >= 2) steps = [...steps, ...corporal]
  if (level >= 4) steps = [...steps, ...lieutenant]
  if (level >= 5) steps = [...steps, ...admin]
  if (level >= 6) steps = [...steps, ...superAdmin]
  steps.push(final)
  return steps
}

export function GuidedTour({ profile, onDone }) {
  const [step, setStep]       = useState(0)
  const [neverShow, setNeverShow] = useState(false)
  const level = getRoleLevel(profile?.role)
  const steps = getTourSteps(level, profile?.company)
  const current = steps[step]

  function finish() {
    localStorage.setItem(`pc-tour-seen-${profile.id}`, '1')
    if (neverShow) localStorage.setItem(`pc-tour-never-${profile.id}`, '1')
    onDone()
  }

  function skip() {
    localStorage.setItem(`pc-tour-seen-${profile.id}`, '1')
    onDone()
  }

  const handleKey = useCallback((e) => { if (e.key === 'Escape') skip() }, [])
  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey) }, [handleKey])

  // Find target element position
  const [pos, setPos] = useState({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' })
  useEffect(() => {
    if (!current?.target) {
      setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' })
      return
    }
    const el = document.querySelector(current.target)
    if (!el) { setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' }); return }
    const r = el.getBoundingClientRect()
    const cardW = 340, cardH = 200
    let top = r.top + r.height / 2 - cardH / 2
    let left = current.position === 'right' ? r.right + 16 : r.left - cardW - 16
    // Clamp to viewport
    top  = Math.max(16, Math.min(top,  window.innerHeight - cardH - 16))
    left = Math.max(16, Math.min(left, window.innerWidth  - cardW - 16))
    setPos({ top, left, transform:'none' })
  }, [step, current])

  const cardStyle = {
    position:'fixed', zIndex:10001, width:'340px', background:'var(--bg-card)',
    border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
    boxShadow:'0 8px 48px rgba(0,0,0,0.5)', padding:'24px',
    ...pos,
  }

  return (
    <>
      {/* Dim overlay — pointer-events none so SKIP button works */}
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:10000, pointerEvents:'none' }}/>

      {/* Tour card — on top of overlay */}
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'17px', letterSpacing:'1.5px', color:'var(--accent)', lineHeight:1.2 }}>{current?.title}</div>
          <button onClick={skip} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', flexShrink:0, padding:'0 0 0 12px' }}>SKIP</button>
        </div>

        {/* Body */}
        <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7, marginBottom:'20px' }}>{current?.body}</div>

        {/* Don't show again — final step */}
        {current?.isFinal && (
          <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'var(--text-muted)', cursor:'pointer', marginBottom:'16px' }}>
            <input type="checkbox" checked={neverShow} onChange={e=>setNeverShow(e.target.checked)} style={{ accentColor:'var(--accent)', width:'15px', height:'15px' }}/>
            Don't show this tour again
          </label>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', padding:'0 12px', height:'36px' }}>BACK</button>
          )}
          <div style={{ flex:1, display:'flex', gap:'5px', justifyContent:'center' }}>
            {steps.map((_,i) => (
              <div key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:i < step ? 'var(--color-success)' : i === step ? 'var(--accent)' : 'var(--border)', transition:'background 200ms ease', cursor:'pointer' }} onClick={()=>setStep(i)}/>
            ))}
          </div>
          {current?.isFinal ? (
            <button onClick={finish} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', padding:'0 16px', height:'36px' }}>FINISH</button>
          ) : (
            <button onClick={()=>setStep(s=>Math.min(s+1, steps.length-1))} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', padding:'0 16px', height:'36px' }}>
              NEXT →
            </button>
          )}
        </div>

        {/* Step counter */}
        <div style={{ textAlign:'center', fontSize:'10px', color:'var(--text-muted)', marginTop:'10px', fontFamily:'var(--font-condensed)' }}>{step + 1} / {steps.length}</div>
      </div>
    </>
  )
}
