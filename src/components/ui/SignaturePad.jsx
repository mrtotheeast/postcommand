import { useRef, useState, useEffect } from 'react'
import Icon from './Icon'

export default function SignaturePad({ onSign, onClear, readOnly = false, existingUrl = null }) {
  const canvasRef  = useRef(null)
  const [drawing, setDrawing]   = useState(false)
  const [hasLines, setHasLines] = useState(false)
  const [mode, setMode]         = useState(existingUrl ? 'view' : 'draw') // draw | type | view
  const [typed, setTyped]       = useState('')
  const lastPos = useRef(null)

  useEffect(() => {
    if (existingUrl) { setMode('view'); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [mode])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
  }

  function startDraw(e) {
    if (readOnly) return
    e.preventDefault()
    const canvas = canvasRef.current
    const pos = getPos(e, canvas)
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    lastPos.current = pos
    setDrawing(true)
  }

  function draw(e) {
    if (!drawing || readOnly) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasLines(true)
  }

  function stopDraw() { setDrawing(false) }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasLines(false)
    setTyped('')
    onClear?.()
  }

  function saveDrawn() {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    onSign?.(dataUrl, 'drawn')
  }

  function saveTyped() {
    if (!typed.trim()) return
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 100
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#1a1a2e'
    ctx.font = 'italic 36px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(typed, 200, 50)
    const dataUrl = canvas.toDataURL('image/png')
    onSign?.(dataUrl, 'typed')
  }

  const btnS = (active=false) => ({ padding:'6px 14px', border:`1px solid ${active?'var(--accent-border)':'var(--border)'}`, background:active?'var(--accent-bg)':'transparent', color:active?'var(--accent)':'var(--text-secondary)', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-condensed)', fontSize:'12px', letterSpacing:'0.5px', cursor:'pointer' })

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius-md)', overflow:'hidden', background:'var(--bg-card)' }}>
      {/* Mode toggle */}
      {!readOnly && mode !== 'view' && (
        <div style={{ display:'flex', gap:'4px', padding:'10px 12px', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>
          <button style={btnS(mode==='draw')} onClick={() => setMode('draw')}>Draw</button>
          <button style={btnS(mode==='type')} onClick={() => setMode('type')}>Type</button>
          <div style={{ flex:1 }} />
          {(hasLines || typed) && <button style={{ ...btnS(), color:'var(--color-danger)' }} onClick={clear}><Icon name="trash-2" size={12}/> Clear</button>}
        </div>
      )}

      {mode === 'view' && existingUrl ? (
        <div style={{ padding:'12px', textAlign:'center' }}>
          <img src={existingUrl} alt="Signature" style={{ maxHeight:'80px', maxWidth:'100%', border:'none' }}/>
          <div style={{ fontSize:'11px', color:'var(--color-success)', marginTop:'6px', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
            <Icon name="check-circle" size={12}/>Signed
          </div>
        </div>
      ) : mode === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={400} height={120}
            style={{ width:'100%', height:'120px', cursor: readOnly ? 'default' : 'crosshair', display:'block', touchAction:'none' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
          {!hasLines && !readOnly && (
            <div style={{ position:'relative', pointerEvents:'none' }}>
              <div style={{ position:'absolute', top:'-60px', left:0, right:0, textAlign:'center', fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic' }}>
                Sign above
              </div>
            </div>
          )}
          {!readOnly && hasLines && (
            <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
              <button style={{ ...btnS(true), background:'var(--accent)', color:'var(--text-inverse)', border:'none' }} onClick={saveDrawn}>
                <Icon name="check" size={12}/> Accept Signature
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding:'12px' }}>
          <input
            style={{ width:'100%', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 12px', fontSize:'22px', fontFamily:'Georgia, serif', fontStyle:'italic', color:'var(--text-primary)', outline:'none' }}
            placeholder="Type your full name"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onFocus={e => e.target.style.borderColor='var(--border-focus)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}
          />
          {typed.trim() && (
            <div style={{ marginTop:'8px', display:'flex', justifyContent:'flex-end' }}>
              <button style={{ ...btnS(true), background:'var(--accent)', color:'var(--text-inverse)', border:'none' }} onClick={saveTyped}>
                <Icon name="check" size={12}/> Accept Signature
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
