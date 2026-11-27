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

const CARD_W = 340, CARD_H = 260

// Card placement next to a measured target rect, clamped to the viewport.
function getCardPosition(rect) {
  if (!rect) return { top:'50%', left:'50%', transform:'translate(-50%,-50%)' }
  const vw = window.innerWidth, vh = window.innerHeight
  const clampTop  = t => Math.max(16, Math.min(t, vh - CARD_H - 16))
  const clampLeft = l => Math.max(16, Math.min(l, vw - CARD_W - 16))

  if (rect.right + CARD_W + 24 < vw)
    return { top: clampTop(rect.top), left: rect.right + 16, transform:'none' }
  if (rect.left - CARD_W - 24 > 0)
    return { top: clampTop(rect.top), left: rect.left - CARD_W - 16, transform:'none' }
  if (rect.bottom + CARD_H + 24 < vh)
    return { top: rect.bottom + 16, left: clampLeft(rect.left), transform:'none' }
  return { top: clampTop(rect.top - CARD_H - 16), left: clampLeft(rect.left), transform:'none' }
}

// A target counts as present only if it is in the DOM and has a visible size
// (a collapsed sidebar or section renders nodes with zero width/height).
function measure(selector) {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return null
  return { top:r.top, left:r.left, width:r.width, height:r.height, right:r.right, bottom:r.bottom }
}

const sameRect = (a, b) => a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

function Spotlight({ rect }) {
  // Centered step (no target) — soft dim only
  if (!rect) return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 10000, pointerEvents: 'none',
    }}/>
  )

  const box = { top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }
  const dim = 'rgba(0,0,0,0.75)'
  const trans = { transition: 'all 300ms ease' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, pointerEvents:'none' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:box.top, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:box.top+box.height, left:0, right:0, bottom:0, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:box.top, left:0, width:box.left, height:box.height, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:box.top, left:box.left+box.width, right:0, height:box.height, background:dim, ...trans }}/>
      <div style={{ position:'absolute', top:box.top, left:box.left, width:box.width, height:box.height, border:'2px solid #c9a227', borderRadius:'8px', boxShadow:'0 0 0 4px rgba(201,162,39,0.2)', ...trans }}/>
    </div>
  )
}

// Mounted by AppLayout, so it only runs for signed-in users inside the app shell.
export function GuidedTour({ profile, onDone }) {
  const [steps, setSteps]         = useState(null)   // resolved once the layout is on screen
  const [step, setStep]           = useState(0)
  const [neverShow, setNeverShow] = useState(false)
  const [rect, setRect]           = useState(null)

  // Wait for the sidebar to be visible (AppLayout expands it for the tour), then
  // keep only steps whose target exists for this user's role. Missing targets
  // are skipped rather than shown centered.
  useEffect(() => {
    const all = getTourSteps(getRoleLevel(profile?.role), profile?.company)
    let tries = 0, timer
    const resolve = () => {
      if (!measure('[data-tour="sidebar"]') && tries++ < 30) { timer = setTimeout(resolve, 100); return }
      const list = all.filter(s => !s.target || measure(s.target))
      list.forEach((s, i) => { s.isFinal = i === list.length - 1 })
      setSteps(list)
    }
    timer = setTimeout(resolve, 300)   // let the sidebar expand transition (250ms) finish
    return () => clearTimeout(timer)
  }, [])

  const current = steps?.[step]

  // Scroll the target into view, then follow it every frame. The selector is
  // re-queried each time because the sidebar re-renders and replaces its nodes.
  useEffect(() => {
    setRect(null)
    if (!current?.target) return
    document.querySelector(current.target)?.scrollIntoView({ block:'nearest', behavior:'smooth' })
    let raf, found = false
    const started = Date.now()
    const tick = () => {
      const r = measure(current.target)
      if (r) { found = true; setRect(prev => sameRect(prev, r) ? prev : r) }
      // Target vanished since the steps were resolved: skip the step, never center it.
      else if (!found && Date.now() - started > 1500) {
        if (step < steps.length - 1) setStep(s => s + 1)
        else skip()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current?.target])

  const pos = getCardPosition(current?.target ? rect : null)

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

  if (!steps || !current) return null
  if (current.target && !rect) return <Spotlight rect={null} />

  return (
    <>
      <Spotlight rect={current.target ? rect : null} />

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
