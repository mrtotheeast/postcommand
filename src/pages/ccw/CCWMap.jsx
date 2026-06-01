/*
 * EMBED ON NATIONWIDEPOLICE.COM:
 *
 * <iframe
 *   src="https://postcommand.app/reciprocity"
 *   width="100%"
 *   height="750"
 *   style="border:none;border-radius:12px;"
 *   title="CCW Reciprocity Map — All 50 States"
 *   loading="lazy"
 *   allowfullscreen>
 * </iframe>
 *
 * Public route — no login required. No useAuth() calls.
 */

import { useState, useMemo, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { CCW_STATES, CCW_MAP, PERMIT_TYPES, DATA_META, getStateColor } from './ccwData'
import { supabase } from '../../lib/supabase'

const GEO_URL = '/us-states.json'

// Fix 3 — distinct, high-contrast permit type colors
const TYPE_COLORS = {
  constitutional: '#2e7d32',  // dark green
  shall_issue:    '#1565c0',  // dark blue
  may_issue:      '#e65100',  // dark orange
  no_issue:       '#b71c1c',  // dark red
}
const TYPE_BG = {
  constitutional: 'rgba(46,125,50,0.12)',
  shall_issue:    'rgba(21,101,192,0.12)',
  may_issue:      'rgba(230,81,0,0.12)',
  no_issue:       'rgba(183,28,28,0.12)',
}
function localColor(permitType) { return TYPE_COLORS[permitType] || '#c8d8e8' }
function localBg(permitType)    { return TYPE_BG[permitType]    || 'rgba(200,216,232,0.2)' }

const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
}


const C = {
  bg:'#ffffff', border:'#e2e6ea', text:'#0d0f14',
  textSecond:'#4a6080', textMuted:'#8899aa',
  gold:'#c8a84b', goldBg:'rgba(200,168,75,0.1)',
  mapBg:'#f8f9fa',
}

export default function CCWMap() {
  const [hasSession, setHasSession] = useState(false)
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data:{ session } }) => setHasSession(!!session))
      .catch(() => setHasSession(false))
  }, [])

  const [homeState,    setHomeState]    = useState('')
  const [filterType,   setFilterType]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [multiMode,    setMultiMode]    = useState(false)
  const [selected,     setSelected]     = useState([])   // array of codes
  const [modal,        setModal]        = useState(null) // state object
  const [hovering,     setHovering]     = useState(null)
  const [zoom,         setZoom]         = useState(1)
  const [geoError,     setGeoError]     = useState(false)

  const homeData = homeState ? CCW_MAP[homeState] : null

  // States that honor the home state's permit
  const homeSupporters = useMemo(() =>
    homeData ? new Set(homeData.honoredBy || []) : new Set()
  , [homeData])

  // States the home state honors
  const homeHonors = useMemo(() =>
    homeData ? new Set(homeData.honors || []) : new Set()
  , [homeData])

  const filteredList = useMemo(() => CCW_STATES.filter(s => {
    if (filterType !== 'all' && s.permitType !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false
    }
    return true
  }), [filterType, search])

  function handleStateClick(code) {
    const state = CCW_MAP[code]
    if (!state) return
    if (multiMode) {
      setSelected(prev => prev.includes(code) ? prev.filter(c=>c!==code) : prev.length<8?[...prev,code]:prev)
      return
    }
    setModal(state)
  }

  function selectByCode(code) {
    const st = CCW_MAP[code]
    if (st) setModal(st)
  }

  function printPDF() {
    const stateRows = CCW_STATES.map(s => {
      const pt = PERMIT_TYPES[s.permitType]
      return `<tr>
        <td>${s.name}</td>
        <td style="color:${pt?.color||'#666'};font-weight:600">${pt?.short||'—'}</td>
        <td>${s.constitutional?'✓ YES':'No'}</td>
        <td>${s.fee===0?'Free':'$'+s.fee}</td>
        <td>${s.trainingRequired==='None required'||s.trainingRequired==='None'?'None':s.trainingRequired}</td>
        <td>${s.honoredBy?.length??0}</td>
        <td>${s.honors?.length??0}</td>
      </tr>`
    }).join('')
    const w = window.open('','_blank','width=1000,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>CCW Reciprocity Reference — PostCommand</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Helvetica,Arial,sans-serif;font-size:11px;padding:32px;color:#0d0f14}
h1{font-size:24px;font-weight:900;letter-spacing:3px;color:#c8a84b;margin-bottom:2px}
h1 span{color:#0d0f14}
.sub{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.meta{font-size:10px;color:#888;margin-bottom:20px}
.legend{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:6px;font-size:10px}
.legend-dot{width:12px;height:12px;border-radius:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10px}
th{text-align:left;padding:6px 8px;background:#f8f9fa;border-bottom:2px solid #e2e6ea;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#666}
td{padding:5px 8px;border-bottom:1px solid #f0f2f5}
tr:nth-child(even){background:#fafafa}
.disclaimer{background:#fff8e1;border:1px solid #ffc107;border-radius:6px;padding:14px 18px;margin-top:16px}
.disclaimer h4{color:#e65100;font-size:11px;margin-bottom:6px}
.disclaimer p{font-size:10px;color:#5d4037;line-height:1.6}
.footer{margin-top:20px;font-size:9px;color:#999;border-top:1px solid #eee;padding-top:12px;line-height:1.8}
@media print{body{padding:16px}}
</style></head><body>
<h1>POST<span>COMMAND</span></h1>
<div class="sub">CCW Reciprocity Map — All 50 States + DC</div>
<div class="meta">Data last verified: ${DATA_META.lastUpdated} | Next scheduled AI update: ${DATA_META.nextUpdate}</div>
<div class="legend">
${Object.entries(PERMIT_TYPES).map(([,pt])=>`<div class="legend-item"><div class="legend-dot" style="background:${pt.mapColor}"></div>${pt.label} (${CCW_STATES.filter(s=>PERMIT_TYPES[s.permitType]===pt).length} states)</div>`).join('')}
</div>
<table>
<thead><tr><th>State</th><th>Carry Type</th><th>Constitutional</th><th>Permit Fee</th><th>Training</th><th>Honored By</th><th>Honors</th></tr></thead>
<tbody>${stateRows}</tbody>
</table>
<div class="disclaimer">
<h4>⚠ DISCLAIMER</h4>
<p>This map is updated monthly using AI-assisted research. Information may not reflect the most current laws. <strong>Always verify with local state authorities and consult a licensed attorney before traveling with a firearm.</strong> Do not rely solely on this map for legal compliance. Laws change frequently. Nationwide Police Services LLC is not responsible for accuracy. Last updated: ${DATA_META.lastUpdated}</p>
</div>
<div class="footer">
© 2026 Nationwide Police Services LLC. All rights reserved.<br/>
CCW laws are subject to change without notice. Data compiled from public state statutes and AI-assisted research.<br/>
Always verify current laws before carrying. This is not legal advice. Consult a licensed attorney.
</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const FONT = "'Barlow Condensed', 'Barlow', Helvetica, sans-serif"

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&family=Bebas+Neue&display=swap" rel="stylesheet" />
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#fff}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#dce3ea;border-radius:4px}
        .ccw-hover:hover{background:#f8f9fa!important}
        .chip-btn:hover{opacity:0.75!important;transform:scale(0.97)}
        .zoom-btn:hover{background:#f0f4f8!important}
        .label-btn:hover{opacity:0.8!important}
        .print-btn:hover{background:#f0f4f8!important}
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, fontFamily:FONT, color:C.text }}>

        {/* Header */}
        <header style={{ background:C.bg, borderBottom:`1px solid ${C.border}`, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', flexShrink:0 }}>
          <div>
            <div style={{ display:'flex', alignItems:'baseline', gap:'10px' }}>
              <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'26px', letterSpacing:'2px', color:C.gold, fontWeight:700 }}>NPS</span>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontSize:'15px', fontWeight:600, color:C.text, letterSpacing:'0.5px' }}>Nationwide Police Services</span>
              <span style={{ fontSize:'13px', color:C.textMuted, letterSpacing:'0.5px' }}>· CCW Reciprocity Map</span>
            </div>
            <div style={{ fontSize:'11px', color:C.textMuted, marginTop:'2px' }}>
              Concealed Carry Weapon laws & state-to-state reciprocity reference
              <span style={{ marginLeft:'12px', color:'#aaa' }}>
                Verified: {DATA_META.lastUpdated} · Next update: {DATA_META.nextUpdate}
              </span>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <button
              className="print-btn"
              onClick={() => { setMultiMode(m=>!m); if(!multiMode) setSelected([]) }}
              style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:multiMode?C.gold:C.bg, color:multiMode?'#fff':C.textSecond, border:`1px solid ${multiMode?C.gold:C.border}`, borderRadius:'6px', padding:'0 12px', height:'34px', fontSize:'11px', fontFamily:FONT, letterSpacing:'1px', cursor:'pointer', fontWeight:600 }}>
              {multiMode ? `✓ MULTI (${selected.length})` : 'SELECT MULTIPLE'}
            </button>
            <button
              className="print-btn"
              onClick={printPDF}
              style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:C.bg, color:C.textSecond, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'0 12px', height:'34px', fontSize:'11px', fontFamily:FONT, letterSpacing:'1px', cursor:'pointer' }}>
              🖨 Print / Save PDF
            </button>
          </div>
        </header>

        {/* Map controls bar */}
        <div style={{ background:'#f8f9fa', borderBottom:`1px solid ${C.border}`, padding:'8px 16px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
          <select
            value={homeState} onChange={e=>setHomeState(e.target.value)}
            style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 10px', fontSize:'12px', color:C.text, outline:'none', cursor:'pointer', fontFamily:FONT, fontWeight:600 }}
          >
            <option value="">Select Your Home State</option>
            {CCW_STATES.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          <select
            value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 10px', fontSize:'12px', color:C.text, outline:'none', cursor:'pointer', fontFamily:FONT }}
          >
            <option value="all">All Permit Types</option>
            {Object.entries(PERMIT_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <input
            style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'6px 10px', fontSize:'12px', color:C.text, outline:'none', fontFamily:FONT, width:'160px', transition:'border-color 150ms ease' }}
            placeholder="Search state..."
            value={search} onChange={e=>setSearch(e.target.value)}
            onFocus={e=>e.target.style.borderColor=C.gold}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
          {/* Legend */}
          <div style={{ marginLeft:'auto', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
            {homeState && <span style={{ fontSize:'11px', fontWeight:700, color:C.gold, background:C.goldBg, padding:'2px 8px', borderRadius:'10px', border:`1px solid rgba(200,168,75,0.3)` }}>📍 {homeState} selected</span>}
            {Object.entries(PERMIT_TYPES).map(([k,v])=>(
              <button key={k} onClick={()=>setFilterType(filterType===k?'all':k)}
                style={{ display:'flex', alignItems:'center', gap:'5px', background:'transparent', border:'none', cursor:'pointer', fontSize:'10px', color:C.text, padding:'2px 4px', opacity:filterType!=='all'&&filterType!==k?0.3:1, transition:'opacity 150ms ease' }}>
                <div style={{ width:'12px', height:'12px', borderRadius:'2px', background:localColor(k), flexShrink:0 }}/>
                {v.short} — {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

          {/* Map (70%) */}
          <div style={{ flex:'0 0 70%', position:'relative', background:C.mapBg, overflow:'hidden' }}>

            {/* Tooltip */}
            {hovering && !modal && (
              <div style={{ position:'absolute', top:'14px', left:'50%', transform:'translateX(-50%)', zIndex:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'7px', padding:'6px 14px', pointerEvents:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', fontSize:'13px', fontWeight:600, whiteSpace:'nowrap' }}>
                <span style={{ color:localColor(hovering.permitType) }}>{hovering.name}</span>
                <span style={{ color:C.textMuted, fontWeight:400, marginLeft:'8px', fontSize:'11px' }}>{PERMIT_TYPES[hovering.permitType]?.label}</span>
                {homeState && homeSupporters.has(hovering.code) && <span style={{ color:'#2e7d32', marginLeft:'8px', fontSize:'10px' }}>✓ Honors {homeState}</span>}
              </div>
            )}

            {/* Map */}
            <div style={{ width:'100%', height:'100%', transform:`scale(${zoom})`, transformOrigin:'center center', transition:'transform 200ms ease' }}>
              <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale:880, center:[-96,38] }} style={{ width:'100%', height:'100%', display:'block' }}>
                <Geographies geography={GEO_URL} onError={()=>setGeoError(true)}>
                  {({ geographies }) => {
                    if (!geographies?.length) return null
                    return geographies.map(geo => {
                      const fips  = geo.id?.toString().padStart(2,'0')
                      const code  = FIPS[fips]
                      const state = code ? CCW_MAP[code] : null
                      if (!state) return null

                      const typeColor   = localColor(state.permitType)
                      const isHome      = code === homeState
                      const isSupporter = homeState && homeSupporters.has(code)
                      const isHonored   = homeState && homeHonors.has(code)
                      const isFiltered  = filterType !== 'all' && state.permitType !== filterType
                      const isSelected  = selected.includes(code)
                      const isModal     = modal?.code === code

                      let fill        = typeColor
                      let fillOp      = 0.88
                      let stroke      = '#ffffff'
                      let strokeWidth = 0.5

                      if (isFiltered) { fill = '#c8d8e8'; fillOp = 1 }
                      else if (isHome) { fill = typeColor; fillOp = 1; stroke = C.gold; strokeWidth = 3 }
                      else if (isSelected || isModal) { fill = typeColor; fillOp = 1; stroke = C.gold; strokeWidth = 2 }
                      else if (homeState && isSupporter) { fill = '#388e3c'; fillOp = 0.9 }
                      else if (homeState && isHonored)   { fill = '#1976d2'; fillOp = 0.9 }
                      else if (homeState && !isSupporter && !isHonored) { fill = '#c8d8e8'; fillOp = 1 }

                      return (
                        <Geography key={geo.rsmKey} geography={geo}
                          onMouseEnter={() => setHovering(state)}
                          onMouseLeave={() => setHovering(null)}
                          onClick={() => handleStateClick(code)}
                          style={{
                            default: { fill, fillOpacity:fillOp, stroke, strokeWidth, outline:'none', cursor:'pointer' },
                            hover:   { fill:typeColor, fillOpacity:1, stroke:C.gold, strokeWidth:1.5, outline:'none', cursor:'pointer' },
                            pressed: { fill:typeColor, fillOpacity:1, outline:'none' },
                          }}
                        />
                      )
                    })
                  }}
                </Geographies>
              </ComposableMap>
            </div>

            {/* Error state */}
            {geoError && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:C.mapBg, flexDirection:'column', gap:'10px' }}>
                <div style={{ fontSize:'13px', color:C.textMuted }}>Map tiles unavailable</div>
                <button onClick={()=>setGeoError(false)} style={{ fontSize:'12px', color:C.gold, background:'none', border:`1px solid ${C.gold}`, borderRadius:'6px', padding:'6px 14px', cursor:'pointer', fontFamily:FONT }}>Retry</button>
              </div>
            )}

            {/* Zoom controls */}
            <div style={{ position:'absolute', bottom:'14px', right:'14px', zIndex:10, display:'flex', flexDirection:'column', gap:'4px' }}>
              {[['+',()=>setZoom(z=>Math.min(z*1.4,6))],['-',()=>setZoom(z=>Math.max(z/1.4,1))],['⊙',()=>setZoom(1)]].map(([lbl,fn])=>(
                <button key={lbl} className="zoom-btn" onClick={fn} style={{ width:'32px', height:'32px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'5px', color:C.text, fontSize:lbl==='⊙'?'14px':'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>{lbl}</button>
              ))}
            </div>

            {/* Home state carry legend */}
            {homeState && (
              <div style={{ position:'absolute', bottom:'14px', left:'14px', zIndex:10, background:'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:'7px', padding:'8px 12px', fontSize:'11px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ fontWeight:700, color:C.text, marginBottom:'5px', fontFamily:FONT, letterSpacing:'0.5px' }}>From {homeState}:</div>
                {[['#4caf50','Carry Allowed'],['#81c784','Constitutional Carry States'],['#ff9800','Restricted / Conditions'],['#f44336','Not Honored'],['#e2e6ea','No Reciprocity']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
                    <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:c, flexShrink:0 }}/>
                    <span style={{ color:C.textSecond }}>{l}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* State list panel (30%) */}
          <div style={{ flex:'0 0 30%', borderLeft:`1px solid ${C.border}`, background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:C.text, fontFamily:FONT, letterSpacing:'0.5px' }}>
                {filteredList.length} State{filteredList.length!==1?'s':''} {filterType!=='all'?`· ${PERMIT_TYPES[filterType]?.short}`:''}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {filteredList.map(state => {
                const pt          = PERMIT_TYPES[state.permitType]
                const isSupporter = homeState && homeSupporters.has(state.code)
                const isHonored   = homeState && homeHonors.has(state.code)
                return (
                  <div key={state.code} className="ccw-hover"
                    style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 14px', borderBottom:`1px solid #f5f5f5`, cursor:'pointer', background:'transparent' }}
                    onClick={() => handleStateClick(state.code)}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'5px', background:localBg(state.permitType), color:localColor(state.permitType), display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FONT, fontSize:'11px', fontWeight:700, flexShrink:0 }}>{state.code}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:600, color:C.text }}>{state.name}</div>
                      <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'1px' }}>{pt?.label} · {state.constitutional?'Permitless':state.permitName?.slice(0,28)}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {homeState && isSupporter && <div style={{ fontSize:'10px', color:'#2e7d32', fontWeight:700 }}>✓ Honors {homeState}</div>}
                      {homeState && isHonored   && <div style={{ fontSize:'10px', color:'#1565c0', fontWeight:700 }}>{homeState} Honors</div>}
                      <div style={{ fontSize:'11px', color:C.gold, fontFamily:FONT, fontWeight:600 }}>{state.honoredBy?.length??0} honor</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ background:'#f8f9fa', borderTop:`1px solid ${C.border}`, padding:'8px 20px', fontSize:'10px', color:C.textMuted, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'6px', flexShrink:0 }}>
          <span>© 2026 Nationwide Police Services LLC. All rights reserved. CCW laws subject to change without notice.</span>
          <span>Data from public state statutes · AI-assisted research · Not legal advice · Always verify before carrying</span>
        </footer>
      </div>

      {/* State detail modal */}
      {modal && <StateModal state={modal} onClose={()=>setModal(null)} onSelect={selectByCode} homeState={homeState} />}
    </>
  )
}

// ── State detail modal ────────────────────────────────────────────────────────

function StateModal({ state, onClose, onSelect, homeState }) {
  const pt            = PERMIT_TYPES[state.permitType]
  const honorsStates  = CCW_STATES.filter(s => state.honors.includes(s.code))
  const honoredBy     = CCW_STATES.filter(s => s.honors.includes(state.code))
  const FONT          = "'Barlow Condensed', 'Barlow', Helvetica, sans-serif"
  const C2            = { text:'#0d0f14', muted:'#8899aa', second:'#4a6080', border:'#e2e6ea', bg:'#ffffff' }
  const loc           = state.carryLocations || {}

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 16px', overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:C2.bg, border:`1px solid ${C2.border}`, borderRadius:'12px', width:'100%', maxWidth:'620px', boxShadow:'0 12px 48px rgba(0,0,0,0.15)', flexShrink:0 }} onClick={e=>e.stopPropagation()}>

        {/* Modal header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${C2.border}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'sticky', top:0, background:C2.bg, borderRadius:'12px 12px 0 0', zIndex:1 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:'28px', letterSpacing:'2px', color:C2.text }}>{state.name}</span>
              <span style={{ fontFamily:FONT, fontSize:'16px', color:C2.muted }}>({state.code})</span>
            </div>
            <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
              <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, fontFamily:FONT, letterSpacing:'0.5px', background:pt?.bg, color:pt?.color }}>{pt?.label}</span>
              {state.constitutional && <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, fontFamily:FONT, letterSpacing:'0.5px', background:'rgba(46,125,50,0.12)', color:'#2e7d32' }}>✓ Permitless Carry</span>}
              {state.redFlagLaw && <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, fontFamily:FONT, letterSpacing:'0.5px', background:'rgba(183,28,28,0.1)', color:'#b71c1c' }}>Red Flag Law</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'20px', color:C2.muted, padding:'4px', lineHeight:1, display:'flex', minHeight:'auto' }}>×</button>
        </div>

        <div style={{ padding:'16px 22px', maxHeight:'70vh', overflowY:'auto' }}>

          {/* Key stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Honored By', value:`${state.honoredBy?.length??0} states` },
              { label:'Min Carry Age', value:`${state.minAge} years` },
              { label:'This State Honors', value:`${state.honors?.length??0} states` },
              { label:'Permit Required', value:state.permitRequired?'Yes':'No' },
              { label:'Constitutional Carry', value:state.constitutional?'Yes':'No' },
              { label:'Open Carry', value:state.openCarry===true?'Yes':state.openCarry===false?'No':state.openCarry||'Varies' },
            ].map(item => (
              <div key={item.label} style={{ background:'#f8f9fa', borderRadius:'6px', padding:'10px 12px' }}>
                <div style={{ fontSize:'9px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1px', fontFamily:FONT, marginBottom:'3px' }}>{item.label}</div>
                <div style={{ fontSize:'14px', fontWeight:700, color:C2.text, fontFamily:FONT }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Permit details */}
          <div style={{ fontSize:'10px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:FONT, marginBottom:'8px', borderBottom:`1px solid ${C2.border}`, paddingBottom:'5px' }}>Permit Details</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
            {[
              { label:'Permit Type',        value:state.permitName },
              { label:'Processing Time',    value:state.processingTime },
              { label:'Permit Fee',         value:state.fee===0?'Free':`$${state.fee}` },
              { label:'Training Required',  value:state.trainingRequired },
              { label:'Red Flag Law',       value:state.redFlagLaw?'Yes':'No' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize:'9px', color:C2.muted, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:FONT, marginBottom:'1px' }}>{item.label}</div>
                <div style={{ fontSize:'12px', color:C2.text }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Gun law summary */}
          {state.gunLawSummary && (
            <>
              <div style={{ fontSize:'10px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:FONT, marginBottom:'6px', borderBottom:`1px solid ${C2.border}`, paddingBottom:'5px' }}>Summary of Gun Laws</div>
              <p style={{ fontSize:'12px', color:C2.second, lineHeight:1.7, marginBottom:'14px' }}>{state.gunLawSummary}</p>
            </>
          )}

          {/* Self defense */}
          {state.selfDefenseLaws && (
            <div style={{ background:'#f0f9f0', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'14px' }}>
              <div style={{ fontSize:'9px', color:'#2e7d32', textTransform:'uppercase', letterSpacing:'1px', fontFamily:FONT, marginBottom:'4px' }}>Self Defense Laws</div>
              <div style={{ fontSize:'12px', color:'#1b5e20' }}>{state.selfDefenseLaws}</div>
            </div>
          )}

          {/* Carry locations */}
          {Object.keys(loc).length > 0 && (
            <>
              <div style={{ fontSize:'10px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:FONT, marginBottom:'8px', borderBottom:`1px solid ${C2.border}`, paddingBottom:'5px' }}>Carry Locations</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', marginBottom:'14px', fontSize:'11px' }}>
                {[
                  ['vehicle',        'In Vehicle'],
                  ['barsRestaurants','Bars / Restaurants'],
                  ['stateParks',     'State Parks'],
                  ['nationalParks',  'National Parks'],
                  ['roadside',       'Roadside Rest Areas'],
                  ['hotels',         'Hotels'],
                  ['worship',        'Places of Worship'],
                  ['bowHunting',     'Bow Hunting'],
                  ['gunHunting',     'Gun Hunting'],
                ].map(([key, label]) => {
                  const val = loc[key]
                  const color = val===true?'#2e7d32':val===false?'#b71c1c':'#e65100'
                  const text  = val===true?'✓ Allowed':val===false?'✗ Prohibited':val||'Check Local Laws'
                  return (
                    <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', background:'#f8f9fa', borderRadius:'4px' }}>
                      <span style={{ color:C2.second }}>{label}</span>
                      <span style={{ color, fontWeight:600, fontFamily:FONT }}>{text}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Honored by chips */}
          <div style={{ fontSize:'10px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:FONT, marginBottom:'8px', borderBottom:`1px solid ${C2.border}`, paddingBottom:'5px' }}>
            States That Honor This Permit ({honoredBy.length})
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'14px' }}>
            {honoredBy.length === 0
              ? <span style={{ fontSize:'12px', color:C2.muted }}>No states honor this permit for reciprocity</span>
              : honoredBy.map(s2 => {
                  const pt2 = PERMIT_TYPES[s2.permitType]
                  return (
                    <button key={s2.code} className="chip-btn"
                      onClick={()=>{ onClose(); setTimeout(()=>onSelect(s2.code), 80) }}
                      style={{ display:'inline-flex', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontFamily:FONT, fontWeight:700, background:pt2?.bg, color:pt2?.color, border:'none', cursor:'pointer', transition:'all 150ms ease' }}>
                      {s2.code}
                    </button>
                  )
                })
            }
          </div>

          {/* Honors chips */}
          <div style={{ fontSize:'10px', color:C2.muted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:FONT, marginBottom:'8px', borderBottom:`1px solid ${C2.border}`, paddingBottom:'5px' }}>
            States This Permit Honors ({honorsStates.length})
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'14px' }}>
            {honorsStates.length === 0
              ? <span style={{ fontSize:'12px', color:C2.muted }}>Does not honor any out-of-state permits</span>
              : honorsStates.map(s2 => {
                  const pt2 = PERMIT_TYPES[s2.permitType]
                  return (
                    <button key={s2.code} className="chip-btn"
                      onClick={()=>{ onClose(); setTimeout(()=>onSelect(s2.code), 80) }}
                      style={{ display:'inline-flex', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontFamily:FONT, fontWeight:700, background:pt2?.bg, color:pt2?.color, border:'none', cursor:'pointer', transition:'all 150ms ease' }}>
                      {s2.code}
                    </button>
                  )
                })
            }
          </div>

          {/* Official source */}
          {state.officialSource && (
            <div style={{ marginBottom:'14px' }}>
              <a href={state.officialSource} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:'12px', color:'#1565c0', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                🔗 Official State Source / Licensing Authority
              </a>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ background:'#fff8e1', border:'1px solid #ffc107', borderRadius:'6px', padding:'10px 14px', fontSize:'11px', color:'#5d4037', lineHeight:1.6 }}>
            <strong>⚠ Disclaimer:</strong> This information is for reference only and is not legal advice. Laws change frequently. Always verify with official state sources and consult a licensed attorney before carrying a firearm across state lines.
          </div>
        </div>
      </div>
    </div>
  )
}
