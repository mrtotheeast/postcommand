export const ROLES = { SUPER_ADMIN:'super_admin', CHIEF:'chief', LIEUTENANT:'lieutenant', SERGEANT:'sergeant', CORPORAL:'corporal', OFFICER:'officer', HR:'hr', ACCOUNTING:'accounting', OFFICE_STAFF:'office_staff', CLIENT:'client' }
export const ROLE_LEVELS = { super_admin:6, chief:5, lieutenant:4, sergeant:3, corporal:2, officer:1, hr:0, accounting:0, office_staff:0, client:-1 }
export const ROLE_LABELS = { super_admin:'Chief App Admin', chief:'Chief', lieutenant:'Lieutenant', sergeant:'Sergeant', corporal:'Corporal', officer:'Officer', hr:'HR', accounting:'Accounting', office_staff:'Office Staff', client:'Client' }
export function atLeast(role, minRole) { return (ROLE_LEVELS[role]??0) >= (ROLE_LEVELS[minRole]??0) }

export const NAV_ITEMS = [
  { section:'Operations', items:[
    { id:'dashboard', label:'Dashboard', path:'/dashboard', icon:'grid', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff','client'] },
    { id:'training', label:'Training', path:'/training', icon:'book-open', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','office_staff'] },
    { id:'personnel', label:'Personnel', path:'/personnel', icon:'users', roles:['super_admin','chief','lieutenant','sergeant','hr','office_staff'] },
    { id:'scheduling', label:'Scheduling', path:'/scheduling', icon:'calendar', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
    { id:'timesheets', label:'Timesheets', path:'/timesheets', icon:'clock', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting'] },
    { id:'incidents', label:'Incident Reports', path:'/incidents', icon:'file-check', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr'] },
  ]},
  { section:'Field', items:[
    { id:'map', label:'Live Map', path:'/map', icon:'map-pin', roles:['super_admin','chief','lieutenant'] },
    { id:'patrol', label:'Patrol Logs', path:'/patrol', icon:'activity', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer'] },
    { id:'clockin', label:'Clock In / Out', path:'/clockin', icon:'log-in', roles:['sergeant','corporal','officer','office_staff'] },
    { id:'sos', label:'SOS', path:'/sos', icon:'alert-triangle', badge:true, roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
  ]},
  { section:'Admin', items:[
    { id:'sites', label:'Site Management', path:'/sites', icon:'map', roles:['super_admin','chief','lieutenant','office_staff'] },
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
  { id:'map', label:'Live Map', desc:'Officers on duty across all sites', path:'/map', icon:'map-pin', color:'green', roles:['super_admin','chief','lieutenant'] },
  { id:'timesheets', label:'Timesheets', desc:'Review, approve, and export', path:'/timesheets', icon:'clock', color:'teal', badgeKey:'pending_timesheets', roles:['super_admin','chief','lieutenant','sergeant','hr','accounting'] },
  { id:'messaging', label:'Messaging', desc:'Internal chat and client messages', path:'/messaging', icon:'message-circle', color:'purple', badgeKey:'unread_messages', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','hr','accounting','office_staff'] },
  { id:'clockin', label:'Clock In / Out', desc:'Start or end your shift', path:'/clockin', icon:'log-in', color:'green', roles:['sergeant','corporal','officer','office_staff'] },
  { id:'patrol', label:'Patrol Logs', desc:'Checkpoints and patrol activity', path:'/patrol', icon:'activity', color:'blue', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer'] },
  { id:'hr', label:'HR & Documents', desc:'Employee lifecycle and documents', path:'/hr', icon:'star', color:'gold', roles:['super_admin','chief','lieutenant','hr','office_staff'] },
  { id:'invoices', label:'Invoices', desc:'Generate, send, and manage billing', path:'/invoices', icon:'credit-card', color:'teal', badgeKey:'pending_invoices', roles:['super_admin','chief','accounting'] },
  { id:'uniforms', label:'Uniform Requests', desc:'Request and track uniform orders', path:'/uniforms', icon:'shield', color:'blue', badgeKey:'pending_uniforms', roles:['super_admin','chief','lieutenant','sergeant','corporal','officer','office_staff'] },
  { id:'settings', label:'Role Management', desc:'Permissions, elevations, overrides', path:'/settings', icon:'settings', color:'purple', roles:['super_admin','chief'] },
]
