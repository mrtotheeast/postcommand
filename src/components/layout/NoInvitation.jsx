import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../ui/Icon'

// Shown inside the app shell when the signed-in user has no company and
// claim_invitation found no invitation (or more than one) for their email.
const btn   = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'8px', height:'42px', padding:'0 18px', borderRadius:'var(--radius-sm)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }
const solid = { ...btn, background:'var(--accent)', color:'var(--text-inverse)', border:'none' }
const ghost = { ...btn, background:'transparent', color:'var(--text-secondary)', border:'1px solid var(--border)' }

export default function NoInvitation({ reason }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const email = user?.email || 'this email'

  async function registerCompany() {
    await signOut()            // /register is only available when signed out
    navigate('/register')
  }

  return (
    <div style={{ minHeight:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ maxWidth:'480px', width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'32px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'14px' }}><Icon name="mail" size={32} color="var(--accent)" /></div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'12px' }}>NO INVITATION FOUND</div>
        <p style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.6, margin:'0 0 12px' }}>
          We could not find an invitation for <strong style={{ color:'var(--text-primary)' }}>{email}</strong>.
          Ask your company administrator to send you an invitation, then sign in again with this email.
        </p>
        {reason === 'ambiguous' && (
          <p style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, margin:'0 0 12px' }}>
            This email has more than one pending invitation, so we could not tell which company to connect you to. Your administrator can resend the right one.
          </p>
        )}
        <p style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, margin:'0 0 24px' }}>
          Setting up a new security company? You can register your company instead.
        </p>
        <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
          <button style={solid} onClick={() => window.location.reload()}><Icon name="refresh-cw" size={14} />CHECK AGAIN</button>
          <button style={ghost} onClick={registerCompany}><Icon name="briefcase" size={14} />REGISTER A COMPANY</button>
          <button style={ghost} onClick={signOut}><Icon name="log-out" size={14} />SIGN OUT</button>
        </div>
      </div>
    </div>
  )
}
