export default function Badge({ count, max=99 }) {
  if (!count || count <= 0) return null
  const display = count > max ? `${max}+` : String(count)
  return (
    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--badge-bg)',color:'#fff',fontFamily:'var(--font-condensed)',fontSize:'11px',fontWeight:700,borderRadius:'10px',padding:'1px 6px',minWidth:'20px',height:'18px',lineHeight:1,flexShrink:0}} aria-label={`${count} notifications`}>
      {display}
    </span>
  )
}
