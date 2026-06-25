import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'
import { requestLocationPermission, getCurrentPosition } from '../../lib/locationPermission'
import { rolesAtOrAbove } from '../../config/roles'
import { isNative } from '../../lib/platform'
import { takePhoto } from '../../lib/cameraPermission'

async function haptic(type = 'medium') {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (type === 'heavy')   await Haptics.impact({ style: ImpactStyle.Heavy })
    else if (type === 'light') await Haptics.impact({ style: ImpactStyle.Light })
    else if (type === 'success') await Haptics.notification({ type: NotificationType.Success })
    else if (type === 'error')   await Haptics.notification({ type: NotificationType.Error })
    else if (type === 'warn')    await Haptics.notification({ type: NotificationType.Warning })
  } catch {}
}

const DEFAULT_GEOFENCE_RADIUS = 150

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function fmt12(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDuration(start, end) {
  const ms = new Date(end) - new Date(start)
  const hrs = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hrs}h ${mins}m`
}

const STEPS = { IDLE:'idle', LOADING:'loading', NO_SHIFT:'no_shift', READY_IN:'ready_in', PHOTO_IN:'photo_in', GPS_IN:'gps_in', GEOFENCE_WARN:'geofence_warn', CLOCKED_IN:'clocked_in', READY_OUT:'ready_out', PHOTO_OUT:'photo_out', GPS_OUT:'gps_out', COMPLETE:'complete' }

export default function ClockIn() {
  const { profile } = useAuth()
  const [step, setStep]           = useState(STEPS.LOADING)
  const [shift, setShift]         = useState(null)
  const [site, setSite]           = useState(null)
  const [timesheet, setTimesheet] = useState(null)
  const [photoIn, setPhotoIn]     = useState(null)
  const [photoOut, setPhotoOut]   = useState(null)
  const [location, setLocation]   = useState(null)
  const [distance, setDistance]   = useState(null)
  const [error, setError]         = useState(null)
  const [saving, setSaving]       = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [employeeId, setEmployeeId] = useState(null)
  const photoInRef      = useRef(null)
  const photoOutRef     = useRef(null)
  const locationTimerRef = useRef(null)

  // Periodic location update while clocked in
  useEffect(() => {
    if (step === STEPS.CLOCKED_IN && employeeId && profile?.company_id) {
      function sendLocation() {
        const geo = navigator.geolocation || (isNative() ? null : null)
        if (!geo) return
        geo.getCurrentPosition(pos => {
          supabase.from('employee_location').insert({
            company_id: profile.company_id,
            employee_id: employeeId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            recorded_at: new Date().toISOString(),
          }).catch(() => {})
        }, () => {}, { timeout: 8000, maximumAge: 30000 })
      }
      sendLocation()
      locationTimerRef.current = setInterval(sendLocation, 60000)
    }
    return () => { if (locationTimerRef.current) clearInterval(locationTimerRef.current) }
  }, [step, employeeId])

  useEffect(() => { init() }, [profile])

  async function init() {
    if (!profile?.company_id) return
    setStep(STEPS.LOADING); setError(null)
    const { data: empData } = await supabase.from('employee').select('id').eq('user_id', profile.id).eq('company_id', profile.company_id).single()
    if (!empData) { setStep(STEPS.NO_SHIFT); return }
    setEmployeeId(empData.id)
    const today = new Date()
    const startOfDay = new Date(today); startOfDay.setHours(0,0,0,0)
    const endOfDay   = new Date(today); endOfDay.setHours(23,59,59,999)
    const { data: openTs } = await supabase.from('timesheet').select('*, shift:shift_id(*)').eq('employee_id', empData.id).eq('company_id', profile.company_id).eq('status','pending').is('clock_out', null).gte('date', startOfDay.toISOString().split('T')[0]).maybeSingle()
    if (openTs) {
      setTimesheet(openTs)
      if (openTs.site_id) { const { data: sd } = await supabase.from('site').select('*').eq('id', openTs.site_id).single(); setSite(sd) }
      setShift(openTs.shift); setStep(STEPS.CLOCKED_IN); return
    }
    const { data: shiftData } = await supabase.from('shift').select('*').eq('employee_id', empData.id).eq('company_id', profile.company_id).eq('status','published').gte('start_time', startOfDay.toISOString()).lte('start_time', endOfDay.toISOString()).order('start_time').limit(1).maybeSingle()
    if (!shiftData) { setStep(STEPS.NO_SHIFT); return }
    setShift(shiftData)
    const { data: siteData } = await supabase.from('site').select('*').eq('id', shiftData.site_id).single()
    setSite(siteData); setStep(STEPS.READY_IN)
  }

  function handlePhotoCapture(file, type) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      if (type === 'in') { setPhotoIn(e.target.result); setStep(STEPS.GPS_IN); getGPS('in') }
      else { setPhotoOut(e.target.result); setStep(STEPS.GPS_OUT); getGPS('out') }
    }
    reader.readAsDataURL(file)
  }

  // Native iOS camera path — calls Capacitor Camera plugin
  async function handleNativeCamera(type) {
    const dataUrl = await takePhoto()
    if (!dataUrl) return // user cancelled or permission denied
    if (type === 'in') { setPhotoIn(dataUrl); setStep(STEPS.GPS_IN); getGPS('in') }
    else { setPhotoOut(dataUrl); setStep(STEPS.GPS_OUT); getGPS('out') }
  }

  async function getGPS(direction) {
    // On iOS native, request location permission first
    if (isNative()) {
      const granted = await requestLocationPermission()
      if (!granted) {
        setError('Location permission is required to clock in. Please enable location access in Settings > PostCommand.')
        setStep(direction==='in' ? STEPS.READY_IN : STEPS.READY_OUT)
        return
      }
    } else if (!navigator.geolocation) {
      setError('GPS not available on this device.')
      setStep(direction==='in' ? STEPS.READY_IN : STEPS.READY_OUT)
      return
    }

    try {
      const pos = await getCurrentPosition()
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date().toISOString() }
      setLocation(loc)
      if (site?.latitude && site?.longitude) {
        const dist = getDistance(loc.lat, loc.lng, Number(site.latitude), Number(site.longitude))
        const radius = Number(site.geofence_radius) || DEFAULT_GEOFENCE_RADIUS
        setDistance(Math.round(dist))
        if (dist > radius) {
          setStep(STEPS.GEOFENCE_WARN)
          supabase.from('clockin_violation').insert({ company_id: profile.company_id, employee_id: employeeId, site_id: site?.id ?? null, latitude: loc.lat, longitude: loc.lng, distance_meters: Math.round(dist), overridden: false }).then(()=>{},()=>{})
          return
        }
      }
      direction === 'in' ? clockIn(loc) : clockOut(loc)
    } catch (err) {
      const loc = { lat: null, lng: null, accuracy: null, timestamp: new Date().toISOString(), gps_error: err.message }
      setLocation(loc)
      direction === 'in' ? clockIn(loc) : clockOut(loc)
    }
  }async function uploadPhoto(dataUrl, filename) {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const { data, error } = await supabase.storage.from('timesheet-photos').upload(`${profile.company_id}/${filename}`, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) return null
      const { data: urlData } = supabase.storage.from('timesheet-photos').getPublicUrl(data.path)
      return urlData.publicUrl
    } catch { return null }
  }

  async function clockIn(loc, override=false, reason='') {
    haptic('heavy')
    setSaving(true); setError(null)
    try {
      const { data: empData } = await supabase.from('employee').select('id').eq('user_id', profile.id).eq('company_id', profile.company_id).single()
      const photoUrl = photoIn ? await uploadPhoto(photoIn, `${empData.id}-in-${Date.now()}.jpg`) : null
      const now = new Date()
      const { data: ts, error: tsErr } = await supabase.from('timesheet').insert({ company_id: profile.company_id, employee_id: empData.id, site_id: shift.site_id, shift_id: shift.id, date: now.toISOString().split('T')[0], clock_in: now.toISOString(), clock_in_location: loc, clock_in_photo_url: photoUrl, status: 'pending', device_type: 'web', notes: override ? `Geofence override: ${reason}. Distance: ${distance}m` : null }).select().single()
      if (tsErr) { haptic('error'); setError(tsErr.message); setSaving(false); return }
      haptic('success')
      setTimesheet(ts)
      if (override) {
        await supabase.from('notifications').insert({ company_id: profile.company_id, type: 'geofence_override', title: 'Geofence Override', message: `${profile.first_name} ${profile.last_name} clocked in ${distance}m outside geofence at ${site?.name}. Reason: ${reason}`, badge_key: 'open_incidents' }).then(()=>{},()=>{})
        await supabase.from('clockin_violation').insert({ company_id: profile.company_id, employee_id: empData.id, site_id: shift.site_id, shift_id: shift.id, latitude: loc.lat, longitude: loc.lng, distance_meters: distance, override_reason: reason, overridden: true }).then(()=>{},()=>{})
      }
      setStep(STEPS.CLOCKED_IN)
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  async function clockOut(loc) {
    if (!timesheet) return
    haptic('heavy')
    setSaving(true); setError(null)
    try {
      const photoUrl = photoOut ? await uploadPhoto(photoOut, `${timesheet.employee_id}-out-${Date.now()}.jpg`) : null
      const now = new Date()
      const totalHours = (now - new Date(timesheet.clock_in)) / 3600000
      const { error: tsErr } = await supabase.from('timesheet').update({ clock_out: now.toISOString(), clock_out_location: loc, clock_out_photo_url: photoUrl, total_hours: Number(totalHours.toFixed(2)), status: 'pending' }).eq('id', timesheet.id)
      if (tsErr) { haptic('error'); setError(tsErr.message); setSaving(false); return }
      haptic('success')
      supabase.functions.invoke('send-push', {
        body: { company_id: profile.company_id, type: 'timesheet_pending', title: 'Timesheet Awaiting Approval', body: 'A timesheet has been submitted for approval', target_roles: rolesAtOrAbove('lieutenant', profile.company?.custom_ranks) }
      }).catch(() => {})
      setStep(STEPS.COMPLETE)
    } catch(e) { setError(e.message) }
    setSaving(false)
  }

  function handleOverride() {
    if (!overrideReason.trim()) { setError('Please provide a reason.'); return }
    setError(null); clockIn(location, true, overrideReason)
  }

  const pBtnStyle = { width:'100%', height:'52px', background:'var(--accent)', border:'none', borderRadius:'var(--radius-md)', color:'var(--text-inverse)', fontFamily:'var(--font-display)', fontSize:'18px', letterSpacing:'2px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }
  const sBtnStyle = { width:'100%', height:'44px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-secondary)', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }

  return (
    <div style={{padding:'24px',maxWidth:'480px',margin:'0 auto'}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',letterSpacing:'2px',color:'var(--text-primary)',marginBottom:'24px',lineHeight:1}}>CLOCK IN / OUT</h2>
      {error&&<div style={{background:'var(--color-danger-bg)',border:'1px solid rgba(224,85,85,0.3)',borderRadius:'var(--radius-md)',padding:'12px 16px',fontSize:'13px',color:'var(--color-danger)',marginBottom:'16px',display:'flex',gap:'10px',alignItems:'flex-start'}}><Icon name="alert-circle" size={16}/><span>{error}</span></div>}

      {step===STEPS.LOADING&&<Card><div style={{textAlign:'center',padding:'32px',color:'var(--text-muted)',fontSize:'13px'}}><div style={{animation:'pulse 1.5s infinite',marginBottom:'12px'}}><Icon name="clock" size={32} color="var(--accent)"/></div>Checking your schedule...</div></Card>}
      {step===STEPS.NO_SHIFT&&<Card><div style={{textAlign:'center',padding:'32px'}}><Icon name="calendar" size={40} color="var(--border-subtle)"/><div style={{marginTop:'16px',fontSize:'16px',fontFamily:'var(--font-display)',letterSpacing:'1px',color:'var(--text-primary)'}}>NO SHIFT TODAY</div><div style={{marginTop:'8px',fontSize:'13px',color:'var(--text-muted)',lineHeight:1.5}}>No published shift found for today. Contact your supervisor.</div><button onClick={init} style={{marginTop:'20px',...sBtnStyle}}>REFRESH</button></div></Card>}
      {step===STEPS.READY_IN&&shift&&site&&<Card><SL>YOUR SHIFT</SL><ShiftSum shift={shift} site={site}/><div style={{marginTop:'24px'}}><button onClick={()=>{ if(isNative()){ setStep(STEPS.PHOTO_IN); handleNativeCamera('in') } else { setStep(STEPS.PHOTO_IN); setTimeout(()=>photoInRef.current?.click(),100) } }} style={pBtnStyle}><Icon name="log-in" size={18}/>CLOCK IN</button><p style={{fontSize:'12px',color:'var(--text-muted)',textAlign:'center',marginTop:'10px'}}>Photo required</p></div></Card>}
      {step===STEPS.PHOTO_IN&&<Card><SL>CLOCK-IN PHOTO</SL><div style={{textAlign:'center',padding:'24px 0'}}><Icon name="eye" size={40} color="var(--accent)"/><div style={{marginTop:'12px',fontSize:'14px',color:'var(--text-primary)',fontWeight:600}}>Take your clock-in photo</div></div><input ref={photoInRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handlePhotoCapture(e.target.files[0],'in')}/>{photoIn&&<div style={{marginBottom:'16px',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1px solid var(--border-subtle)'}}><img src={photoIn} alt="" style={{width:'100%',maxHeight:'200px',objectFit:'cover',display:'block'}}/></div>}<button onClick={()=>photoInRef.current?.click()} style={pBtnStyle}><Icon name="eye" size={18}/>{photoIn?'RETAKE':'OPEN CAMERA'}</button><button onClick={()=>setStep(STEPS.READY_IN)} style={{...sBtnStyle,marginTop:'8px'}}>CANCEL</button></Card>}
      {(step===STEPS.GPS_IN||step===STEPS.GPS_OUT)&&<Card><div style={{textAlign:'center',padding:'32px'}}><div style={{animation:'pulse 1.5s infinite'}}><Icon name="map-pin" size={40} color="var(--accent)"/></div><div style={{marginTop:'16px',fontSize:'14px',color:'var(--text-primary)',fontWeight:600}}>Getting your location...</div></div></Card>}
      {step===STEPS.GEOFENCE_WARN&&<Card>
        <div style={{background:'var(--color-warning-bg)',border:'1px solid rgba(232,148,58,0.3)',borderRadius:'var(--radius-md)',padding:'16px',marginBottom:'20px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
          <Icon name="alert-circle" size={20} color="var(--color-warning)"/>
          <div><div style={{fontSize:'14px',fontWeight:700,color:'var(--color-warning)',marginBottom:'4px'}}>OUTSIDE GEOFENCE</div><div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5}}>You are <strong>{distance}m</strong> from <strong>{site?.name}</strong>. Allowed: <strong>{Number(site?.geofence_radius)||DEFAULT_GEOFENCE_RADIUS}m</strong>.</div></div>
        </div>
        <SL>OVERRIDE REASON</SL>
        <textarea value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} placeholder="Explain why you are clocking in outside the geofence..." rows={3} style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',color:'var(--text-primary)',fontSize:'13px',resize:'vertical',lineHeight:1.5,boxSizing:'border-box',outline:'none',marginBottom:'16px'}}/>
        <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'16px',padding:'10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}><Icon name="bell" size={13} style={{verticalAlign:'middle',marginRight:'6px'}}/>Your supervisor will be notified</div>
        <button onClick={handleOverride} disabled={saving||!overrideReason.trim()} style={{...pBtnStyle,background:'var(--color-warning)',opacity:saving||!overrideReason.trim()?0.6:1}}>{saving?'CLOCKING IN...':'CLOCK IN WITH OVERRIDE'}</button>
        <button onClick={()=>setStep(STEPS.READY_IN)} style={{...sBtnStyle,marginTop:'8px'}}>CANCEL</button>
      </Card>}{step===STEPS.CLOCKED_IN&&timesheet&&<Card>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
          <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'var(--color-success-bg)',border:'1px solid rgba(58,170,106,0.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon name="check" size={22} color="var(--color-success)"/></div>
          <div><div style={{fontFamily:'var(--font-display)',fontSize:'20px',letterSpacing:'2px',color:'var(--color-success)'}}>ON DUTY</div><div style={{fontSize:'12px',color:'var(--text-muted)'}}>Clocked in at {fmt12(timesheet.clock_in)}</div></div>
        </div>
        {site&&<ShiftSum shift={shift} site={site}/>}
        <LiveTimer clockIn={timesheet.clock_in}/>
        <div style={{marginTop:'24px'}}>
          <button onClick={()=>{ if(isNative()){ setStep(STEPS.PHOTO_OUT); handleNativeCamera('out') } else { setStep(STEPS.PHOTO_OUT); setTimeout(()=>photoOutRef.current?.click(),100) } }} style={{...pBtnStyle,background:'var(--color-danger)'}}><Icon name="log-out" size={18}/>CLOCK OUT</button>
          <p style={{fontSize:'12px',color:'var(--text-muted)',textAlign:'center',marginTop:'10px'}}>Photo required</p>
        </div>
      </Card>}
      {step===STEPS.PHOTO_OUT&&<Card><SL>CLOCK-OUT PHOTO</SL><div style={{textAlign:'center',padding:'24px 0'}}><Icon name="eye" size={40} color="var(--color-danger)"/><div style={{marginTop:'12px',fontSize:'14px',color:'var(--text-primary)',fontWeight:600}}>Take your clock-out photo</div></div><input ref={photoOutRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handlePhotoCapture(e.target.files[0],'out')}/>{photoOut&&<div style={{marginBottom:'16px',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1px solid var(--border-subtle)'}}><img src={photoOut} alt="" style={{width:'100%',maxHeight:'200px',objectFit:'cover',display:'block'}}/></div>}<button onClick={()=>photoOutRef.current?.click()} style={{...pBtnStyle,background:'var(--color-danger)'}}><Icon name="eye" size={18}/>{photoOut?'RETAKE':'OPEN CAMERA'}</button><button onClick={()=>setStep(STEPS.CLOCKED_IN)} style={{...sBtnStyle,marginTop:'8px'}}>CANCEL</button></Card>}
      {step===STEPS.COMPLETE&&timesheet&&<Card>
        <div style={{textAlign:'center',padding:'16px 0 24px'}}>
          <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'var(--accent-bg)',border:'1px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Icon name="check" size={28} color="var(--accent)"/></div>
          <div style={{fontFamily:'var(--font-display)',fontSize:'24px',letterSpacing:'2px',color:'var(--text-primary)',marginBottom:'8px'}}>SHIFT COMPLETE</div>
          <div style={{fontSize:'13px',color:'var(--text-muted)'}}>Timesheet submitted for review</div>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
          <R label="Clock In" value={fmt12(timesheet.clock_in)}/>
          <R label="Clock Out" value={fmt12(new Date().toISOString())}/>
          <R label="Total Time" value={fmtDuration(timesheet.clock_in, new Date().toISOString())} bold/>
          {site&&<R label="Site" value={site.name}/>}
        </div>
        <button onClick={init} style={{...sBtnStyle,marginTop:'20px'}}>DONE</button>
      </Card>}
      <div style={{marginTop:'16px',fontSize:'11px',color:'var(--text-muted)',textAlign:'center'}}>Timesheet photos are securely stored</div>
    </div>
  )
}

function LiveTimer({ clockIn }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    function update() {
      const ms = new Date() - new Date(clockIn)
      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000)
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update(); const id=setInterval(update,1000); return ()=>clearInterval(id)
  }, [clockIn])
  return <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'16px',textAlign:'center',marginTop:'16px'}}><div style={{fontSize:'11px',color:'var(--text-muted)',letterSpacing:'1px',fontFamily:'var(--font-condensed)',textTransform:'uppercase',marginBottom:'6px'}}>Time on Duty</div><div style={{fontFamily:'var(--font-display)',fontSize:'36px',letterSpacing:'4px',color:'var(--color-success)',lineHeight:1}}>{elapsed}</div></div>
}

function ShiftSum({ shift, site }) {
  return <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',padding:'14px 16px',display:'flex',flexDirection:'column',gap:'8px'}}><R label="Site" value={site?.name}/><R label="Start" value={fmt12(shift?.start_time)}/><R label="End" value={fmt12(shift?.end_time)}/>{shift?.is_armed&&<div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--accent)'}}><Icon name="shield" size={14} color="var(--accent)"/>Armed Post</div>}</div>
}

function Card({ children }) {
  return <div style={{background:'var(--bg-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'20px',boxShadow:'var(--shadow-card)'}}>{children}</div>
}

function SL({ children }) {
  return <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1.5px',fontFamily:'var(--font-condensed)',marginBottom:'10px'}}>{children}</div>
}

function R({ label, value, bold }) {
  if (!value) return null
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px'}}><span style={{color:'var(--text-muted)'}}>{label}</span><span style={{color:bold?'var(--accent)':'var(--text-primary)',fontWeight:bold?700:500,textAlign:'right',maxWidth:'65%'}}>{value}</span></div>
}