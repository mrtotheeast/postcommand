import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { withLoadTimeout } from '../../lib/withLoadTimeout'
import Icon from '../../components/ui/Icon'
import { isNative, isIOS, openBrowser } from '../../lib/platform'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    priceUnit: null,
    period: 'mo',
    stripePriceId: null, // TODO: update stripeMonthlyPriceId when Stripe products created
    officers: 10,
    sites: 3,
    features: ['1 site · 10 officer slots', 'Scheduling, clock-in/out, incidents', 'DAR, patrol, live map, messaging', 'AI features included', '+$10/block of 5 officers · +$15/site'],
    color: 'var(--color-info)',
    bg: 'var(--color-info-bg)',
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 129,
    priceUnit: null,
    period: 'mo',
    stripePriceId: null, // TODO: update stripeMonthlyPriceId when Stripe products created
    officers: 25,
    sites: 15,
    features: ['3 sites · 25 officer slots', 'Everything in Starter', 'HR docs, client portal, invoicing', 'Time off management · Priority support', '+$12/block of 5 officers · +$15/site'],
    color: 'var(--accent)',
    bg: 'var(--accent-bg)',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    priceUnit: null,
    period: 'mo',
    stripePriceId: null, // TODO: update stripeMonthlyPriceId when Stripe products created
    officers: null,
    sites: null,
    features: ['10 sites · 50 officer slots', 'Everything in Professional', 'Personal onboarding · 4hr SLA', 'Dedicated account manager · ADP payroll sync', '+$15/block of 5 officers · +$15/site (unlimited)'],
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
]

const s = {
  page:     { padding:'24px', maxWidth:'1000px', animation:'fadeIn 200ms ease' },
  heading:  { fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  sub:      { fontSize:'12px', color:'var(--text-muted)', marginBottom:'28px' },
  // Current plan card
  curCard:  { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', marginBottom:'28px' },
  curTitle: { fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'12px' },
  curPlan:  { fontFamily:'var(--font-display)', fontSize:'32px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' },
  curSub:   { fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px' },
  // Status pill
  pill:     { display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' },
  // Plan grid
  plansGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'16px', marginBottom:'28px' },
  planCard: { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'24px', display:'flex', flexDirection:'column', gap:'12px', position:'relative', transition:'all 150ms ease' },
  planName: { fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'1.5px', color:'var(--text-primary)', lineHeight:1 },
  planPrice:{ display:'flex', alignItems:'flex-end', gap:'4px', marginBottom:'4px' },
  price:    { fontFamily:'var(--font-display)', fontSize:'40px', letterSpacing:'1px', lineHeight:1 },
  pricePer: { fontSize:'13px', color:'var(--text-muted)', marginBottom:'4px' },
  feature:  { display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'var(--text-secondary)' },
  btn:      { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'8px', border:'none', borderRadius:'var(--radius-sm)', padding:'0 20px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'14px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', transition:'opacity 150ms ease', width:'100%', marginTop:'auto' },
  // Usage
  usageRow: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' },
  usageLbl: { fontSize:'12px', color:'var(--text-muted)', width:'80px', flexShrink:0 },
  usageBar: { flex:1, height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' },
  usageFill:{ height:'100%', borderRadius:'3px', transition:'width 400ms ease' },
  usageNum: { fontSize:'12px', color:'var(--text-secondary)', minWidth:'60px', textAlign:'right', flexShrink:0 },
  // History
  histRow:  { display:'flex', alignItems:'center', gap:'14px', padding:'12px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' },
}

function fmtMoney(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0) }
function fmtDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

// iOS-specific billing view: App Store guidelines prohibit showing pricing/subscribe UI in iOS apps.
function BillingIOSView() {
  const { companyId } = useAuth()
  const [planName, setPlanName] = useState(null)

  useEffect(() => {
    if (!companyId) return
    supabase.from('company').select('plan').eq('id', companyId).single()
      .then(({ data }) => setPlanName(data?.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : null))
  }, [companyId])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', padding:'40px 24px', textAlign:'center', gap:'20px' }}>
      <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon name="credit-card" size={28} color="var(--accent)" />
      </div>
      <div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'8px' }}>BILLING & SUBSCRIPTION</h2>
        {planName && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'20px', padding:'4px 14px', marginBottom:'16px' }}>
            <Icon name="check-circle" size={13} color="var(--accent)" />
            <span style={{ fontSize:'13px', fontFamily:'var(--font-condensed)', fontWeight:700, letterSpacing:'0.5px', color:'var(--accent)' }}>{planName.toUpperCase()} PLAN</span>
          </div>
        )}
        <p style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.7, maxWidth:'320px', margin:'0 auto' }}>
          Subscriptions and billing are managed on the web.
          <br /><br />
          Visit <strong>postcommand.app</strong> to upgrade your plan, update payment details, or manage your subscription.
        </p>
      </div>
      <button
        onClick={() => openBrowser('https://postcommand.app/billing')}
        style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 28px', height:'52px', fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
      >
        <Icon name="external-link" size={16} />Manage Billing
      </button>
      <p style={{ fontSize:'11px', color:'var(--text-muted)' }}>Opens postcommand.app in your browser</p>
    </div>
  )
}

// Native Android/other: Show a web redirect.
function BillingNativeRedirect() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', padding:'40px 24px', textAlign:'center', gap:'20px' }}>
      <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon name="credit-card" size={28} color="var(--accent)" />
      </div>
      <div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'8px' }}>MANAGE YOUR SUBSCRIPTION</h2>
        <p style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.7, maxWidth:'320px', margin:'0 auto' }}>
          PostCommand subscriptions are managed on the web.
          <br /><br />
          Visit <strong>postcommand.app</strong> to upgrade, change your plan, or manage billing information.
        </p>
      </div>
      <button
        onClick={() => openBrowser('https://postcommand.app/billing')}
        style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-md)', padding:'0 28px', height:'52px', fontFamily:'var(--font-condensed)', fontSize:'15px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
      >
        <Icon name="external-link" size={16} />Open postcommand.app
      </button>
      <p style={{ fontSize:'11px', color:'var(--text-muted)' }}>Opens in your browser</p>
    </div>
  )
}

export default function Billing() {
  if (isIOS())    return <BillingIOSView />
  if (isNative()) return <BillingNativeRedirect />

  const { profile, companyId, isNPS, role, profileConfirmed } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!profileConfirmed) return
    if (role !== 'super_admin') navigate('/dashboard', { replace: true })
  }, [profileConfirmed, role, navigate])
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage]               = useState({})
  const [loading, setLoading]           = useState(true)
  const [checkingOut, setCheckingOut]   = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [invoices, setInvoices]         = useState([])

  useEffect(() => { if (companyId) load() }, [companyId])

  const load = withLoadTimeout(async function load() {
    setLoading(true)
    try {
      const [{ data: sub }, { data: empCount }, { data: siteCount }, { data: invData }] = await Promise.all([
        supabase.from('company_subscription').select('*').eq('company_id', companyId).single(),
        supabase.from('employee').select('id', { count:'exact' }).eq('company_id', companyId).eq('status','active'),
        supabase.from('site').select('id', { count:'exact' }).eq('company_id', companyId),
        supabase.from('invoice').select('id,invoice_number,client_name,total,status,created_at').eq('company_id', companyId).order('created_at',{ascending:false}).limit(5),
      ])
      setSubscription(sub)
      setUsage({ officers: empCount?.length || 0, sites: siteCount?.length || 0 })
      setInvoices(invData || [])
    } finally {
      setLoading(false)
    }
  }, { setLoading })

  async function startCheckout(plan) {
    if (isNPS) return
    if (!plan.stripePriceId) {
      window.open('mailto:sales@postcommand.app?subject=Enterprise Inquiry', '_blank')
      return
    }
    setCheckingOut(plan.id)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          price_id: plan.stripePriceId,
          company_id: companyId,
          user_email: profile?.email,
          success_url: `${window.location.origin}/billing?success=true`,
          cancel_url: `${window.location.origin}/billing`,
        }
      })
      if (error || !data?.url) throw new Error(error?.message || 'Checkout failed')
      if (isNative()) { const { openBrowser } = await import('../../lib/platform'); openBrowser(data.url) }
      else window.location.href = data.url
    } catch (e) {
      alert('Checkout error: ' + e.message)
    }
    setCheckingOut(null)
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { company_id: companyId, return_url: window.location.href }
      })
      if (error || !data?.url) throw new Error(error?.message || 'Portal failed')
      window.location.href = data.url
    } catch (e) {
      alert('Portal error: ' + e.message)
    }
    setPortalLoading(false)
  }

  const currentPlan = PLANS.find(p => p.id === (subscription?.plan_id || 'starter')) || PLANS[0]
  const isTrialing  = subscription?.status === 'trialing' || !subscription
  const isActive    = subscription?.status === 'active'
  const periodEnd   = subscription?.current_period_end ? fmtDate(subscription.current_period_end) : null

  if (loading) return <div style={{ padding:'24px' }}>{[...Array(3)].map((_,i) => <div key={i} className="skeleton" style={{ height:'100px', borderRadius:'10px', marginBottom:'12px' }} />)}</div>

  if (isNPS) return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>BILLING & SUBSCRIPTION</h2>
      <div style={{ background:'linear-gradient(135deg,rgba(201,162,39,0.15),rgba(201,162,39,0.05))', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-lg)', padding:'32px', marginBottom:'24px', textAlign:'center' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'var(--accent-bg)', border:'2px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Icon name="check-circle" size={26} color="var(--accent)"/>
        </div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'24px', letterSpacing:'2px', color:'var(--accent)', marginBottom:'8px' }}>PARTNER ACCOUNT</div>
        <div style={{ fontSize:'14px', color:'var(--text-secondary)', lineHeight:1.7, maxWidth:'440px', margin:'0 auto' }}>
          Nationwide Police Services has full access to all PostCommand features — including AI, multi-location, and client portal — at no charge.
        </div>
        <div style={{ marginTop:'20px', display:'flex', gap:'16px', justifyContent:'center', flexWrap:'wrap' }}>
          {['AI Features','Multi-Location','Client Portal','Payroll Export','All Reports','CCW Map'].map(f => (
            <span key={f} style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--accent)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>
              <Icon name="check" size={12} color="var(--accent)"/>{f}
            </span>
          ))}
        </div>
      </div>
      {invoices.length > 0 && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' }}>Recent Client Invoices</div>
          {invoices.map(inv => {
            const stColor = inv.status==='paid'?'var(--color-success)':inv.status==='overdue'?'var(--color-danger)':'var(--color-warning)'
            const stBg = inv.status==='paid'?'var(--color-success-bg)':inv.status==='overdue'?'var(--color-danger-bg)':'var(--color-warning-bg)'
            return (
              <div key={inv.id} style={s.histRow}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{inv.client_name} · {fmtDate(inv.created_at)}</div>
                </div>
                <div style={{ fontFamily:'var(--font-condensed)', fontWeight:700, color:'var(--text-primary)' }}>{fmtMoney(inv.total)}</div>
                <span style={{ ...s.pill, background:stBg, color:stColor }}>{inv.status?.toUpperCase()}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div style={s.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={s.heading}>BILLING & SUBSCRIPTION</h2>
      <p style={s.sub}>Manage your PostCommand plan, usage, and payment details.</p>

      {/* Trial countdown banner */}
      {isTrialing && !isNPS && (
        <div style={{ background:'var(--color-warning-bg)', border:'1px solid rgba(232,148,58,0.4)', borderRadius:'var(--radius-md)', padding:'14px 20px', marginBottom:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <Icon name="clock" size={18} color="var(--color-warning)"/>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:'var(--color-warning)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>FREE TRIAL</div>
              <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'2px' }}>
                {subscription?.trial_end ? `${Math.max(0, Math.ceil((new Date(subscription.trial_end)-Date.now())/86400000))} days left` : '14 days included'} · Upgrade to keep full access
              </div>
            </div>
          </div>
          <button style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--color-warning)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
            onClick={() => document.querySelector('[data-upgrade-btn]')?.scrollIntoView({ behavior:'smooth' })}>
            UPGRADE NOW →
          </button>
        </div>
      )}

      {/* Current plan */}
      <div style={s.curCard}>
        <div style={s.curTitle}>Current Plan</div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
          <div>
            <div style={s.curPlan}>{currentPlan.name.toUpperCase()}</div>
            <div style={s.curSub}>
              {currentPlan.price ? `${fmtMoney(currentPlan.price)}/month` : 'Custom pricing'}
              {periodEnd && ` · renews ${periodEnd}`}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <span style={{ ...s.pill, background: isTrialing?'var(--color-warning-bg)':isActive?'var(--color-success-bg)':'var(--color-danger-bg)', color: isTrialing?'var(--color-warning)':isActive?'var(--color-success)':'var(--color-danger)' }}>
                <Icon name={isTrialing?'clock':isActive?'check-circle':'alert-circle'} size={11}/>
                {isTrialing ? 'Trial' : isActive ? 'Active' : subscription?.status?.toUpperCase() || 'No Plan'}
              </span>
              {subscription?.cancel_at_period_end && <span style={{ ...s.pill, background:'var(--color-warning-bg)', color:'var(--color-warning)' }}>Cancels {periodEnd}</span>}
            </div>
          </div>
          {subscription?.stripe_customer_id && (
            <button style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', color:'var(--text-secondary)', cursor:'pointer', opacity:portalLoading?0.6:1 }} onClick={openPortal} disabled={portalLoading}>
              <Icon name="credit-card" size={14}/>{portalLoading?'LOADING...':'MANAGE BILLING'}
            </button>
          )}
        </div>

        {/* Usage bars */}
        <div style={{ marginTop:'20px' }}>
          {[
            { label:'Officers', used:usage.officers, max:currentPlan.officers },
            { label:'Sites',    used:usage.sites,    max:currentPlan.sites },
          ].filter(u => u.max).map(u => {
            const pct = Math.round((u.used/u.max)*100)
            return (
              <div key={u.label} style={s.usageRow}>
                <div style={s.usageLbl}>{u.label}</div>
                <div style={s.usageBar}>
                  <div style={{ ...s.usageFill, width:`${Math.min(pct,100)}%`, background: pct>=90?'var(--color-danger)':pct>=70?'var(--color-warning)':'var(--color-success)' }}/>
                </div>
                <div style={s.usageNum}>{u.used} / {u.max}</div>
              </div>
            )
          })}
          {!currentPlan.officers && (
            <div style={{ fontSize:'13px', color:'var(--color-success)', display:'flex', alignItems:'center', gap:'6px' }}>
              <Icon name="check-circle" size={14}/> Unlimited officers & sites
            </div>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' }}>Available Plans</div>
      <div style={s.plansGrid}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan.id
          return (
            <div key={plan.id} style={{ ...s.planCard, border:`2px solid ${isCurrent?plan.color:'var(--border-subtle)'}`, ...(plan.popular?{boxShadow:`0 0 0 1px ${plan.color}44`}:{}) }}>
              {plan.popular && <div style={{ position:'absolute', top:'-12px', left:'50%', transform:'translateX(-50%)', background:'var(--accent)', color:'var(--text-inverse)', fontFamily:'var(--font-condensed)', fontSize:'10px', fontWeight:700, letterSpacing:'1.5px', padding:'3px 12px', borderRadius:'20px', whiteSpace:'nowrap' }}>MOST POPULAR</div>}
              {isCurrent && <div style={{ position:'absolute', top:'12px', right:'12px', ...s.pill, background:plan.bg, color:plan.color }}>Current</div>}

              <div>
                <div style={{ ...s.planName, color:plan.color }}>{plan.name.toUpperCase()}</div>
                {plan.officers && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>Up to {plan.officers} officers · {plan.sites} sites</div>}
              </div>

              <div style={s.planPrice}>
                {plan.price > 0 ? (
                  <>
                    <div style={{ ...s.price, color:plan.color }}>${plan.price}</div>
                    <div style={s.pricePer}>{plan.priceUnit ? `/${plan.priceUnit}/mo` : `/${plan.period}`}</div>
                  </>
                ) : plan.price === 0 ? (
                  <div style={{ ...s.price, fontSize:'24px', color:plan.color }}>Free · {plan.period}</div>
                ) : (
                  <div style={{ ...s.price, fontSize:'24px', color:plan.color }}>Custom</div>
                )}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'8px', flex:1 }}>
                {plan.features.map((f,i) => (
                  <div key={i} style={s.feature}>
                    <Icon name="check" size={13} color={plan.color}/>
                    {f}
                  </div>
                ))}
              </div>

              <button
                style={{ ...s.btn, background: isCurrent?'var(--bg-surface)':plan.color, color: isCurrent?'var(--text-secondary)':plan.id==='enterprise'?'#fff':'var(--text-inverse)', opacity: checkingOut===plan.id?0.6:1, cursor: isCurrent?'default':'pointer', border: isCurrent?'1px solid var(--border)':'none' }}
                onClick={() => !isCurrent && startCheckout(plan)}
                disabled={isCurrent || checkingOut !== null}
              >
                {checkingOut===plan.id ? 'REDIRECTING...' : isCurrent ? 'CURRENT PLAN' : plan.price ? `UPGRADE TO ${plan.name.toUpperCase()}` : 'CONTACT SALES'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Recent invoices */}
      {invoices.length > 0 && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'20px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', fontFamily:'var(--font-condensed)', marginBottom:'14px' }}>Recent Invoices</div>
          {invoices.map(inv => {
            const stColor = inv.status==='paid'?'var(--color-success)':inv.status==='overdue'?'var(--color-danger)':'var(--color-warning)'
            const stBg    = inv.status==='paid'?'var(--color-success-bg)':inv.status==='overdue'?'var(--color-danger-bg)':'var(--color-warning-bg)'
            return (
              <div key={inv.id} style={s.histRow}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{inv.client_name} · {fmtDate(inv.created_at)}</div>
                </div>
                <div style={{ fontFamily:'var(--font-condensed)', fontWeight:700, color:'var(--text-primary)' }}>{fmtMoney(inv.total)}</div>
                <span style={{ ...s.pill, background:stBg, color:stColor }}>{inv.status?.toUpperCase()}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
