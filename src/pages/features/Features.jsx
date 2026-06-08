import { useState } from 'react'

const LEVEL_COLORS = { 0:'#8899aa', 1:'#8899aa', 2:'#5b9fe0', 3:'#3aaa6a', 4:'#c8a84b', 5:'#e05555', 6:'#e05555' }
const LEVEL_LABELS = { 1:'Officer / All Staff', 2:'Corporal / Lead', 3:'Sergeant / Supervisor', 4:'Lieutenant / Manager+', 5:'Chief / Admin+', 6:'Super Admin' }

const CATEGORIES = [
  {
    id:'workforce', title:'Workforce Management', icon:'👥',
    features:[
      { name:'Employee Directory', desc:'Full employee roster with profiles, credentials, and contact info. Search by name, role, or site.', minLevel:3, highlights:['Role-based access','Credential tracking','Document storage','Training records','Change log'] },
      { name:'App Invitations', desc:'Invite employees to PostCommand with branded email. Secure tokenized links, resend capability, and bulk invite.', minLevel:4, highlights:['Branded invite emails','Resend capability','Bulk invite','Invitation status tracking'] },
      { name:'Employee Profiles', desc:'9-tab profiles covering credentials, training, PTO, uniforms, pay stubs, and a full change log.', minLevel:3, highlights:['9 profile tabs','Credential expiry alerts','Change log history','Pay stubs via Gusto'] },
      { name:'Photo Approvals', desc:'Officers can upload profile photos from the app. Admins approve or reject before the photo goes live.', minLevel:4, highlights:['Bulk approve','Reject with reason','Photo storage in Supabase'] },
    ]
  },
  {
    id:'scheduling', title:'Scheduling', icon:'📅',
    features:[
      { name:'Shift Scheduling', desc:'Create, manage, and publish shifts. Officers receive notifications when new schedules go live.', minLevel:3, highlights:['Drag-and-drop scheduling','Weekly / daily views','Auto-assign by availability','Shift swap requests'] },
      { name:'Clock In / Out', desc:'GPS-verified clock in and out at assigned posts. Geofence radius configurable per site (min 10m).', minLevel:1, highlights:['GPS geofence verification','Clock-in photo','Geofence override with reason','Supervisor notification on override'] },
      { name:'Timesheet Review', desc:'Review, approve, and export timesheets. Close pay periods and mark no-shows.', minLevel:3, highlights:['Approve / reject per timesheet','Pay period close flow','No-show all','CSV & PDF export'] },
    ]
  },
  {
    id:'field', title:'Field Operations', icon:'🚨',
    features:[
      { name:'Incident Reports', desc:'File detailed incident reports with AI-assisted narrative writing. Full approval workflow.', minLevel:1, highlights:['AI narrative writing','Multi-field form','Suspect details','Emergency services fields','CAD number auto-assigned'] },
      { name:'SOS Emergency Alert', desc:'Hold SOS button for 3 seconds to trigger an immediate alert with GPS location to supervisors.', minLevel:1, highlights:['GPS location sharing','Immediate supervisor notification','Audio + haptic alert','30-second cancel window'] },
      { name:'Patrol Logs', desc:'Log patrol sessions with QR checkpoint scanning. Route playback and completion stats for supervisors.', minLevel:1, highlights:['QR checkpoint scanning','Route recording','Completion percentage','Missed checkpoint flags'] },
      { name:'Live Map', desc:'Real-time map showing all on-duty officers across all sites with GPS position updates every 60 seconds.', minLevel:4, highlights:['Real-time GPS updates','Site geofence display','On-duty / off-duty status','Last update timestamp'] },
    ]
  },
  {
    id:'compliance', title:'Compliance & Audit', icon:'📋',
    features:[
      { name:'Employee Change Log', desc:'Every change to an employee record is logged: who changed what, from what, to what, and when.', minLevel:3, highlights:['24-month rolling history','Pay change tracking','Status change tracking','Supervisor visibility by assignment'] },
      { name:'AI Audit Report', desc:'Generate AI-powered compliance audit reports from change log data. Export to PDF.', minLevel:4, highlights:['Date range filters','Pay change summary','Status change summary','AI-generated flags and recommendations'] },
      { name:'Supervisor Assignment', desc:'Assign employees to supervisors. Sergeants and Corporals see only their assigned employees in reports.', minLevel:4, highlights:['Per-supervisor employee lists','Change log visibility control'] },
      { name:'Credential Management', desc:'Track all employee licenses and certifications with expiry monitoring and automated reminders.', minLevel:3, highlights:['Expiry alerts','Guard cards, firearms, CPR','60-day advance warning','Automated reminder emails'] },
    ]
  },
  {
    id:'payroll', title:'Payroll & Finance', icon:'💰',
    features:[
      { name:'Gusto Integration', desc:'Connect your Gusto account to run payroll directly from PostCommand. Hours sync from approved timesheets.', minLevel:4, highlights:['OAuth secure connection','Hours sync from timesheets','Submit payroll to Gusto','Pay stub viewer per employee'] },
      { name:'Payroll CSV Export', desc:'Export approved timesheet hours as CSV for import into your payroll provider.', minLevel:3, highlights:['CSV export','OT calculation (over 40 hours)','Per pay period export','Google Sheets export'] },
      { name:'Invoicing', desc:'Create, send, and track client invoices. Per-site billing with line items, tax, and PDF export.', minLevel:4, highlights:['Invoice PDF generation','Client email with branded header','Overdue tracking','Send payment nudge'] },
    ]
  },
  {
    id:'ai', title:'AI Features', icon:'🤖',
    features:[
      { name:'AI Incident Writing', desc:'Officers answer guided questions; Claude writes a formal, professional narrative in law enforcement style.', minLevel:1, highlights:['Guided Q&A mode','Professional law enforcement style','POLISH button to refine','Runs via Supabase edge function'] },
      { name:'AI Training Suggestions', desc:'Claude analyzes your training completion data and suggests courses the team should prioritize.', minLevel:4, highlights:['Based on completion rates','Based on incident history','4 prioritized suggestions','High / Medium / Low priority'] },
      { name:'AI Audit Report', desc:'Claude generates a compliance audit report from your employee change log with flags and recommendations.', minLevel:4, highlights:['Executive summary','Pay rate change analysis','Status change timeline','Compliance flags'] },
      { name:'AI Policy Summarizer', desc:'Upload policy documents; Claude generates a plain-language summary for employee communication.', minLevel:4, highlights:['PDF and text input','Plain language summary','Stored with policy record'] },
    ]
  },
]

function LevelBadge({ minLevel }) {
  const color = LEVEL_COLORS[minLevel] || '#8899aa'
  const label = LEVEL_LABELS[minLevel] || 'All users'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:700, color, background:`${color}18`, border:`1px solid ${color}44`, borderRadius:'20px', padding:'2px 10px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

export default function Features() {
  const [activeId, setActiveId] = useState('workforce')

  return (
    <div style={{ minHeight:'100vh', background:'#ffffff', fontFamily:'Barlow, sans-serif', color:'#0d0f14' }}>
      {/* Header */}
      <div style={{ background:'#0d0f14', padding:'20px 40px', display:'flex', alignItems:'center', gap:'16px', borderBottom:'2px solid #c8a84b' }}>
        <a href="/" style={{ textDecoration:'none' }}>
          <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'28px', letterSpacing:'3px', color:'#fff' }}>
            POST<span style={{ color:'#c8a84b' }}>COMMAND</span>
          </div>
        </a>
        <div style={{ flex:1 }}/>
        <a href="/login" style={{ display:'inline-flex', alignItems:'center', background:'#c8a84b', color:'#0d0f14', padding:'0 20px', height:'40px', borderRadius:'8px', fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, letterSpacing:'1px', textDecoration:'none', fontSize:'14px' }}>SIGN IN</a>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'40px 24px', display:'flex', gap:'32px', alignItems:'flex-start' }}>
        {/* Sticky sidebar */}
        <div style={{ width:'180px', flexShrink:0, position:'sticky', top:'80px' }}>
          <div style={{ fontSize:'11px', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'2px', color:'#888', textTransform:'uppercase', marginBottom:'12px' }}>Features</div>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={()=>setActiveId(cat.id)}
              style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'6px', border:'none', cursor:'pointer', fontFamily:'Barlow, sans-serif', fontSize:'13px', background:activeId===cat.id?'#f0f4ff':'transparent', color:activeId===cat.id?'#2563eb':'#374151', fontWeight:activeId===cat.id?600:400, marginBottom:'2px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>{cat.icon}</span>{cat.title}
            </button>
          ))}
          <div style={{ marginTop:'24px', padding:'16px', background:'#fafafa', borderRadius:'8px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, letterSpacing:'1px', color:'#c8a84b', marginBottom:'6px', fontSize:'12px' }}>ACCESS LEVELS</div>
            {Object.entries(LEVEL_LABELS).filter(([k])=>k!=='0').map(([level, label])=>(
              <div key={level} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px', fontSize:'11px', color:'#555' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:LEVEL_COLORS[level], flexShrink:0 }}/>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'40px', letterSpacing:'3px', color:'#0d0f14', marginBottom:'8px' }}>POSTCOMMAND FEATURES</h1>
          <p style={{ fontSize:'15px', color:'#666', marginBottom:'40px', lineHeight:1.6 }}>
            Complete workforce management for licensed security companies. Every feature built specifically for the security industry.
          </p>

          {CATEGORIES.map(cat => (
            <div key={cat.id} id={cat.id} style={{ marginBottom:'48px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', paddingBottom:'12px', borderBottom:'2px solid #e5e7eb' }}>
                <span style={{ fontSize:'24px' }}>{cat.icon}</span>
                <h2 style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'28px', letterSpacing:'2px', color:'#0d0f14', margin:0 }}>{cat.title}</h2>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
                {cat.features.map(f => (
                  <div key={f.name} style={{ background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'20px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', marginBottom:'8px' }}>
                      <div style={{ fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, fontSize:'16px', letterSpacing:'0.5px', color:'#0d0f14' }}>{f.name}</div>
                      <LevelBadge minLevel={f.minLevel}/>
                    </div>
                    <p style={{ fontSize:'13px', color:'#555', lineHeight:1.6, marginBottom:'12px' }}>{f.desc}</p>
                    <ul style={{ margin:0, paddingLeft:'16px', display:'flex', flexDirection:'column', gap:'4px' }}>
                      {f.highlights.map(h => <li key={h} style={{ fontSize:'12px', color:'#777' }}>{h}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background:'#0d0f14', padding:'32px 40px', textAlign:'center', marginTop:'40px' }}>
        <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:'24px', letterSpacing:'3px', color:'#fff', marginBottom:'8px' }}>
          POST<span style={{ color:'#c8a84b' }}>COMMAND</span>
        </div>
        <p style={{ color:'#888', fontSize:'13px', marginBottom:'16px' }}>Security Workforce Management · Powered by Nationwide Police Services LLC</p>
        <div style={{ display:'flex', gap:'20px', justifyContent:'center', flexWrap:'wrap' }}>
          {[['Sign In','/login'],['Privacy Policy','/privacy'],['Terms of Service','/terms'],['Support','/support']].map(([label,href])=>(
            <a key={href} href={href} style={{ color:'#c8a84b', fontSize:'13px', textDecoration:'none', fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.5px' }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
