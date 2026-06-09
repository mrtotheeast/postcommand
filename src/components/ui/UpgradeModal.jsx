import { useNavigate } from 'react-router-dom'
import { getUpgradeMessage, getPlan } from '../../lib/plans'
import Icon from './Icon'

export default function UpgradeModal({ planId, resource, onClose }) {
  const navigate = useNavigate()
  const message  = getUpgradeMessage(planId, resource)
  const plan     = getPlan(planId)

  const nextPlanName = planId === 'trial' ? 'Starter'
    : planId === 'starter' ? 'Professional'
    : planId === 'professional' ? 'Enterprise'
    : null

  function goToBilling() {
    onClose()
    navigate('/billing')
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={onClose}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'32px', width:'100%', maxWidth:'420px', boxShadow:'var(--shadow-modal)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon name="lock" size={22} color="var(--accent)" />
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px', display:'flex', borderRadius:'var(--radius-sm)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)', marginBottom:'10px' }}>
          {nextPlanName ? 'UPGRADE YOUR PLAN' : 'ADD MORE CAPACITY'}
        </div>

        <p style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.7, marginBottom:'24px' }}>
          {message || `You've reached the limit for your ${plan.name} plan.`}
          {nextPlanName && ` Upgrade to ${nextPlanName} to continue growing.`}
        </p>

        <button
          onClick={goToBilling}
          style={{ width:'100%', height:'48px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom:'10px' }}
        >
          <Icon name="arrow-up-circle" size={16} />
          VIEW PLANS & UPGRADE
        </button>

        <div style={{ display:'flex', justifyContent:'center', gap:'20px' }}>
          <a href="mailto:support@postcommand.app" style={{ fontSize:'12px', color:'var(--text-muted)', textDecoration:'none' }}>
            Contact Support
          </a>
          <button onClick={onClose} style={{ fontSize:'12px', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
