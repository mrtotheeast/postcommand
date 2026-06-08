import { useState, useEffect, useCallback } from 'react'
import { getRoleLevel, ROLE_TITLES } from '../../config/roles'

export function getTourSteps(level, company) {
  const style = company?.role_style || 'military'
  const titles = ROLE_TITLES[style] || ROLE_TITLES.military
  const roleLabel = titles[level] || 'your role'

  const steps = []

  // 1. Welcome — all roles
  steps.push({ target: null, title: 'Welcome to PostCommand', position: 'center',
    body: `This quick tour shows the key features available to you as ${roleLabel}. It takes about 60 seconds.` })

  // 2. Sidebar — all roles
  steps.push({ target: '[data-tour="sidebar"]', title: 'Navigation', position: 'right',
    body: 'Use the sidebar to move between sections. Your available sections depend on your access level.' })

  // 3. Personnel — sergeant+ (level >= 3)
  if (level >= 3) steps.push({ target: '[data-tour="personnel"]', title: 'Personnel', position: 'right',
    body: 'View and manage employee profiles, credentials, training status, and contact information.' })

  // 4. Scheduling — all roles (officers view their own shifts)
  steps.push({ target: '[data-tour="scheduling"]', title: 'Scheduling', position: 'right',
    body: 'View your assigned shifts here. Supervisors can create shifts and publish schedules — officers are notified automatically.' })

  // 5. Timesheets — all roles (officers submit their own)
  steps.push({ target: '[data-tour="timesheets"]', title: 'Timesheets', position: 'right',
    body: 'Review and approve officer timesheets, close pay periods, and export payroll data.' })

  // 6. Incident Reports — all roles
  steps.push({ target: '[data-tour="incidents"]', title: 'Incident Reports', position: 'right',
    body: 'File and review incident reports. Use AI Guided mode for step-by-step help, or Write Directly for freeform entry.' })

  // 7. Settings — chief+ (level >= 5)
  if (level >= 5) steps.push({ target: '[data-tour="settings"]', title: 'Settings', position: 'right',
    body: 'Configure your company profile, role titles, supervisor assignments, and billing from Settings.' })

  // 8. Help — all roles (final)
  steps.push({ target: '[data-tour="help"]', title: 'Need Help?', position: 'right', isFinal: true,
    body: 'Tap Help at any time for FAQs and to replay this tour. Reach support at support@postcommand.app.' })

  return steps
}

function getCardPosition(targetEl) {
  if (!targetEl) return { top:'50%', left:'50%', transform:'translate(-50%,-50%)' }
  const r = targetEl.getBoundingClientRect()
  const cardW = 340, cardH = 260
  const vw = window.innerWidth, vh = window.innerHeight

  if (r.right + cardW + 24 < vw)
    return { top: Math.min(r.top, vh - cardH - 20), left: r.right + 16, transform:'none' }
  if (r.left - cardW - 24 > 0)
    return { top: Math.min(r.top, vh - cardH - 20), left: r.left - cardW - 16, transform:'none' }
  if (r.bottom + cardH + 24 < vh)
    return { top: r.bottom + 16, left: Math.max(16, r.left - cardW / 2), transform:'none' }
  return { top: Math.max(16, r.top - cardH - 16), left: Math.max(16, r.left - cardW / 2), transform:'none' }
}

function Spotlight({ targetEl }) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!targetEl) { setRect(null); return }

    // Small delay to let DOM settle after scroll
    const timer = setTimeout(() => {
      const r = targetEl.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) {
        setRect(null)
        return
      }
      setRect({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [targetEl])

  // No target or element not visible — soft dim only, no blackout
  if (!rect) return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 10000, pointerEvents: 'none',
    }}/>
  )

  const dim = 'rgba(0,0,0,0.75)'
  const trans = { transition: 'all 300ms ease' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, pointerEvents:'none' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:rect.top, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:rect.top+rect.height, left:0, right:0, bottom:0, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:rect.top, left:0, width:rect.left, height:rect.height, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:rect.top, left:rect.left+rect.width, right:0, height:rect.height, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:rect.top, left:rect.left, width:rect.width, height:rect.height, border:'2px solid #c9a227', borderRadius:'8px', boxShadow:'0 0 0 4px rgba(201,162,39,0.2)', ...trans }}/>
    </div>
  )
}

export function GuidedTour({ profile, onDone }) {
  const [step, setStep]           = useState(0)
  const [neverShow, setNeverShow] = useState(false)
  const [targetEl, setTargetEl]   = useState(null)
  const [pos, setPos]             = useState({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' })

  const level   = getRoleLevel(profile?.role)
  const steps   = getTourSteps(level, profile?.company)
  const current = steps[step]

  useEffect(() => {
    if (!current?.target) {
      setTargetEl(null)
      setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' })
      return
    }
    const el = document.querySelector(current.target)
    if (!el) {
      // Element not in DOM (user hasn't navigated there yet) — center card, soft dim
      setTargetEl(null)
      setPos({ top:'50%', left:'50%', transform:'translate(-50%,-50%)' })
      return
    }
    setTargetEl(el)
    setPos(getCardPosition(el))
    el.scrollIntoView({ behavior:'smooth', block:'center' })
  }, [step, current])

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

  const cardStyle = {
    position:'fixed', zIndex:10001, width:'340px', background:'var(--bg-card)',
    border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
    boxShadow:'0 8px 48px rgba(0,0,0,0.5)', padding:'24px', pointerEvents:'all',
    ...pos,
  }

  return (
    <>
      <Spotlight targetEl={targetEl} />

      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'17px', letterSpacing:'1.5px', color:'var(--accent)', lineHeight:1.2 }}>{current?.title}</div>
          <button onClick={skip} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', flexShrink:0, padding:'0 0 0 12px' }}>SKIP</button>
        </div>

        <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7, marginBottom:'20px' }}>{current?.body}</div>

        {current?.isFinal && (
          <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'var(--text-muted)', cursor:'pointer', marginBottom:'16px' }}>
            <input type="checkbox" checked={neverShow} onChange={e => setNeverShow(e.target.checked)} style={{ accentColor:'var(--accent)', width:'14px', height:'14px' }}/>
            Don't show this tour again
          </label>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'12px', fontWeight:700, cursor:'pointer', padding:'0 12px', height:'36px' }}>BACK</button>
          )}
          <div style={{ flex:1, display:'flex', gap:'5px', justifyContent:'center' }}>
            {steps.map((_,i) => (
              <div key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:i < step ? 'var(--color-success)' : i === step ? 'var(--accent)' : 'var(--border)', transition:'background 200ms ease', cursor:'pointer' }} onClick={() => setStep(i)}/>
            ))}
          </div>
          {current?.isFinal ? (
            <button onClick={finish} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', padding:'0 16px', height:'36px' }}>FINISH</button>
          ) : (
            <button onClick={() => setStep(s => Math.min(s + 1, steps.length - 1))} style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', padding:'0 16px', height:'36px' }}>
              NEXT →
            </button>
          )}
        </div>

        <div style={{ textAlign:'center', fontSize:'10px', color:'var(--text-muted)', marginTop:'10px', fontFamily:'var(--font-condensed)' }}>{step + 1} / {steps.length}</div>
      </div>
    </>
  )
}
