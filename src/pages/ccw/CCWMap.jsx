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
 * No session → header hidden (iframe mode). Session → header shown.
 */

import { useState, useMemo, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { CCW_STATES, CCW_MAP, PERMIT_TYPES, getStateColor } from './ccwData'
import Icon from '../../components/ui/Icon'
import { supabase } from '../../lib/supabase'

const GEO_URL = '/us-states.json'

const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
}

// Small-state pointer labels.
// Positions calibrated for geoAlbersUsa default render:
//   from = state centroid (% of map container, x/y)
//   to   = label box center (% of map container, x/y)
// Stacked in right-side open space for northeast; HI lower-left.
const SMALL_LABELS = [
  { code:'VT', from:[70.8, 19.5], to:[84, 11]  },
  { code:'NH', from:[73.0, 17.5], to:[88, 15.5] },
  { code:'MA', from:[74.5, 22.0], to:[92, 20.5] },
  { code:'RI', from:[76.0, 24.0], to:[92, 25.5] },
  { code:'CT', from:[74.0, 25.5], to:[92, 30.5] },
  { code:'NJ', from:[72.2, 29.5], to:[88, 35.5] },
  { code:'DE', from:[72.5, 32.5], to:[84, 40]   },
  { code:'MD', from:[71.0, 34.5], to:[84, 45]   },
  { code:'DC', from:[70.5, 36.0], to:[88, 50]   },
  { code:'HI', from:[28.0, 81.5], to:[17, 81.5] },
]

const C = {
  bg:'#ffffff', mapBg:'#f0f4f8', panelBg:'#ffffff',
  border:'#e2e6ea', text:'#0d0f14', textSecond:'#4a6080', textMuted:'#8899aa',
  gold:'#c8a84b', stateFill:'#dce3ea',
}

const s = {
  shell:    { height:'100vh', background:C.bg, color:C.text, fontFamily:"'Barlow',sans-serif", display:'flex', flexDirection:'column' },
  header:   { background:C.bg, borderBottom:`1px solid ${C.border}`, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', flexShrink:0 },
  logo:     { fontFamily:"'Bebas Neue',sans-serif", fontSize:'20px', letterSpacing:'3px', color:C.gold },
  badge:    { display:'inline-flex', alignItems:'center', gap:'5px', background:'rgba(200,168,75,0.1)', border:'1px solid rgba(200,168,75,0.3)', borderRadius:'20px', padding:'3px 10px', fontSize:'11px', color:C.gold, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px' },
  headerBtns:{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' },
  hBtn:     { display:'inline-flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'0 12px', height:'34px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px', cursor:'pointer', color:C.textSecond, transition:'all 150ms ease' },
  layout:   { display:'grid', gridTemplateColumns:'1fr 360px', flex:1, overflow:'hidden' },
  mapWrap:  { position:'relative', background:C.mapBg, overflow:'hidden' },
  panel:    { borderLeft:`1px solid ${C.border}`, background:C.panelBg, display:'flex', flexDirection:'column', overflow:'hidden' },
  panelHead:{ padding:'12px 18px 8px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  panelBody:{ flex:1, overflowY:'auto' },
  tabs:     { display:'flex', gap:'2px', padding:'0 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  tab:      { padding:'8px 13px', fontSize:'12px', background:'transparent', border:'none', cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease', color:C.textMuted },
  legend:   { display:'flex', gap:'8px', flexWrap:'wrap', padding:'8px 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  legendItem:{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:C.textSecond, cursor:'pointer', border:'none', background:'transparent', padding:0 },
  legendDot:{ width:'8px', height:'8px', borderRadius:'2px', flexShrink:0 },
  search:   { margin:'8px 18px 5px', background:'#f8f9fa', border:`1px solid ${C.border}`, borderRadius:'5px', padding:'7px 11px', fontSize:'13px', color:C.text, outline:'none', width:'calc(100% - 36px)', fontFamily:"'Barlow',sans-serif", transition:'border-color 150ms ease' },
  stateRow: { display:'flex', alignItems:'center', gap:'9px', padding:'9px 18px', borderBottom:`1px solid #f0f2f5`, cursor:'pointer', transition:'background 150ms ease' },
  stateCode:{ width:'32px', height:'32px', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'11px', fontWeight:700, flexShrink:0 },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { textAlign:'left', fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'1px', fontFamily:"'Barlow Condensed',sans-serif", padding:'7px 12px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, background:C.bg, zIndex:1 },
  td:       { padding:'8px 12px', fontSize:'12px', color:C.textSecond, borderBottom:`1px solid #f0f2f5`, verticalAlign:'middle' },
  tdName:   { padding:'8px 12px', fontSize:'12px', color:C.text, fontWeight:500, borderBottom:`1px solid #f0f2f5`, verticalAlign:'middle' },
  pill:     { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 9px', borderRadius:'20px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:'0.5px' },
  chip:     { display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:'4px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, letterSpacing:'0.5px', margin:'2px', cursor:'pointer', border:'none' },
  zoomBtn:  { width:'30px', height:'30px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'5px', color:C.text, fontSize:'14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },
  // Modal
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal:    { background:C.bg, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'0', width:'100%', maxWidth:'560px', maxHeight:'88vh', overflow:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.18)' },
  mHead:    { padding:'18px 20px 14px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, background:C.bg, zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between' },
  mBody:    { padding:'16px 20px 20px' },
  mSec:     { fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'8px', marginTop:'14px', borderBottom:`1px solid ${C.border}`, paddingBottom:'5px' },
  closeBtn: { background:'transparent', border:'none', color:C.textMuted, cursor:'pointer', padding:'4px', borderRadius:'4px', display:'flex', flexShrink:0 },
  // Compare bar
  compareBar:{ position:'fixed', bottom:0, left:0, right:0, zIndex:150, background:C.bg, borderTop:`2px solid ${C.gold}`, padding:'12px 20px', display:'flex', gap:'12px', alignItems:'center', boxShadow:'0 -4px 20px rgba(0,0,0,0.1)', flexWrap:'wrap' },
  compareCard:{ background:'#f8f9fa', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 14px', minWidth:'160px', flex:1 },
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CCWMap() {
  const [hasSession, setHasSession] = useState(false)
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data:{ session } }) => setHasSession(!!session))
      .catch(() => setHasSession(false))
  }, [])

  const [tab, setTab]             = useState('map')
  const [search, setSearch]       = useState('')
  const [filterType, setFilterType] = useState('all')
  const [hovering, setHovering]   = useState(null)
  const [zoom, setZoom]           = useState(1)
  const [geoError, setGeoError]   = useState(false)
  // Fix 2 — State modal
  const [modalState, setModalState] = useState(null)
  // Fix 3 — Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareList, setCompareList] = useState([])
  // Map highlight (used when modal is open)
  const [mapSelected, setMapSelected] = useState(null)

  const filtered = useMemo(() => CCW_STATES.filter(s => {
    if (filterType !== 'all' && s.permitType !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false
    }
    return true
  }), [search, filterType])

  function openModal(state) {
    if (!state) return
    if (compareMode) {
      setCompareList(prev => {
        const has = prev.find(s => s.code === state.code)
        if (has) return prev.filter(s => s.code !== state.code)
        if (prev.length >= 4) return prev
        return [...prev, state]
      })
      return
    }
    setModalState(state)
    setMapSelected(state)
  }

  function closeModal() { setModalState(null); setMapSelected(null) }

  function selectByCode(code) {
    const st = CCW_MAP[code]
    if (st) openModal(st)
  }

  const highlightCodes = useMemo(() => {
    if (!mapSelected) return new Set()
    return new Set([...mapSelected.honors, ...CCW_STATES.filter(s=>s.honors.includes(mapSelected.code)).map(s=>s.code)])
  }, [mapSelected])

  // Fix 4 — Print
  function printMap() {
    const stateRows = CCW_STATES.map(s => {
      const pt = PERMIT_TYPES[s.permitType]
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:500">${s.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${pt?.color}">${pt?.label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.constitutional?'No permit req.':s.permitName}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.fee===0?'Free':'$'+s.fee}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.trainingHours===0?'None':s.trainingHours+'h'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${s.honoredBy?.length??0}</td>
      </tr>`
    }).join('')
    const w = window.open('','_blank','width=1000,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>CCW Reciprocity Map — PostCommand</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#1a1a2e;padding:32px}
h1{font-size:28px;font-weight:900;letter-spacing:3px;color:#c8a84b;margin-bottom:4px}
h1 span{color:#1a1a2e}.sub{font-size:11px;color:#888;margin-bottom:20px;text-transform:uppercase;letter-spacing:1px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;padding:7px 10px;border-bottom:2px solid #e2e6ea;text-align:left}
td{font-size:11px}
.legend{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:6px;font-size:11px}
.legend-dot{width:12px;height:12px;border-radius:3px}
.disclaimer{background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:14px 18px;margin-top:24px}
.disclaimer h4{color:#856404;font-size:12px;margin-bottom:6px}
.disclaimer p{color:#856404;font-size:11px;line-height:1.6}
@media print{body{padding:20px}.disclaimer{background:#fff3cd!important;-webkit-print-color-adjust:exact}}
</style></head><body>
<h1>POST<span>COMMAND</span></h1>
<div class="sub">CCW Reciprocity Reference — All 50 States + DC · ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
<div class="legend">
  ${Object.entries(PERMIT_TYPES).map(([,pt])=>`<div class="legend-item"><div class="legend-dot" style="background:${pt.color}"></div><span>${pt.label} (${CCW_STATES.filter(s=>s.permitType===Object.keys(PERMIT_TYPES).find(k=>PERMIT_TYPES[k]===pt)).length})</span></div>`).join('')}
</div>
<table>
  <thead><tr>
    <th>State</th><th>Carry Type</th><th>Permit Name</th><th>Fee</th><th>Training</th><th>Honored By</th>
  </tr></thead>
  <tbody>${stateRows}</tbody>
</table>
<div class="disclaimer">
  <h4>⚠ DISCLAIMER</h4>
  <p>This map is updated monthly using AI-assisted research. Information may not reflect the most current laws. <strong>Always verify with local state authorities and consult a licensed attorney before traveling with a firearm.</strong> Do not rely solely on this map for legal compliance. Laws change frequently and vary by municipality. PostCommand and Nationwide Police Services LLC make no representations or warranties regarding the accuracy or completeness of this information.</p>
</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const inCompare = (code) => compareList.some(s => s.code === code)

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;background:#fff}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#dce3ea;border-radius:4px}
        .ccw-tab-active{color:${C.gold}!important;border-bottom-color:${C.gold}!important;font-weight:700}
        .ccw-tab:hover,.state-label-btn:hover{opacity:0.8!important}
        .state-row:hover,.tr-hover:hover{background:#f8f9fa!important}
        .zoom-btn:hover,.h-btn:hover{background:#f0f4f8!important;border-color:#c8a84b!important}
        .compare-card{transition:box-shadow 150ms ease}.compare-card:hover{box-shadow:0 2px 12px rgba(200,168,75,0.2)}
      `}</style>

      <div style={{ ...s.shell, paddingBottom: compareList.length > 0 ? '120px' : 0 }}>

        {/* Header — shown when logged in OR always for the public map */}
        <header style={s.header}>
          <div>
            <div style={s.logo}>POST<span style={{color:C.text}}>COMMAND</span> · CCW RECIPROCITY</div>
            <div style={{ fontSize:'10px', color:C.textMuted, letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' }}>
              Concealed Carry Reciprocity — All 50 States + DC
            </div>
          </div>
          <div style={s.headerBtns}>
            <span style={s.badge}><Icon name="zap" size={11}/>AI-Updated Monthly</span>
            <button className="h-btn" style={{ ...s.hBtn, background: compareMode ? C.gold : C.bg, color: compareMode ? '#fff' : C.textSecond, borderColor: compareMode ? C.gold : C.border }} onClick={() => { setCompareMode(m => !m); if(compareMode) setCompareList([]) }}>
              <Icon name="columns" size={13}/>{compareMode ? `COMPARING (${compareList.length}/4)` : 'COMPARE'}
            </button>
            <button className="h-btn" style={s.hBtn} onClick={printMap}>
              <Icon name="printer" size={13}/>PRINT / PDF
            </button>
          </div>
        </header>

        <div style={{ ...s.layout, gridTemplateColumns: tab === 'table' ? '1fr' : '1fr 360px' }}>

          {/* ── Map ── */}
          {tab !== 'table' && (
            <div style={s.mapWrap}>

              {/* Legend */}
              <div style={{ position:'absolute', bottom:'12px', left:'12px', zIndex:10, background:'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:'7px', padding:'7px 11px', display:'flex', gap:'9px', flexWrap:'wrap', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
                {Object.entries(PERMIT_TYPES).map(([key, val]) => (
                  <button key={key} onClick={() => setFilterType(filterType===key?'all':key)}
                    style={{ ...s.legendItem, opacity: filterType!=='all'&&filterType!==key ? 0.3 : 1 }}>
                    <div style={{ ...s.legendDot, background: val.color }}/>
                    <span style={{ color:C.text }}>{val.label} ({CCW_STATES.filter(x=>x.permitType===key).length})</span>
                  </button>
                ))}
              </div>

              {/* Tooltip */}
              {hovering && !modalState && (
                <div style={{ position:'absolute', top:'12px', left:'50%', transform:'translateX(-50%)', zIndex:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'7px', padding:'6px 12px', pointerEvents:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'13px', color:getStateColor(hovering.permitType), fontWeight:700 }}>{hovering.name}</span>
                  <span style={{ fontSize:'11px', color:C.textMuted, marginLeft:'7px' }}>{PERMIT_TYPES[hovering.permitType]?.label}</span>
                  {compareMode && inCompare(hovering.code) && <span style={{ fontSize:'10px', color:C.gold, marginLeft:'7px' }}>✓ selected</span>}
                </div>
              )}

              {/* Map SVG — CSS-transform zoom */}
              <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative' }}>
                <div style={{ width:'100%', height:'100%', transform:`scale(${zoom})`, transformOrigin:'center center', transition:'transform 220ms ease' }}>
                  <ComposableMap projection="geoAlbersUsa" style={{ width:'100%', height:'100%', display:'block' }}>
                    <Geographies geography={GEO_URL} onError={() => setGeoError(true)}>
                      {({ geographies }) => {
                        if (!geographies?.length) return null
                        return geographies.map(geo => {
                          const fips  = geo.id?.toString().padStart(2,'0')
                          const code  = FIPS[fips]
                          const state = code ? CCW_MAP[code] : null
                          if (!state) return null

                          const isSelected   = mapSelected?.code === code
                          const isHighlighted = mapSelected && highlightCodes.has(code)
                          const isFiltered   = filterType !== 'all' && state.permitType !== filterType
                          const isCompared   = inCompare(code)
                          const typeColor    = getStateColor(state.permitType)

                          let fill = typeColor, fillOpacity = 0.7, stroke = '#ffffff', strokeWidth = 0.5
                          if (isFiltered)  { fill = C.stateFill; fillOpacity = 1 }
                          else if (isCompared) { fill = typeColor; fillOpacity = 1; stroke = C.gold; strokeWidth = 2 }
                          else if (isSelected) { fill = typeColor; fillOpacity = 1; stroke = C.gold; strokeWidth = 2 }
                          else if (mapSelected && isHighlighted) { fill = typeColor; fillOpacity = 0.85; stroke = `${C.gold}88`; strokeWidth = 1 }
                          else if (mapSelected && !isHighlighted) { fill = C.stateFill; fillOpacity = 1 }

                          return (
                            <Geography key={geo.rsmKey} geography={geo}
                              onMouseEnter={() => setHovering(state)}
                              onMouseLeave={() => setHovering(null)}
                              onClick={() => openModal(state)}
                              style={{
                                default: { fill, fillOpacity, stroke, strokeWidth, outline:'none', cursor:'pointer' },
                                hover:   { fill: typeColor, fillOpacity:1, stroke:C.gold, strokeWidth:1.5, outline:'none', cursor:'pointer' },
                                pressed: { fill: typeColor, fillOpacity:1, outline:'none' },
                              }}
                            />
                          )
                        })
                      }}
                    </Geographies>
                  </ComposableMap>
                </div>

                <SmallStateLabels onSelect={openModal} modalState={modalState} highlightCodes={highlightCodes} filterType={filterType} compareList={compareList} compareMode={compareMode} />
              </div>

              {geoError && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f9fa' }}>
                  <div style={{ textAlign:'center', color:C.textMuted }}>
                    <Icon name="map" size={32} color="#dce3ea" />
                    <div style={{ marginTop:'10px', fontSize:'13px' }}>Map unavailable — check connection</div>
                    <button style={{ marginTop:'10px', fontSize:'12px', color:C.gold, background:'none', border:`1px solid ${C.gold}`, borderRadius:'6px', padding:'5px 14px', cursor:'pointer' }} onClick={() => setGeoError(false)}>Retry</button>
                  </div>
                </div>
              )}

              {/* Zoom controls */}
              <div style={{ position:'absolute', bottom:'12px', right:'12px', zIndex:10, display:'flex', flexDirection:'column', gap:'4px' }}>
                {[['+', ()=>setZoom(z=>Math.min(z*1.4,6))],['-', ()=>setZoom(z=>Math.max(z/1.4,1))],['⊙', ()=>setZoom(1)]].map(([label,fn])=>(
                  <button key={label} className="zoom-btn" style={s.zoomBtn} onClick={fn}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── Side panel ── */}
          <div style={s.panel}>
            <div style={s.panelHead}>
              <div style={{ display:'flex', gap:'2px' }}>
                {[['map','Map'],['table','Full Table']].map(([id,label]) => (
                  <button key={id} className={`ccw-tab${tab===id?' ccw-tab-active':''}`}
                    style={{ ...s.tab, color:tab===id?C.gold:C.textMuted, borderBottom:`2px solid ${tab===id?C.gold:'transparent'}` }}
                    onClick={() => { setTab(id); if(id==='table') { setMapSelected(null); setModalState(null) } }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.legend}>
              {Object.entries(PERMIT_TYPES).map(([key,val]) => (
                <button key={key} onClick={() => setFilterType(filterType===key?'all':key)}
                  style={{ ...s.legendItem, opacity: filterType!=='all'&&filterType!==key?0.3:1 }}>
                  <div style={{ ...s.legendDot, background:val.color }}/>
                  {val.short} ({CCW_STATES.filter(x=>x.permitType===key).length})
                </button>
              ))}
            </div>
            <input style={s.search} placeholder="Search state..." value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => e.target.style.borderColor=C.gold}
              onBlur={e => e.target.style.borderColor=C.border}
            />

            <div style={s.panelBody}>
              {tab === 'map'
                ? <StateList states={filtered} onSelect={openModal} compareList={compareList} compareMode={compareMode} />
                : <FullTable states={filtered} onSelect={openModal} />
              }
            </div>
          </div>

        </div>
      </div>

      {/* Fix 2 — State detail modal */}
      {modalState && (
        <StateModal state={modalState} onClose={closeModal} onSelect={selectByCode} />
      )}

      {/* Fix 3 — Compare bar */}
      {compareList.length > 0 && (
        <div style={s.compareBar}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'12px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'1px', flexShrink:0 }}>
            Comparing ({compareList.length}/4)
          </div>
          {compareList.map(state => {
            const pt = PERMIT_TYPES[state.permitType]
            return (
              <div key={state.code} className="compare-card" style={s.compareCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px' }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'16px', letterSpacing:'1.5px', color:C.text }}>{state.name}</div>
                  <button style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textMuted, padding:'0', display:'flex' }} onClick={() => setCompareList(p => p.filter(s => s.code !== state.code))}>
                    <Icon name="x" size={13}/>
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', fontSize:'11px' }}>
                  <span style={{ color:pt?.color, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{pt?.label}</span>
                  <span style={{ color:C.textMuted }}>Fee: {state.fee===0?'Free':'$'+state.fee}</span>
                  <span style={{ color:C.textMuted }}>Training: {state.trainingHours===0?'None':state.trainingHours+'h'}</span>
                  <span style={{ color:C.gold, fontWeight:600 }}>Honored by {state.honoredBy?.length??0}</span>
                </div>
                <button style={{ marginTop:'6px', fontSize:'10px', color:C.gold, background:'none', border:`1px solid ${C.gold}`, borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif" }} onClick={() => { setModalState(state); setMapSelected(state) }}>
                  DETAILS
                </button>
              </div>
            )
          })}
          <button style={{ ...s.hBtn, background:C.gold, color:'#fff', border:`1px solid ${C.gold}`, marginLeft:'auto', flexShrink:0 }} onClick={() => { setCompareList([]); setCompareMode(false) }}>
            CLEAR
          </button>
        </div>
      )}
    </>
  )
}

// ── Small state pointer labels ────────────────────────────────────────────────

function SmallStateLabels({ onSelect, modalState, highlightCodes, filterType, compareList, compareMode }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:8 }}>
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0 }} aria-hidden="true">
        {SMALL_LABELS.map(({ code, from, to }) => {
          const state = CCW_MAP[code]
          const color = state ? getStateColor(state.permitType) : '#aaa'
          const isFiltered = filterType !== 'all' && state?.permitType !== filterType
          return (
            <line key={code}
              x1={`${from[0]}%`} y1={`${from[1]}%`}
              x2={`${to[0]}%`}   y2={`${to[1]}%`}
              stroke={color} strokeWidth="0.9" strokeDasharray="3 2"
              opacity={isFiltered ? 0.15 : 0.65}
            />
          )
        })}
      </svg>
      {SMALL_LABELS.map(({ code, to }) => {
        const state = CCW_MAP[code]
        if (!state) return null
        const typeColor = getStateColor(state.permitType)
        const isSelected = modalState?.code === code
        const isHighlighted = highlightCodes.has(code)
        const isFiltered = filterType !== 'all' && state.permitType !== filterType
        const isCompared = compareList.some(s => s.code === code)
        let opacity = 1, bg = `${typeColor}14`, border = typeColor, textColor = typeColor
        if (isFiltered) { opacity = 0.2 }
        else if (isSelected || isCompared) { bg = typeColor; textColor = '#fff'; border = C.gold }
        else if (modalState && !isHighlighted) { opacity = 0.3 }
        return (
          <button key={code} className="state-label-btn" onClick={() => onSelect(state)}
            style={{ position:'absolute', left:`${to[0]}%`, top:`${to[1]}%`, transform:'translate(-50%,-50%)', background:bg, border:`1.5px solid ${border}`, borderRadius:'3px', padding:'1px 4px', fontSize:'9px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:textColor, cursor:'pointer', pointerEvents:'auto', whiteSpace:'nowrap', boxShadow:'0 1px 3px rgba(0,0,0,0.12)', opacity, transition:'opacity 150ms ease', minHeight:'16px', minWidth:'22px', lineHeight:1.4 }}
            title={state.name}>{code}</button>
        )
      })}
    </div>
  )
}

// ── State detail modal (Fix 2) ────────────────────────────────────────────────

function StateModal({ state, onClose, onSelect }) {
  const pt            = PERMIT_TYPES[state.permitType]
  const honorsStates  = CCW_STATES.filter(s => state.honors.includes(s.code))
  const honoredBy     = CCW_STATES.filter(s => s.honors.includes(state.code))

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.mHead}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'2px', color:C.text, lineHeight:1 }}>{state.name}</div>
            <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
              <span style={{ ...s.pill, background:pt?.bg, color:pt?.color }}>{pt?.label}</span>
              {state.constitutional && <span style={{ ...s.pill, background:'rgba(76,175,80,0.12)', color:'#388e3c' }}>No Permit Required</span>}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><Icon name="x" size={18}/></button>
        </div>
        <div style={s.mBody}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'4px' }}>
            {[
              { label:'Permit',    value: state.constitutional && state.fee===0 ? 'None issued' : state.permitName },
              { label:'Fee',       value: state.fee===0 ? 'Free' : `$${state.fee}` },
              { label:'Training',  value: state.trainingHours===0 ? 'None req.' : `${state.trainingHours} hrs` },
              { label:'Residency', value: state.residencyRequired ? 'Required' : 'Not required' },
              { label:'Min Age',   value: state.minAge ? `${state.minAge} years` : '—' },
              { label:'Valid For', value: state.validYears===0 ? 'N/A' : `${state.validYears} years` },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'2px' }}>{item.label}</div>
                <div style={{ fontSize:'13px', color:C.text }}>{item.value}</div>
              </div>
            ))}
          </div>

          {state.notes && (
            <>
              <div style={s.mSec}>Notes</div>
              <p style={{ fontSize:'12px', color:C.textSecond, lineHeight:1.7 }}>{state.notes}</p>
            </>
          )}

          <div style={s.mSec}>Honors ({honorsStates.length} states) — {state.name} recognizes these permits</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginBottom:'6px' }}>
            {honorsStates.length === 0
              ? <span style={{ fontSize:'12px', color:C.textMuted }}>Does not honor any out-of-state permits</span>
              : honorsStates.map(s2 => {
                  const pt2 = PERMIT_TYPES[s2.permitType]
                  return <button key={s2.code} style={{ ...s.chip, background:pt2?.bg, color:pt2?.color }} onClick={() => { onClose(); setTimeout(() => onSelect(s2.code), 80) }}>{s2.code}</button>
                })
            }
          </div>

          <div style={s.mSec}>Honored By ({honoredBy.length} states) — these states honor {state.name} permits</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
            {honoredBy.length === 0
              ? <span style={{ fontSize:'12px', color:C.textMuted }}>No states honor this permit for reciprocity</span>
              : honoredBy.map(s2 => {
                  const pt2 = PERMIT_TYPES[s2.permitType]
                  return <button key={s2.code} style={{ ...s.chip, background:pt2?.bg, color:pt2?.color }} onClick={() => { onClose(); setTimeout(() => onSelect(s2.code), 80) }}>{s2.code}</button>
                })
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── State List ────────────────────────────────────────────────────────────────

function StateList({ states, onSelect, compareList, compareMode }) {
  return (
    <div>
      {states.map(state => {
        const pt = PERMIT_TYPES[state.permitType]
        const isCompared = compareList.some(s => s.code === state.code)
        return (
          <div key={state.code} className="state-row" style={{ ...s.stateRow, background: isCompared ? `${C.gold}0d` : 'transparent' }} onClick={() => onSelect(state)}>
            <div style={{ ...s.stateCode, background:pt?.bg, color:pt?.color }}>{state.code}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'13px', color:C.text, fontWeight:500 }}>{state.name}</div>
              <div style={{ fontSize:'11px', color:C.textMuted, marginTop:'1px' }}>{pt?.label} · {state.constitutional?'No permit req.':state.permitName}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'12px', color:C.gold, fontFamily:"'Barlow Condensed',sans-serif" }}>{state.honoredBy?.length??0} states</div>
              <div style={{ fontSize:'10px', color:C.textMuted }}>honor this</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Full Table ────────────────────────────────────────────────────────────────

function FullTable({ states, onSelect }) {
  const [sort, setSort] = useState('name')
  const [dir, setDir]   = useState(1)
  function toggleSort(col) { if(sort===col) setDir(d=>-d); else { setSort(col); setDir(1) } }
  const sorted = [...states].sort((a,b) => {
    const av=a[sort],bv=b[sort]
    if (typeof av==='string') return av.localeCompare(bv)*dir
    return ((av??0)-(bv??0))*dir
  })
  const TH = ({col,label}) => (
    <th style={{ ...s.th, cursor:'pointer', userSelect:'none' }} onClick={()=>toggleSort(col)}>
      {label}{sort===col?(dir===1?' ↑':' ↓'):''}
    </th>
  )
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={s.table}>
        <thead>
          <tr><TH col="name" label="State"/><TH col="permitType" label="Type"/><TH col="fee" label="Fee"/><TH col="trainingHours" label="Train."/><th style={s.th}>Honors</th><th style={s.th}>Honored By</th></tr>
        </thead>
        <tbody>
          {sorted.map(state => {
            const pt = PERMIT_TYPES[state.permitType]
            return (
              <tr key={state.code} className="tr-hover" style={{ cursor:'pointer' }} onClick={() => onSelect(state)}>
                <td style={s.tdName}><div style={{ display:'flex', alignItems:'center', gap:'7px' }}><span style={{ width:'24px', height:'19px', background:pt?.bg, color:pt?.color, borderRadius:'3px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'10px', fontWeight:700 }}>{state.code}</span>{state.name}</div></td>
                <td style={s.td}><span style={{ color:pt?.color, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'11px' }}>{pt?.short}</span></td>
                <td style={s.td}>{state.fee===0?'Free':'$'+state.fee}</td>
                <td style={s.td}>{state.trainingHours===0?'—':state.trainingHours+'h'}</td>
                <td style={s.td}>{state.honors.length}</td>
                <td style={{ ...s.td, color:C.gold, fontWeight:600 }}>{state.honoredBy?.length??0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
