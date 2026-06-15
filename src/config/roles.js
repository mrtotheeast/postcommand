// ── Core role constants ────────────────────────────────────────────────────────

export const ROLES = { SUPER_ADMIN:'super_admin', CHIEF:'chief', LIEUTENANT:'lieutenant', SERGEANT:'sergeant', CORPORAL:'corporal', OFFICER:'officer', HR:'hr', ACCOUNTING:'accounting', OFFICE_STAFF:'office_staff', CLIENT:'client' }

// Numeric access levels — drives all permission gates (keep existing scale for compatibility)
export const ROLE_LEVELS = { super_admin:6, chief:5, lieutenant:4, sergeant:3, corporal:2, officer:1, hr:1, accounting:1, office_staff:1, client:0 }

// Human-readable role labels
export const ROLE_LABELS = { super_admin:'Chief App Admin', chief:'Chief', lieutenant:'Lieutenant', sergeant:'Sergeant', corporal:'Corporal', officer:'Officer', hr:'HR', accounting:'Accounting', office_staff:'Office Staff', client:'Client' }

// Display title styles — read from company.role_style
export const ROLE_TITLES = {
  military: {
    6: 'Super Admin',
    5: 'Chief',
    4: 'Lieutenant',
    3: 'Sergeant',
    2: 'Corporal',
    1: 'Officer',
    0: 'Client',
  },
  standard: {
    6: 'Super Admin',
    5: 'Admin',
    4: 'Manager',
    3: 'Supervisor',
    2: 'Lead',
    1: 'Employee',
    0: 'Client',
  },
}

// ── Helper functions ───────────────────────────────────────────────────────────

export function getRoleLevel(role) { return ROLE_LEVELS[role] ?? 1 }

// meetsLevel: accepts both string role names and numeric minLevel
export function meetsLevel(role, minLevel) {
  if (typeof minLevel === 'string') minLevel = ROLE_LEVELS[minLevel] ?? 1
  return getRoleLevel(role) >= minLevel
}

// Backward-compatible alias — all existing atLeast(role, 'role') calls keep working
export function atLeast(role, minRole) {
  const min = typeof minRole === 'string' ? (ROLE_LEVELS[minRole] ?? 1) : minRole
  return (ROLE_LEVELS[role] ?? 0) >= min
}

// Get display title for a role given company style and optional overrides
export function getRoleTitle(role, style = 'military', customTitles = {}) {
  const level = getRoleLevel(role)
  return customTitles[role] || customTitles[level] || ROLE_TITLES[style]?.[level] || ROLE_LABELS[role] || role
}

// Check if user has a specific named permission (falls back to role level)
export function hasPermission(profile, permissionKey) {
  if (!profile) return false
  if (getRoleLevel(profile.role) >= 5) return true  // super_admin has everything
  if (getRoleLevel(profile.role) >= 4 && profile.role !== 'client') return true  // chief has everything
  return profile.custom_permissions?.[permissionKey] === true
}

// ── Permission keys for per-person overrides ──────────────────────────────────

export const PERMISSION_KEYS = {
  'can_view_reports':       { label:'View Reports',        minGrantLevel:4 },
  'can_approve_timesheets': { label:'Approve Timesheets',  minGrantLevel:4 },
  'can_manage_schedules':   { label:'Manage Schedules',    minGrantLevel:3 },
  'can_view_personnel':     { label:'View Personnel',      minGrantLevel:3 },
  'can_edit_personnel':     { label:'Edit Personnel',      minGrantLevel:4 },
  'can_view_incidents':     { label:'View All Incidents',  minGrantLevel:3 },
  'can_manage_billing':     { label:'Manage Billing',      minGrantLevel:4 },
  'can_manage_sites':       { label:'Manage Sites',        minGrantLevel:3 },
  'can_export_data':        { label:'Export Data',         minGrantLevel:3 },
  'can_send_invites':       { label:'Send Invites',        minGrantLevel:3 },
  'can_view_audit_log':     { label:'View Audit Log',      minGrantLevel:4 },
  'can_run_payroll':        { label:'Run Payroll',         minGrantLevel:4 },
}

// ── Feature access map ────────────────────────────────────────────────────────

export const FEATURE_ACCESS = {
  dashboard:        { minLevel:1, description:'View your personal dashboard' },
  schedule_view:    { minLevel:1, description:'View your assigned schedule' },
  clock_in:         { minLevel:1, description:'Clock in and out of shifts' },
  incidents_file:   { minLevel:1, description:'File incident reports' },
  sos:              { minLevel:1, description:'Trigger SOS emergency alert' },
  patrol:           { minLevel:1, description:'Log patrol checkpoints' },
  messaging:        { minLevel:1, description:'Send and receive messages' },
  pto_request:      { minLevel:1, description:'Submit PTO requests' },
  uniforms_request: { minLevel:1, description:'Submit uniform requests' },
  training_view:    { minLevel:1, description:'View and complete training courses' },
  incidents_review: { minLevel:2, description:'Review and approve incident reports' },
  timesheet_view:   { minLevel:2, description:'View team timesheets' },
  schedule_manage:  { minLevel:3, description:'Create and manage schedules' },
  timesheets:       { minLevel:3, description:'Approve timesheets and close pay periods' },
  personnel_view:   { minLevel:3, description:'View employee profiles and credentials' },
  reports:          { minLevel:3, description:'Access reports and analytics' },
  live_map:         { minLevel:1, description:'View real-time officer locations' },
  personnel_edit:   { minLevel:4, description:'Edit employee records and status' },
  personnel_invite: { minLevel:4, description:'Invite employees to the app' },
  hr_management:    { minLevel:4, description:'Manage HR documents and onboarding' },
  billing:          { minLevel:4, description:'Manage billing and subscription' },
  settings:         { minLevel:4, description:'Manage company settings' },
  audit_log:        { minLevel:4, description:'View system audit log' },
  payroll:          { minLevel:4, description:'Run payroll via Gusto' },
  super_admin:      { minLevel:6, description:'Platform-wide administration' },
}

// ── Navigation ─────────────────────────────────────────────────────────────────

export const NAV_ITEMS = [
  { section:'Operations', items:[
    { id:'dashboard', label:'Dashboard', path:'/dashboard', icon:'grid', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff','client'] },
    { id:'training', label:'Training', path:'/training', icon:'book-open', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','office_staff'] },
    { id:'personnel', label:'Personnel', path:'/personnel', icon:'users', roles:['super_admin','chief','lieutenant','sergeant','hr','office_staff'] },
    { id:'scheduling', label:'Scheduling', path:'/scheduling', icon:'calendar', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
    { id:'open-shifts', label:'Open Shifts', path:'/open-shifts', icon:'calendar', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer'] },
    { id:'timesheets', label:'Timesheets', path:'/timesheets', icon:'clock', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting'] },
    { id:'incidents', label:'Incident Reports', path:'/incidents', icon:'file-check', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr'] },
    { id:'dar',       label:'Activity Reports', path:'/dar',       icon:'file-text', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','client'] },
    { id:'inbox',     label:'Inbox',            path:'/inbox',     icon:'mail',      roles:['client'] },
  ]},
  { section:'Field', items:[
    { id:'map', label:'Live Map', path:'/map', icon:'map-pin', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
    { id:'patrol', label:'Patrol Logs', path:'/patrol', icon:'activity', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer'] },
    { id:'clockin', label:'Clock In / Out', path:'/clockin', icon:'log-in', roles:['sergeant','corporal','officer','office_staff'] },
    { id:'sos', label:'SOS', path:'/sos', icon:'alert-triangle', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
  ]},
  { section:'Admin', items:[
    { id:'sites', label:'Site Management', path:'/sites', icon:'map', roles:['super_admin','chief','lieutenant','office_staff'] },
    { id:'company-settings', label:'Company Settings', path:'/settings/company', icon:'settings', roles:['super_admin','chief'] },
    { id:'hr', label:'HR & Documents', path:'/hr', icon:'star', roles:['super_admin','chief','lieutenant','hr','office_staff'] },
    { id:'invoices', label:'Invoices', path:'/invoices', icon:'credit-card', roles:['super_admin','chief','accounting'] },
    { id:'payroll',  label:'Payroll',  path:'/payroll',  icon:'dollar-sign', roles:['super_admin','chief','lieutenant','accounting'] },
    { id:'uniforms', label:'Uniforms', path:'/uniforms', icon:'shield', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
    { id:'reports',  label:'Reports',  path:'/reports',  icon:'bar-chart-2', roles:['super_admin','chief','lieutenant','hr','accounting'] },
    { id:'messaging', label:'Messaging', path:'/messaging', icon:'message-circle', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
    { id:'archived', label:'Archived',  path:'/archived', icon:'archive',     roles:['super_admin','chief'] },
    { id:'billing',  label:'Billing',  path:'/billing',  icon:'credit-card', roles:['super_admin'], hideOnNative:true },
    { id:'admin',    label:'Platform',  path:'/admin',    icon:'globe',       roles:['super_admin'] },
    { id:'audit',    label:'Audit Log', path:'/audit',    icon:'archive',     roles:['super_admin','chief'] },
    { id:'more',     label:'More',     path:'/more',     icon:'grid',    roles:['super_admin','chief'] },
    { id:'reviews',  label:'Reviews',  path:'/reviews',  icon:'star',    roles:['super_admin','chief','lieutenant'] },
    { id:'clients',  label:'Clients',  path:'/clients',  icon:'users',   roles:['super_admin','chief'] },
    { id:'settings', label:'Settings', path:'/settings', icon:'settings', roles:['super_admin','chief'] },
    { id:'help',     label:'Help',     path:'/help',     icon:'help-circle', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
  ]},
]

export const DASHBOARD_TILES = [
  { id:'personnel', label:'Personnel Directory', desc:'Staff, roles, and site assignments', path:'/personnel', icon:'users', color:'blue', roles:['super_admin','chief','lieutenant','sergeant','hr','office_staff'] },
  { id:'scheduling', label:'Schedule', desc:'View, draft, and approve schedules', path:'/scheduling', icon:'calendar', color:'gold', badgeKey:'pending_schedules', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
  { id:'incidents', label:'Incident Reports', desc:'Submit and review field reports', path:'/incidents', icon:'file-check', color:'red', badgeKey:'open_incidents', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr'] },
  { id:'map', label:'Live Map', desc:'Officers on duty across all sites', path:'/map', icon:'map-pin', color:'green', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
  { id:'timesheets', label:'Timesheets', desc:'Review, approve, and export', path:'/timesheets', icon:'clock', color:'teal', badgeKey:'pending_timesheets', roles:['super_admin','chief','lieutenant','sergeant','hr','accounting'] },
  { id:'messaging', label:'Messaging', desc:'Internal chat and client messages', path:'/messaging', icon:'message-circle', color:'purple', badgeKey:'unread_messages', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
  { id:'clockin', label:'Clock In / Out', desc:'Start or end your shift', path:'/clockin', icon:'log-in', color:'green', roles:['sergeant','corporal','officer','office_staff'] },
  { id:'patrol', label:'Patrol Logs', desc:'Checkpoints and patrol activity', path:'/patrol', icon:'activity', color:'blue', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer'] },
  { id:'hr', label:'HR & Documents', desc:'Employee lifecycle and documents', path:'/hr', icon:'star', color:'gold', roles:['super_admin','chief','lieutenant','hr','office_staff'] },
  { id:'invoices', label:'Invoices', desc:'Generate, send, and manage billing', path:'/invoices', icon:'credit-card', color:'teal', badgeKey:'pending_invoices', roles:['super_admin','chief','accounting'] },
  { id:'uniforms', label:'Uniform Requests', desc:'Request and track uniform orders', path:'/uniforms', icon:'shield', color:'blue', badgeKey:'pending_uniforms', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
  { id:'settings', label:'Role Management', desc:'Permissions, elevations, overrides', path:'/settings', icon:'settings', color:'purple', roles:['super_admin','chief'] },
]
