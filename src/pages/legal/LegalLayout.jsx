export function LegalLayout({ title, lastUpdated, children, toc = [] }) {
  return (
    <div style={{ minHeight:'100vh', background:'#ffffff', fontFamily:'Barlow, sans-serif', color:'#0d0f14' }}>
      {/* Header */}
      <div style={{ background:'#0d0f14', padding:'16px 40px', display:'flex', alignItems:'center', gap:'12px', borderBottom:'2px solid #c8a84b' }}>
        <a href="/" style={{ textDecoration:'none' }}>
          <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'24px', letterSpacing:'3px', color:'#fff' }}>POST<span style={{ color:'#c8a84b' }}>COMMAND</span></div>
        </a>
        <div style={{ flex:1 }}/>
        <span style={{ color:'#888', fontSize:'12px', fontFamily:'Barlow Condensed, sans-serif' }}>Last updated: {lastUpdated}</span>
      </div>

      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'40px 24px', display:'flex', gap:'40px', alignItems:'flex-start' }}>
        {toc.length > 0 && (
          <div style={{ width:'160px', flexShrink:0, position:'sticky', top:'80px' }}>
            <div style={{ fontSize:'11px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'2px', color:'#888', textTransform:'uppercase', marginBottom:'10px' }}>Contents</div>
            {toc.map(item => (
              <a key={item.id} href={`#${item.id}`} style={{ display:'block', fontSize:'12px', color:'#555', textDecoration:'none', padding:'4px 0', lineHeight:1.4, borderLeft:'2px solid #e5e7eb', paddingLeft:'10px', marginBottom:'2px' }}>
                {item.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'36px', letterSpacing:'3px', color:'#0d0f14', marginBottom:'8px' }}>{title}</h1>
          <div style={{ fontSize:'12px', color:'#888', marginBottom:'32px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px' }}>Effective {lastUpdated}</div>
          {children}
        </div>
      </div>

      <div style={{ background:'#f9fafb', padding:'24px 40px', textAlign:'center', borderTop:'1px solid #e5e7eb', marginTop:'40px' }}>
        <div style={{ display:'flex', gap:'20px', justifyContent:'center', flexWrap:'wrap' }}>
          {[['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Support','/support'],['postcommand.app','https://postcommand.app']].map(([label,href])=>(
            <a key={href} href={href} style={{ color:'#c8a84b', fontSize:'13px', textDecoration:'none', fontFamily:'Barlow Condensed, sans-serif' }}>{label}</a>
          ))}
        </div>
        <p style={{ color:'#aaa', fontSize:'12px', marginTop:'12px' }}>© 2026 PostCommand · Security Workforce Management</p>
      </div>
    </div>
  )
}

export function Section({ id, title, children }) {
  return (
    <div id={id} style={{ marginBottom:'32px' }}>
      <h2 style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'20px', fontWeight:700, letterSpacing:'1px', color:'#0d0f14', marginBottom:'12px', paddingBottom:'8px', borderBottom:'1px solid #e5e7eb' }}>{title}</h2>
      {children}
    </div>
  )
}

export function P({ children }) {
  return <p style={{ fontSize:'14px', color:'#374151', lineHeight:1.8, marginBottom:'12px' }}>{children}</p>
}

export function UL({ items }) {
  return (
    <ul style={{ margin:'0 0 14px', paddingLeft:'20px' }}>
      {items.map((item, i) => <li key={i} style={{ fontSize:'14px', color:'#374151', lineHeight:1.7, marginBottom:'4px' }}>{item}</li>)}
    </ul>
  )
}
