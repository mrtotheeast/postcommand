export function PageLoader({ message = 'Loading...' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', flexDirection:'column', gap:'12px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'32px', height:'32px', border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <div style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-condensed)', letterSpacing:'1px', textTransform:'uppercase' }}>{message}</div>
    </div>
  )
}
