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
 * Route: /reciprocity — fully public, no login required, no auth wrapper.
 * No session → header hidden, map fills full viewport (iframe mode).
 * Session found → PostCommand header shown.
 * No useAuth() calls — safe for unauthenticated use.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { CCW_STATES, CCW_MAP, PERMIT_TYPES, getStateColor } from './ccwData'
import Icon from '../../components/ui/Icon'
import { supabase } from '../../lib/supabase'

// Served from /public to avoid CDN dependency and service worker cross-origin issues.
const GEO_URL = '/us-states.json'

// FIPS → state code
const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
}

// Small states that need pointer labels.
// Positions as % of map container — calibrated for geoAlbersUsa default render.
// `from` = approximate state centroid, `to` = label box center.
const SMALL_LABELS = [
  { code:'VT', from:[70.5,20.5], to:[83,12]  },
  { code:'NH', from:[73.5,19],   to:[87,16]  },
  { code:'MA', from:[75,  23],   to:[91,20]  },
  { code:'RI', from:[76.5,25.5], to:[91,25]  },
  { code:'CT', from:[74,  26.5], to:[91,30]  },
  { code:'NJ', from:[72,  31],   to:[87,35]  },
  { code:'DE', from:[71.5,34],   to:[83,39]  },
  { code:'MD', from:[70.5,36],   to:[83,44]  },
  { code:'DC', from:[70,  37.5], to:[87,49]  },
  { code:'HI', from:[27,  82],   to:[18,85]  },
]

// ── Colour palette (light theme) ─────────────────────────────────────────────
const C = {
  bg:         '#ffffff',
  mapBg:      '#f0f4f8',
  panelBg:    '#ffffff',
  border:     '#e2e6ea',
  text:       '#0d0f14',
  textSecond: '#4a6080',
  textMuted:  '#8899aa',
  gold:       '#c8a84b',
  stateFill:  '#dce3ea',  // default unfocused state
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  shell:     { height:'100vh', background:C.bg, color:C.text, fontFamily:"'Barlow',sans-serif", display:'flex', flexDirection:'column' },
  header:    { background:C.bg, borderBottom:`1px solid ${C.border}`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', flexShrink:0 },
  logo:      { fontFamily:"'Bebas Neue',sans-serif", fontSize:'22px', letterSpacing:'3px', color:C.gold, lineHeight:1 },
  logoSub:   { fontSize:'11px', color:C.textMuted, letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' },
  badge:     { display:'inline-flex', alignItems:'center', gap:'6px', background:`rgba(200,168,75,0.12)`, border:`1px solid rgba(200,168,75,0.35)`, borderRadius:'20px', padding:'4px 12px', fontSize:'11px', color:C.gold, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px' },
  layout:    { display:'grid', gridTemplateColumns:'1fr 360px', flex:1, overflow:'hidden' },
  mapWrap:   { position:'relative', background:C.mapBg, overflow:'hidden' },
  panel:     { borderLeft:`1px solid ${C.border}`, background:C.panelBg, display:'flex', flexDirection:'column', overflow:'hidden' },
  panelHead: { padding:'14px 18px 10px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  panelBody: { flex:1, overflowY:'auto', padding:'0' },
  tabs:      { display:'flex', gap:'2px', padding:'0 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  tab:       { padding:'9px 14px', fontSize:'12px', background:'transparent', border:'none', cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease', color:C.textMuted },
  legend:    { display:'flex', gap:'10px', flexWrap:'wrap', padding:'10px 18px', borderBottom:`1px solid ${C.border}`, flexShrink:0 },
  legendItem:{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:C.textSecond, cursor:'pointer', border:'none', background:'transparent', padding:0 },
  legendDot: { width:'9px', height:'9px', borderRadius:'2px', flexShrink:0 },
  search:    { margin:'10px 18px 6px', background:'#f8f9fa', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px 12px', fontSize:'13px', color:C.text, outline:'none', width:'calc(100% - 36px)', fontFamily:"'Barlow',sans-serif", transition:'border-color 150ms ease' },
  stateRow:  { display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', borderBottom:`1px solid #f0f2f5`, cursor:'pointer', transition:'background 150ms ease' },
  stateCode: { width:'34px', height:'34px', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'12px', fontWeight:700, flexShrink:0 },
  table:     { width:'100%', borderCollapse:'collapse' },
  th:        { textAlign:'left', fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'1px', fontFamily:"'Barlow Condensed',sans-serif", padding:'8px 14px', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, background:C.bg, zIndex:1 },
  td:        { padding:'9px 14px', fontSize:'12px', color:C.textSecond, borderBottom:`1px solid #f0f2f5`, verticalAlign:'middle' },
  tdName:    { padding:'9px 14px', fontSize:'13px', color:C.text, fontWeight:500, borderBottom:`1px solid #f0f2f5`, verticalAlign:'middle' },
  detHead:   { padding:'16px 18px', borderBottom:`1px solid ${C.border}` },
  detTitle:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:'24px', letterSpacing:'2px', color:C.text, lineHeight:1.1 },
  detSection:{ fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'8px', marginTop:'14px', borderBottom:`1px solid ${C.border}`, paddingBottom:'5px' },
  chip:      { display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:'4px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, letterSpacing:'0.5px', margin:'2px', cursor:'pointer', border:'none' },
  backBtn:   { display:'inline-flex', alignItems:'center', gap:'5px', background:'transparent', border:'none', color:C.textMuted, cursor:'pointer', fontSize:'12px', padding:'0', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px', marginBottom:'6px' },
  pill:      { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 9px', borderRadius:'20px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:'0.5px' },
  zoomBtn:   { width:'32px', height:'32px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', color:C.text, fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.12)' },
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CCWMap() {
  const [hasSession, setHasSession] = useState(false)
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setHasSession(!!session))
      .catch(() => setHasSession(false))
  }, [])

  const [selected, setSelected]   = useState(null)
  const [tab, setTab]             = useState('map')
  const [search, setSearch]       = useState('')
  const [filterType, setFilterType] = useState('all')
  const [hovering, setHovering]   = useState(null)
  const [zoom, setZoom]           = useState(1)
  const [geoError, setGeoError]   = useState(false)

  const filtered = useMemo(() => CCW_STATES.filter(s => {
    if (filterType !== 'all' && s.permitType !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false
    }
    return true
  }), [search, filterType])

  function selectByCode(code) {
    const st = CCW_MAP[code]
    if (st) { setSelected(st); setTab('map') }
  }

  const honorsSelected    = selected ? CCW_STATES.filter(s => selected.honors.includes(s.code)) : []
  const honoredBySelected = selected ? CCW_STATES.filter(s => s.honors.includes(selected.code)) : []
  const highlightCodes    = useMemo(() => {
    if (!selected) return new Set()
    return new Set([...selected.honors, ...CCW_STATES.filter(s => s.honors.includes(selected.code)).map(s => s.code)])
  }, [selected])

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        html,body{height:100%;background:#fff}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#dce3ea;border-radius:4px}
        .ccw-tab-active{color:${C.gold}!important;border-bottom-color:${C.gold}!important;font-weight:700}
        .ccw-tab:hover{color:${C.gold}!important}
        .state-row:hover{background:#f8f9fa!important}
        .tr-hover:hover{background:#f8f9fa!important}
        .zoom-btn:hover{background:#f0f4f8!important}
        .state-label-btn:hover{opacity:0.85!important}
      `}</style>

      <div style={s.shell}>
        {/* Header — only shown when logged in */}
        {hasSession && (
          <header style={s.header}>
            <div>
              <div style={s.logo}>POST<span style={{color:C.text}}>COMMAND</span> · CCW RECIPROCITY</div>
              <div style={s.logoSub}>Concealed Carry Reciprocity Map — All 50 States + DC</div>
            </div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <span style={s.badge}><Icon name="zap" size={11}/>AI-Updated Monthly</span>
              <span style={{ fontSize:'11px', color:C.textMuted }}>Always verify with your state AG office</span>
            </div>
          </header>
        )}

        <div style={{ ...s.layout, gridTemplateColumns: tab === 'table' ? '1fr' : '1fr 360px' }}>

          {/* ── Map panel ── */}
          {tab !== 'table' && (
            <div style={s.mapWrap}>

              {/* Legend overlay — bottom left */}
              <div style={{ position:'absolute', bottom:'14px', left:'14px', zIndex:10, background:'rgba(255,255,255,0.95)', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'8px 12px', display:'flex', gap:'10px', flexWrap:'wrap', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
                {Object.entries(PERMIT_TYPES).map(([key, val]) => (
                  <button key={key} className="legend-btn" onClick={() => setFilterType(filterType===key?'all':key)}
                    style={{ ...s.legendItem, opacity: filterType!=='all'&&filterType!==key ? 0.35 : 1 }}>
                    <div style={{ ...s.legendDot, background: val.color }} />
                    <span style={{ fontSize:'11px', color:C.text }}>{val.label} ({CCW_STATES.filter(x=>x.permitType===key).length})</span>
                  </button>
                ))}
              </div>

              {/* Hover tooltip */}
              {hovering && !selected && (
                <div style={{ position:'absolute', top:'14px', left:'50%', transform:'translateX(-50%)', zIndex:10, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'7px 14px', pointerEvents:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'14px', color:getStateColor(hovering.permitType), fontWeight:700 }}>{hovering.name}</span>
                  <span style={{ fontSize:'12px', color:C.textMuted, marginLeft:'8px' }}>{PERMIT_TYPES[hovering.permitType]?.label}</span>
                </div>
              )}

              {/* Map — CSS-transform zoom (no ZoomableGroup conflict with geoAlbersUsa) */}
              <div style={{ width:'100%', height:'100%', overflow:'hidden', position:'relative' }}>
                <div style={{ width:'100%', height:'100%', transform:`scale(${zoom})`, transformOrigin:'center center', transition:'transform 220ms ease' }}>
                  <ComposableMap
                    projection="geoAlbersUsa"
                    style={{ width:'100%', height:'100%', display:'block' }}
                  >
                    <Geographies
                      geography={GEO_URL}
                      onError={() => setGeoError(true)}
                    >
                      {({ geographies }) => {
                        if (!geographies?.length) return null
                        return geographies.map(geo => {
                          const fips  = geo.id?.toString().padStart(2,'0')
                          const code  = FIPS[fips]
                          const state = code ? CCW_MAP[code] : null
                          if (!state) return null

                          const isSelected    = selected?.code === code
                          const isHighlighted = selected && highlightCodes.has(code)
                          const isFiltered    = filterType !== 'all' && state.permitType !== filterType
                          const typeColor     = getStateColor(state.permitType)

                          // Fill logic
                          let fill        = typeColor
                          let fillOpacity = 0.75
                          let stroke      = '#ffffff'
                          let strokeWidth = 0.5

                          if (isFiltered) {
                            fill = C.stateFill; fillOpacity = 1
                          } else if (isSelected) {
                            fill = typeColor; fillOpacity = 1; stroke = C.gold; strokeWidth = 2
                          } else if (selected && isHighlighted) {
                            fill = typeColor; fillOpacity = 0.85; stroke = `${C.gold}88`; strokeWidth = 1
                          } else if (selected && !isHighlighted) {
                            fill = C.stateFill; fillOpacity = 1
                          }

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              onMouseEnter={() => setHovering(state)}
                              onMouseLeave={() => setHovering(null)}
                              onClick={() => setSelected(selected?.code === code ? null : state)}
                              style={{
                                default: { fill, fillOpacity, stroke, strokeWidth, outline:'none', cursor:'pointer' },
                                hover:   { fill: typeColor, fillOpacity: 1, stroke: C.gold, strokeWidth: 1.5, outline:'none', cursor:'pointer' },
                                pressed: { fill: typeColor, fillOpacity: 1, outline:'none' },
                              }}
                            />
                          )
                        })
                      }}
                    </Geographies>
                  </ComposableMap>
                </div>

                {/* Small state pointer labels — rendered over the zoomed map */}
                <SmallStateLabels
                  onSelect={selectByCode}
                  selected={selected}
                  highlightCodes={highlightCodes}
                  filterType={filterType}
                />
              </div>

              {/* GeoJSON load error fallback */}
              {geoError && (
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f9fa' }}>
                  <div style={{ textAlign:'center', color:C.textMuted }}>
                    <Icon name="map" size={32} color="#dce3ea" />
                    <div style={{ marginTop:'10px', fontSize:'13px' }}>Map tiles unavailable — check connection</div>
                    <button style={{ marginTop:'10px', fontSize:'12px', color:C.gold, background:'none', border:`1px solid ${C.gold}`, borderRadius:'6px', padding:'6px 14px', cursor:'pointer' }} onClick={() => { setGeoError(false) }}>Retry</button>
                  </div>
                </div>
              )}

              {/* Zoom controls */}
              <div style={{ position:'absolute', bottom:'14px', right:'14px', zIndex:10, display:'flex', flexDirection:'column', gap:'4px' }}>
                {[['+', () => setZoom(z=>Math.min(z*1.4, 6))],['-', () => setZoom(z=>Math.max(z/1.4, 1))],['⊙', () => setZoom(1)]].map(([label, fn]) => (
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
                    onClick={() => { setTab(id); if(id==='table') setSelected(null) }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!selected && (
              <>
                <div style={s.legend}>
                  {Object.entries(PERMIT_TYPES).map(([key,val]) => (
                    <button key={key} className="legend-btn"
                      onClick={() => setFilterType(filterType===key?'all':key)}
                      style={{ ...s.legendItem, opacity: filterType!=='all'&&filterType!==key ? 0.35 : 1 }}>
                      <div style={{ ...s.legendDot, background:val.color }}/>
                      {val.short} ({CCW_STATES.filter(x=>x.permitType===key).length})
                    </button>
                  ))}
                </div>
                <input
                  style={s.search}
                  placeholder="Search state..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={e => e.target.style.borderColor=C.gold}
                  onBlur={e => e.target.style.borderColor=C.border}
                />
              </>
            )}

            <div style={s.panelBody}>
              {selected ? (
                <StateDetail state={selected} onBack={() => setSelected(null)} onSelect={selectByCode}
                  honorsStates={honorsSelected} honoredByStates={honoredBySelected} />
              ) : tab === 'map' ? (
                <StateList states={filtered} onSelect={setSelected} />
              ) : (
                <FullTable states={filtered} onSelect={s2 => { setSelected(s2); setTab('map') }} />
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Small state pointer labels ────────────────────────────────────────────────

function SmallStateLabels({ onSelect, selected, highlightCodes, filterType }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:8 }}>
      {/* SVG for connecting lines */}
      <svg width="100%" height="100%" style={{ position:'absolute', inset:0 }} aria-hidden="true">
        {SMALL_LABELS.map(({ code, from, to }) => {
          const state = CCW_MAP[code]
          const color = state ? getStateColor(state.permitType) : '#aaa'
          return (
            <line key={code}
              x1={`${from[0]}%`} y1={`${from[1]}%`}
              x2={`${to[0]}%`}   y2={`${to[1]}%`}
              stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7"
            />
          )
        })}
      </svg>

      {/* Clickable label boxes */}
      {SMALL_LABELS.map(({ code, to }) => {
        const state = CCW_MAP[code]
        if (!state) return null
        const typeColor = getStateColor(state.permitType)
        const isSelected = selected?.code === code
        const isHighlighted = highlightCodes.has(code)
        const isFiltered = filterType !== 'all' && state.permitType !== filterType

        let bg = `${typeColor}18`
        let border = typeColor
        let opacity = 1

        if (isFiltered) { bg = '#f0f4f8'; border = '#dce3ea'; opacity = 0.5 }
        else if (isSelected) { bg = typeColor; border = C.gold }
        else if (selected && !isHighlighted) { opacity = 0.35 }

        return (
          <button
            key={code}
            className="state-label-btn"
            onClick={() => onSelect(code)}
            style={{
              position:'absolute',
              left:`${to[0]}%`, top:`${to[1]}%`,
              transform:'translate(-50%,-50%)',
              background: isSelected ? typeColor : bg,
              border:`1.5px solid ${border}`,
              borderRadius:'3px',
              padding:'1px 5px',
              fontSize:'10px',
              fontFamily:"'Barlow Condensed',sans-serif",
              fontWeight:700,
              color: isSelected ? '#fff' : typeColor,
              cursor:'pointer',
              pointerEvents:'auto',
              whiteSpace:'nowrap',
              boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
              opacity,
              transition:'opacity 150ms ease',
              minHeight:'18px', minWidth:'24px',
              lineHeight:1.4,
            }}
            title={state.name}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}

// ── State List ────────────────────────────────────────────────────────────────

function StateList({ states, onSelect }) {
  return (
    <div>
      {states.map(state => {
        const pt = PERMIT_TYPES[state.permitType]
        return (
          <div key={state.code} className="state-row" style={s.stateRow} onClick={() => onSelect(state)}>
            <div style={{ ...s.stateCode, background:pt?.bg, color:pt?.color }}>
              {state.code}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'13px', color:C.text, fontWeight:500 }}>{state.name}</div>
              <div style={{ fontSize:'11px', color:C.textMuted, marginTop:'1px' }}>{pt?.label} · {state.constitutional ? 'No permit req.' : state.permitName}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'12px', color:C.gold, fontFamily:"'Barlow Condensed',sans-serif" }}>
                {state.honoredBy?.length ?? 0} states
              </div>
              <div style={{ fontSize:'10px', color:C.textMuted }}>honor this</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── State Detail ──────────────────────────────────────────────────────────────

function StateDetail({ state, onBack, onSelect, honorsStates, honoredByStates }) {
  const pt = PERMIT_TYPES[state.permitType]
  return (
    <div>
      <div style={s.detHead}>
        <button style={s.backBtn} onClick={onBack}><Icon name="arrow-left" size={13}/>Back to list</button>
        <div style={s.detTitle}>{state.name}</div>
        <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
          <span style={{ ...s.pill, background:pt?.bg, color:pt?.color }}>{pt?.label}</span>
          {state.constitutional && <span style={{ ...s.pill, background:'rgba(76,175,80,0.12)', color:'#388e3c' }}>No Permit Required</span>}
        </div>
      </div>
      <div style={{ padding:'14px 18px' }}>
        <div style={s.detSection}>Permit Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'4px' }}>
          {[
            { label:'Permit Name',   value: state.constitutional && state.fee===0 ? 'No permit issued' : state.permitName },
            { label:'Fee',           value: state.fee === 0 ? 'Free' : `$${state.fee}` },
            { label:'Training Hrs',  value: state.trainingHours === 0 ? 'None required' : `${state.trainingHours} hrs` },
            { label:'Residency',     value: state.residencyRequired ? 'Required' : 'Not required' },
            { label:'Min Age',       value: state.minAge ? `${state.minAge} years` : '—' },
            { label:'Valid For',     value: state.validYears === 0 ? 'N/A' : `${state.validYears} years` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize:'10px', color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'2px' }}>{item.label}</div>
              <div style={{ fontSize:'13px', color:C.text }}>{item.value}</div>
            </div>
          ))}
        </div>

        {state.notes && (
          <>
            <div style={s.detSection}>Notes</div>
            <p style={{ fontSize:'12px', color:C.textSecond, lineHeight:1.7 }}>{state.notes}</p>
          </>
        )}

        <div style={s.detSection}>Honors ({honorsStates.length}) — permits {state.name} recognizes</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'6px' }}>
          {honorsStates.length === 0
            ? <span style={{ fontSize:'12px', color:C.textMuted }}>Does not honor any out-of-state permits</span>
            : honorsStates.map(s2 => {
                const pt2 = PERMIT_TYPES[s2.permitType]
                return <button key={s2.code} style={{ ...s.chip, background:pt2?.bg, color:pt2?.color }} onClick={() => onSelect(s2.code)}>{s2.code}</button>
              })
          }
        </div>

        <div style={s.detSection}>Honored By ({honoredByStates.length}) — states that honor {state.name}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
          {honoredByStates.length === 0
            ? <span style={{ fontSize:'12px', color:C.textMuted }}>No states honor this permit for reciprocity</span>
            : honoredByStates.map(s2 => {
                const pt2 = PERMIT_TYPES[s2.permitType]
                return <button key={s2.code} style={{ ...s.chip, background:pt2?.bg, color:pt2?.color }} onClick={() => onSelect(s2.code)}>{s2.code}</button>
              })
          }
        </div>
      </div>
    </div>
  )
}

// ── Full Table ────────────────────────────────────────────────────────────────

function FullTable({ states, onSelect }) {
  const [sort, setSort] = useState('name')
  const [dir, setDir]   = useState(1)

  function toggleSort(col) {
    if (sort === col) setDir(d => -d)
    else { setSort(col); setDir(1) }
  }

  const sorted = [...states].sort((a, b) => {
    const av = a[sort], bv = b[sort]
    if (typeof av === 'string') return av.localeCompare(bv) * dir
    return ((av ?? 0) - (bv ?? 0)) * dir
  })

  const TH = ({ col, label }) => (
    <th style={{ ...s.th, cursor:'pointer', userSelect:'none' }} onClick={() => toggleSort(col)}>
      {label}{sort===col ? (dir===1?' ↑':' ↓') : ''}
    </th>
  )

  return (
    <div style={{ overflowX:'auto' }}>
      <table style={s.table}>
        <thead>
          <tr>
            <TH col="name" label="State" />
            <TH col="permitType" label="Type" />
            <TH col="fee" label="Fee" />
            <TH col="trainingHours" label="Train." />
            <th style={s.th}>Honors</th>
            <th style={s.th}>Honored By</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(state => {
            const pt = PERMIT_TYPES[state.permitType]
            return (
              <tr key={state.code} className="tr-hover" style={{ cursor:'pointer' }} onClick={() => onSelect(state)}>
                <td style={s.tdName}>
                  <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                    <span style={{ width:'26px', height:'20px', background:pt?.bg, color:pt?.color, borderRadius:'3px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'10px', fontWeight:700 }}>{state.code}</span>
                    {state.name}
                  </div>
                </td>
                <td style={s.td}><span style={{ color:pt?.color, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'11px' }}>{pt?.short}</span></td>
                <td style={s.td}>{state.fee === 0 ? 'Free' : `$${state.fee}`}</td>
                <td style={s.td}>{state.trainingHours === 0 ? '—' : `${state.trainingHours}h`}</td>
                <td style={s.td}>{state.honors.length}</td>
                <td style={{ ...s.td, color:C.gold, fontWeight:600 }}>{state.honoredBy?.length ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
