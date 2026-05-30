import { useState, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { CCW_STATES, CCW_MAP, PERMIT_TYPES, getStateColor } from './ccwData'
import Icon from '../../components/ui/Icon'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// FIPS code → state abbreviation mapping
const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
}

const s = {
  shell:    { minHeight:'100vh', background:'#0d0f14', color:'#f0f2f8', fontFamily:"'Barlow',sans-serif" },
  header:   { background:'#0a0c10', borderBottom:'1px solid #252838', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' },
  logo:     { fontFamily:"'Bebas Neue',sans-serif", fontSize:'24px', letterSpacing:'3px', color:'#c8a84b', lineHeight:1 },
  logoSub:  { fontSize:'11px', color:'#3d4460', letterSpacing:'1px', textTransform:'uppercase', marginTop:'2px' },
  badge:    { display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(200,168,75,0.1)', border:'1px solid rgba(200,168,75,0.3)', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', color:'#c8a84b', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px' },
  layout:   { display:'grid', gridTemplateColumns:'1fr 380px', height:'calc(100vh - 62px)', overflow:'hidden' },
  mapWrap:  { position:'relative', background:'#0d1520', overflow:'hidden' },
  panel:    { borderLeft:'1px solid #252838', background:'#141720', display:'flex', flexDirection:'column', overflow:'hidden' },
  panelHead:{ padding:'16px 18px 12px', borderBottom:'1px solid #252838', flexShrink:0 },
  panelBody:{ flex:1, overflowY:'auto', padding:'0' },
  tabs:     { display:'flex', gap:'2px', padding:'0 18px', borderBottom:'1px solid #252838', flexShrink:0 },
  tab:      { padding:'10px 14px', fontSize:'12px', background:'transparent', border:'none', cursor:'pointer', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'0.5px', borderBottom:'2px solid transparent', marginBottom:'-1px', transition:'all 150ms ease' },
  legend:   { display:'flex', gap:'12px', flexWrap:'wrap', padding:'10px 18px', borderBottom:'1px solid #252838', flexShrink:0 },
  legendItem:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#7a8299', cursor:'pointer' },
  legendDot:{ width:'10px', height:'10px', borderRadius:'2px', flexShrink:0 },
  search:   { margin:'12px 18px 8px', background:'#0d0f14', border:'1px solid #252838', borderRadius:'6px', padding:'9px 12px', fontSize:'13px', color:'#f0f2f8', outline:'none', width:'calc(100% - 36px)', fontFamily:"'Barlow',sans-serif", transition:'border-color 150ms ease' },
  stateRow: { display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', borderBottom:'1px solid #1a1d2a', cursor:'pointer', transition:'background 150ms ease' },
  stateCode:{ width:'36px', height:'36px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'13px', fontWeight:700, flexShrink:0 },
  table:    { width:'100%', borderCollapse:'collapse' },
  th:       { textAlign:'left', fontSize:'10px', color:'#3d4460', textTransform:'uppercase', letterSpacing:'1px', fontFamily:"'Barlow Condensed',sans-serif", padding:'8px 18px', borderBottom:'1px solid #252838', position:'sticky', top:0, background:'#141720', zIndex:1 },
  td:       { padding:'10px 18px', fontSize:'12px', color:'#7a8299', borderBottom:'1px solid #1a1d2a', verticalAlign:'middle' },
  tdName:   { padding:'10px 18px', fontSize:'13px', color:'#f0f2f8', fontWeight:500, borderBottom:'1px solid #1a1d2a', verticalAlign:'middle' },
  // Detail
  detHead:  { padding:'18px', borderBottom:'1px solid #252838' },
  detTitle: { fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'2px', color:'#f0f2f8', lineHeight:1.1 },
  detMeta:  { fontSize:'12px', color:'#7a8299', marginTop:'4px' },
  detBody:  { padding:'16px 18px' },
  detSection:{ fontSize:'10px', color:'#3d4460', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'10px', marginTop:'16px', borderBottom:'1px solid #1a1d2a', paddingBottom:'6px' },
  chip:     { display:'inline-flex', alignItems:'center', padding:'2px 7px', borderRadius:'4px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, letterSpacing:'0.5px', margin:'2px', cursor:'pointer' },
  backBtn:  { display:'inline-flex', alignItems:'center', gap:'6px', background:'transparent', border:'none', color:'#7a8299', cursor:'pointer', fontSize:'12px', padding:'0', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'1px', marginBottom:'8px' },
  pill:     { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:'0.5px' },
}

export default function CCWMap() {
  const [selected, setSelected]       = useState(null)
  const [tab, setTab]                 = useState('map') // map | table
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('all')
  const [hovering, setHovering]       = useState(null)
  const [zoom, setZoom]               = useState(1)
  const [center, setCenter]           = useState([-96, 38])

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

  const honorsSelected = selected ? CCW_STATES.filter(s => selected.honors.includes(s.code)) : []
  const honoredBySelected = selected ? CCW_STATES.filter(s => s.honors.includes(selected.code)) : []

  const highlightCodes = useMemo(() => {
    if (!selected) return new Set()
    return new Set([...selected.honors, ...CCW_STATES.filter(s=>s.honors.includes(selected.code)).map(s=>s.code)])
  }, [selected])

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box }
        body { background:#0d0f14 }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#252838;border-radius:4px}
        .ccw-tab-active { color:#c8a84b !important; border-bottom-color:#c8a84b !important; font-weight:700 }
        .ccw-tab:hover { color:#c8a84b !important }
        .state-row:hover { background:#1a1d2a !important }
      `}</style>
      <div style={s.shell}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <div style={s.logo}>POST<span style={{color:'#f0f2f8'}}>COMMAND</span> · CCW RECIPROCITY</div>
            <div style={s.logoSub}>Concealed Carry Reciprocity Map — All 50 States + DC</div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={s.badge}><Icon name="zap" size={11}/>AI-Updated Monthly</span>
            <span style={{ fontSize:'11px', color:'#3d4460' }}>Always verify with your state AG office</span>
          </div>
        </header>

        <div style={{ ...s.layout, gridTemplateColumns: tab === 'table' ? '1fr' : '1fr 380px' }}>
          {/* Map */}
          {tab !== 'table' && (
            <div style={s.mapWrap}>
              {/* Legend overlay */}
              <div style={{ position:'absolute', bottom:'16px', left:'16px', zIndex:10, background:'rgba(13,15,20,0.9)', border:'1px solid #252838', borderRadius:'8px', padding:'10px 14px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                {Object.entries(PERMIT_TYPES).map(([key, val]) => (
                  <button key={key} onClick={() => setFilterType(filterType===key?'all':key)} style={{ ...s.legendItem, opacity: filterType!=='all'&&filterType!==key ? 0.4 : 1, border:'none', background:'transparent', cursor:'pointer', padding:0 }}>
                    <div style={{ ...s.legendDot, background: val.color, opacity: filterType!=='all'&&filterType!==key?0.4:1 }}/>
                    {val.label} ({CCW_STATES.filter(s=>s.permitType===key).length})
                  </button>
                ))}
              </div>
              {/* Hover tooltip */}
              {hovering && !selected && (
                <div style={{ position:'absolute', top:'16px', left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(26,29,42,0.95)', border:'1px solid #252838', borderRadius:'8px', padding:'8px 14px', pointerEvents:'none' }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'14px', color:getStateColor(hovering.permitType), fontWeight:700 }}>{hovering.name}</span>
                  <span style={{ fontSize:'12px', color:'#7a8299', marginLeft:'8px' }}>{PERMIT_TYPES[hovering.permitType]?.label}</span>
                </div>
              )}

              <ComposableMap projection="geoAlbersUsa" style={{ width:'100%', height:'100%' }}>
                <ZoomableGroup zoom={zoom} center={center} onMoveEnd={({ zoom, coordinates }) => { setZoom(zoom); setCenter(coordinates) }}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map(geo => {
                        const fips = geo.id?.toString().padStart(2,'0')
                        const code = FIPS[fips]
                        const state = code ? CCW_MAP[code] : null
                        if (!state) return null
                        const isSelected = selected?.code === code
                        const isHighlighted = selected && highlightCodes.has(code)
                        const isFiltered = filterType !== 'all' && state.permitType !== filterType
                        const baseColor = getStateColor(state.permitType)
                        let fill = isFiltered ? '#1a1d2a' : baseColor
                        let fillOpacity = isFiltered ? 0.3 : 0.7
                        let stroke = '#252838'
                        let strokeWidth = 0.5
                        if (isSelected) { fill = baseColor; fillOpacity = 1; stroke = '#c8a84b'; strokeWidth = 2 }
                        else if (selected && isHighlighted) { fill = baseColor; fillOpacity = 0.9; stroke = '#c8a84b44'; strokeWidth = 1 }
                        else if (selected && !isHighlighted && !isFiltered) { fill = '#1a1d2a'; fillOpacity = 0.5 }
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => setHovering(state)}
                            onMouseLeave={() => setHovering(null)}
                            onClick={() => setSelected(selected?.code === code ? null : state)}
                            style={{
                              default: { fill, fillOpacity, stroke, strokeWidth, outline:'none', cursor:'pointer', transition:'fill-opacity 150ms ease' },
                              hover:   { fill: baseColor, fillOpacity:1, stroke:'#c8a84b', strokeWidth:1.5, outline:'none', cursor:'pointer' },
                              pressed: { fill: baseColor, fillOpacity:1, outline:'none' },
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              <div style={{ position:'absolute', bottom:'16px', right:'16px', zIndex:10, display:'flex', flexDirection:'column', gap:'4px' }}>
                {[['+', ()=>setZoom(z=>Math.min(z*1.5,8))],['-',()=>setZoom(z=>Math.max(z/1.5,1))],['⊙',()=>{setZoom(1);setCenter([-96,38])}]].map(([label,fn])=>(
                  <button key={label} onClick={fn} style={{ width:'34px', height:'34px', background:'rgba(26,29,42,0.9)', border:'1px solid #252838', borderRadius:'6px', color:'#c8a84b', fontSize:label==='⊙'?'16px':'20px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Side Panel */}
          <div style={s.panel}>
            <div style={s.panelHead}>
              <div style={{ display:'flex', gap:'2px' }}>
                {[['map','Map'],['table','Full Table']].map(([id,label])=>(
                  <button key={id} className={`ccw-tab${tab===id?' ccw-tab-active':''}`} style={{ ...s.tab, color:tab===id?'#c8a84b':'#7a8299', borderBottom:`2px solid ${tab===id?'#c8a84b':'transparent'}` }} onClick={()=>{setTab(id);if(id==='table')setSelected(null)}}>{label}</button>
                ))}
              </div>
            </div>

            {!selected && (
              <>
                <div style={s.legend}>
                  {Object.entries(PERMIT_TYPES).map(([key,val]) => (
                    <button key={key} onClick={() => setFilterType(filterType===key?'all':key)} style={{ ...s.legendItem, opacity:filterType!=='all'&&filterType!==key?0.4:1, border:'none', background:'transparent', cursor:'pointer', padding:0 }}>
                      <div style={{ ...s.legendDot, background:val.color }}/>
                      {val.short} ({CCW_STATES.filter(s=>s.permitType===key).length})
                    </button>
                  ))}
                </div>
                <input
                  style={s.search}
                  placeholder="Search state..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={e => e.target.style.borderColor='#c8a84b'}
                  onBlur={e => e.target.style.borderColor='#252838'}
                />
              </>
            )}

            <div style={s.panelBody}>
              {selected ? (
                <StateDetail state={selected} onBack={() => setSelected(null)} onSelect={selectByCode} honorsStates={honorsSelected} honoredByStates={honoredBySelected} />
              ) : tab === 'map' ? (
                <StateList states={filtered} onSelect={setSelected} />
              ) : (
                <FullTable states={filtered} onSelect={s=>{setSelected(s);setTab('map')}} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
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
              <div style={{ fontSize:'13px', color:'#f0f2f8', fontWeight:500 }}>{state.name}</div>
              <div style={{ fontSize:'11px', color:'#3d4460', marginTop:'2px' }}>{pt?.label} · {state.constitutional ? 'No permit req.' : state.permitName}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'12px', color:'#c8a84b', fontFamily:"'Barlow Condensed',sans-serif" }}>
                {state.honoredBy?.length ?? 0} states
              </div>
              <div style={{ fontSize:'10px', color:'#3d4460' }}>honor this</div>
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
        <div style={{ display:'flex', gap:'8px', marginTop:'8px', flexWrap:'wrap' }}>
          <span style={{ ...s.pill, background:pt?.bg, color:pt?.color }}>{pt?.label}</span>
          {state.constitutional && <span style={{ ...s.pill, background:'rgba(26,122,74,0.15)', color:'#1a7a4a' }}>No Permit Required</span>}
        </div>
      </div>
      <div style={s.detBody}>
        <div style={s.detSection}>Permit Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'4px' }}>
          {[
            { label:'Permit Name', value: state.constitutional && state.fee===0 ? 'No permit issued' : state.permitName },
            { label:'Fee', value: state.fee === 0 ? 'Free' : `$${state.fee}` },
            { label:'Training Hours', value: state.trainingHours === 0 ? 'None required' : `${state.trainingHours} hrs` },
            { label:'Residency', value: state.residencyRequired ? 'Required' : 'Not required' },
            { label:'Min Age', value: state.minAge ? `${state.minAge} years` : '—' },
            { label:'Valid For', value: state.validYears === 0 ? 'N/A' : `${state.validYears} years` },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize:'10px', color:'#3d4460', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:'2px' }}>{item.label}</div>
              <div style={{ fontSize:'13px', color:'#f0f2f8' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {state.notes && (
          <>
            <div style={s.detSection}>Notes</div>
            <p style={{ fontSize:'12px', color:'#7a8299', lineHeight:1.7 }}>{state.notes}</p>
          </>
        )}

        <div style={s.detSection}>
          Honors ({honorsStates.length} states) — {state.name} recognizes these permits
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'8px' }}>
          {honorsStates.length === 0
            ? <span style={{ fontSize:'12px', color:'#3d4460' }}>Does not honor any out-of-state permits</span>
            : honorsStates.map(s2 => {
                const pt2 = PERMIT_TYPES[s2.permitType]
                return <button key={s2.code} style={{ ...s.chip, background:pt2?.bg, color:pt2?.color }} onClick={() => onSelect(s2.code)}>{s2.code}</button>
              })
          }
        </div>

        <div style={s.detSection}>
          Honored By ({honoredByStates.length} states) — these states recognize {state.name} permits
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
          {honoredByStates.length === 0
            ? <span style={{ fontSize:'12px', color:'#3d4460' }}>No states honor this permit for reciprocity</span>
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
    let av = a[sort], bv = b[sort]
    if (typeof av === 'string') return av.localeCompare(bv) * dir
    return ((av ?? 0) - (bv ?? 0)) * dir
  })

  const TH = ({ col, label }) => (
    <th style={{ ...s.th, cursor:'pointer', userSelect:'none' }} onClick={() => toggleSort(col)}>
      {label} {sort===col ? (dir===1?'↑':'↓') : ''}
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
              <tr key={state.code} style={{ cursor:'pointer' }} onClick={() => onSelect(state)}
                onMouseEnter={e => e.currentTarget.style.background='#1a1d2a'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <td style={s.tdName}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ width:'28px', height:'22px', background:pt?.bg, color:pt?.color, borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'11px', fontWeight:700 }}>{state.code}</span>
                    {state.name}
                  </div>
                </td>
                <td style={s.td}><span style={{ color:pt?.color, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'11px' }}>{pt?.short}</span></td>
                <td style={s.td}>{state.fee === 0 ? 'Free' : `$${state.fee}`}</td>
                <td style={s.td}>{state.trainingHours === 0 ? '—' : `${state.trainingHours}h`}</td>
                <td style={s.td}>{state.honors.length}</td>
                <td style={{ ...s.td, color:'#c8a84b', fontWeight:600 }}>{state.honoredBy?.length ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
