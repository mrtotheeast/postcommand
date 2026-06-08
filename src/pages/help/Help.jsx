import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getRoleLevel, FEATURE_ACCESS, ROLE_LABELS } from '../../config/roles'
import Icon from '../../components/ui/Icon'

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'zap',
    content: [
      { q: 'How do I add an employee?', a: 'Go to Personnel → click "ADD EMPLOYEE". Fill in name, email, role, and position. The employee is added immediately without app access. You can invite them to the app after they\'re created.' },
      { q: 'How do I invite an employee to the app?', a: 'In Personnel, click an employee card to open their profile. On the Overview tab, click "INVITE TO APP". This sends an email with a link to set up their account. The employee must confirm their email to gain access.' },
      { q: 'How do I set up company branding?', a: 'Go to Settings → Company Profile. Enter your company name, upload a logo URL, and set your primary color. Changes save immediately and apply across the app.' },
      { q: 'What roles are available?', a: 'Officer (Level 1), Corporal (Level 2), Sergeant (Level 3), Lieutenant (Level 4), Chief (Level 5), plus HR, Accounting, Office Staff, and Client. Each role has different access levels. See Settings → Team & Roles → Roles & Permissions for the full matrix.' },
    ]
  },
  {
    id: 'scheduling',
    title: 'Scheduling',
    icon: 'calendar',
    content: [
      { q: 'How do I create a shift?', a: 'Go to Scheduling and click "NEW SHIFT". Select the employee, site, date, start time, and end time. You can create multiple shifts at once using the bulk view.' },
      { q: 'How do I publish a schedule?', a: 'Once shifts are drafted, click "PUBLISH" to notify employees. Published shifts appear on their dashboard and they receive a notification.' },
      { q: 'Can I copy last week\'s schedule?', a: 'Yes — in Scheduling, use the "COPY WEEK" button to duplicate all shifts from the previous week to the current week. Then adjust as needed before publishing.' },
      { q: 'What is Auto-Assign?', a: 'Auto-Assign fills open shifts based on employee availability, site requirements, and existing schedules. Sergeants and above can run it from the Scheduling page.' },
    ]
  },
  {
    id: 'payroll',
    title: 'Pay Period & Payroll Export',
    icon: 'dollar-sign',
    content: [
      { q: 'How does the pay period work?', a: 'The default pay period is weekly (Monday–Sunday). A banner at the top of the Timesheets page shows the current period dates, total approved hours, and close/no-show controls.' },
      { q: 'How do I close a pay period?', a: 'Lieutenant+ can click "CLOSE PERIOD" on the Timesheets page. This marks all approved timesheets in the current week as "closed" and locks them from further edits. This is required before payroll export.' },
      { q: 'What triggers overtime?', a: 'Hours over 40 in a single week are automatically calculated as overtime in payroll exports. Regular hours are capped at 40; excess goes into the OT Hours column.' },
    ]
  },
  {
    id: 'csv-employees',
    title: 'Adding Employees via CSV',
    icon: 'upload',
    content: [
      { q: 'What format does the CSV need to be?', a: 'The first row must be a header. Required columns: first_name, last_name. Optional: email, phone_number, role, position_title, status, employment_type.' },
      { q: 'What are valid role values?', a: 'officer, corporal, sergeant, lieutenant, chief, hr, accounting, office_staff, client. Any unrecognized value defaults to "officer".' },
      { q: 'What are valid status values?', a: 'active, inactive, terminated, probation. Defaults to "active" if not provided.' },
      { q: 'How do I download a template?', a: 'In Personnel, click "IMPORT CSV" then download the sample template. Open it in Excel or Google Sheets, fill in your data, and re-upload.' },
    ]
  },
  {
    id: 'csv-sites',
    title: 'Adding Job Sites via CSV',
    icon: 'map',
    content: [
      { q: 'What columns does a site CSV need?', a: 'Required: name. Optional: address, city, state, zip, client_name, contact_name, contact_phone, contact_email, latitude, longitude, geofence_radius (in meters).' },
      { q: 'Where do I upload site CSVs?', a: 'Go to Site Management → click "IMPORT CSV". The importer previews the first 10 rows before you confirm the import.' },
      { q: 'What is geofence_radius?', a: 'The radius (in meters) within which officers must be to clock in at that site. Default is 150m. Minimum is 10m. Set to 0 to disable geofencing for a site.' },
    ]
  },
  {
    id: 'qr-codes',
    title: 'QR Code Setup',
    icon: 'map-pin',
    content: [
      { q: 'What are QR codes used for?', a: 'PostCommand uses QR codes for site check-in (verifying an officer physically visited a checkpoint) and equipment tracking (checking items in and out of inventory).' },
      { q: 'How do I generate a site QR code?', a: 'In Site Management, open a site and click "QR CODE". The QR encodes the site ID. Print it and post it at the physical location.' },
      { q: 'How do I generate equipment QR codes?', a: 'In Equipment & Uniforms → Inventory tab, click "QR CODE" next to any inventory item. This opens a print dialog with the item\'s QR code and name.' },
      { q: 'How do officers scan QR codes?', a: 'In the native iOS app, go to Equipment & Uniforms → QR Scanner. Use the camera to scan. On the web app, use the manual lookup field and paste the item ID from the QR code.' },
    ]
  },
  {
    id: 'incidents',
    title: 'Incident Reports',
    icon: 'file-check',
    content: [
      { q: 'How do I file an incident report?', a: 'Go to Incident Reports → "NEW REPORT". Choose "AI Guided" mode to answer structured questions and have Claude write your narrative, or "Write Directly" to compose it yourself.' },
      { q: 'What is "Polish with AI"?', a: 'After writing your narrative, click "AI POLISH" to have Claude rewrite it in formal, professional law enforcement style. Your original draft is replaced — always review before submitting.' },
      { q: 'What is a CAD number?', a: 'CAD (Computer-Aided Dispatch) numbers are assigned automatically when you submit a report. The format is YYMM-NNNNN (e.g., 2606-00001 for the first report in June 2026).' },
      { q: 'How does the approval flow work?', a: 'Officers submit reports → Sergeants review → Lieutenants approve. Each step can add notes. Approved reports are locked from editing. Chiefs can void any report with a reason.' },
      { q: 'How long are reports retained?', a: 'All incident reports are retained for 3 years from the incident date. The retain_until date is set automatically on submission.' },
    ]
  },
  {
    id: 'training',
    title: 'Training',
    icon: 'book-open',
    content: [
      { q: 'How do I create a training course?', a: 'Go to Training → Course Library → "NEW COURSE". Enter a title, description, category, and add content modules. Set the course to "Active" when ready to assign.' },
      { q: 'How do I assign training to employees?', a: 'Open a course and click "ASSIGN". Select individual employees or assign to all active employees. Set a due date and the assignment appears on the employee\'s "My Training" tab.' },
      { q: 'Can I build training with AI?', a: 'Yes — when creating a new course, click "AI BUILD" to have Claude generate course content from a topic description. Review and edit the generated content before saving.' },
      { q: 'How do I track completion?', a: 'Go to Training → Assignments to see completion status for all employees. Filter by employee, course, or status (Pending, In Progress, Completed, Overdue).' },
      { q: 'What is the AI Suggestions tab?', a: 'In Training → AI Suggestions, click "GENERATE AI SUGGESTIONS" to get 4 recommended courses based on your current training completion data and incident history. Requires the ai-assistant edge function to be deployed.' },
    ]
  },
]

export default function Help() {
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState({})

  const filtered = search.trim()
    ? SECTIONS.map(sec => ({
        ...sec,
        content: sec.content.filter(item =>
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(sec => sec.content.length > 0)
    : SECTIONS

  function toggle(secId, idx) {
    const key = `${secId}-${idx}`
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const level = getRoleLevel(profile?.role)
  const myFeatures = Object.entries(FEATURE_ACCESS).filter(([,f]) => f.minLevel <= level).map(([k,f]) => ({ key:k, ...f }))

  return (
    <div style={{ padding:'24px', maxWidth:'820px', animation:'fadeIn 200ms ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'28px', letterSpacing:'2px', color:'var(--text-primary)', lineHeight:1, marginBottom:'4px' }}>HELP CENTER</h2>
      <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' }}>Answers to common questions about PostCommand.</p>

      {/* Tour launcher */}
      <div style={{ background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-md)', padding:'16px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, color:'var(--accent)', letterSpacing:'1px', marginBottom:'3px' }}>GUIDED TOUR</div>
          <div style={{ fontSize:'12px', color:'var(--text-secondary)' }}>Interactive tour of key features for your access level. Takes about 60 seconds.</div>
        </div>
        <button onClick={() => window.dispatchEvent(new Event('start-tour'))} style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 18px', height:'40px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', flexShrink:0 }}>
          <Icon name="play-circle" size={15}/>LAUNCH TOUR
        </button>
      </div>

      {/* My features */}
      {profile && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'18px 20px', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, color:'var(--text-primary)', letterSpacing:'1px' }}>YOUR FEATURES</div>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{ROLE_LABELS[profile.role]||profile.role} · {myFeatures.length} features available</div>
            </div>
            <a href="/features" target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--accent)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px', textDecoration:'none' }}>
              VIEW FULL GUIDE →
            </a>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {myFeatures.map(f => (
              <span key={f.key} style={{ fontSize:'11px', color:'var(--text-secondary)', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'3px 10px' }}>{f.description}</span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position:'relative', marginBottom:'28px' }}>
        <Icon name="search" size={16} color="var(--text-muted)" style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
        <input
          type="search"
          placeholder="Search help topics..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'12px 14px 12px 42px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
          onFocus={e => e.target.style.borderColor='var(--border-focus)'}
          onBlur={e => e.target.style.borderColor='var(--border-subtle)'}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
          <Icon name="search" size={32} color="var(--border-subtle)"/>
          <div style={{ marginTop:'12px', fontSize:'15px' }}>No results for "{search}"</div>
        </div>
      )}

      {filtered.map(sec => (
        <div key={sec.id} style={{ marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', padding:'0 0 10px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'var(--radius-sm)', background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name={sec.icon} size={14} color="var(--accent)"/>
            </div>
            <div style={{ fontFamily:'var(--font-condensed)', fontSize:'12px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:700 }}>{sec.title}</div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {sec.content.map((item, i) => {
              const key = `${sec.id}-${i}`
              const isOpen = open[key]
              return (
                <div key={i} style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                  <button
                    onClick={() => toggle(sec.id, i)}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'14px 16px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
                  >
                    <span style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)', lineHeight:1.4 }}>{item.q}</span>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color="var(--text-muted)"/>
                  </button>
                  {isOpen && (
                    <div style={{ padding:'0 16px 16px', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.7, borderTop:'1px solid var(--border)' }}>
                      <div style={{ paddingTop:'12px' }}>{item.a}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ marginTop:'32px', padding:'18px 20px', background:'var(--accent-bg)', border:'1px solid var(--accent-border)', borderRadius:'var(--radius-md)', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6 }}>
        <strong style={{ color:'var(--accent)', fontFamily:'var(--font-condensed)', letterSpacing:'0.5px' }}>NEED MORE HELP?</strong><br />
        Contact NPS support: <a href="mailto:nationwide.police.services@gmail.com" style={{ color:'var(--accent)' }}>nationwide.police.services@gmail.com</a> or visit <a href="https://www.nationwidepolice.com" target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>nationwidepolice.com</a>
      </div>
    </div>
  )
}
