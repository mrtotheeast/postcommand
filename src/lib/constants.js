// Database column name constants — single source of truth
// When a DB column is renamed, update here only

export const TABLES = {
  USER_PROFILE: 'user_profile',
  EMPLOYEE: 'employee',
  COMPANY: 'company',
  SHIFT: 'shift',
  TIMESHEET: 'timesheet',
  INCIDENT_REPORT: 'incident_report',
  INVOICE: 'invoice',
  INVOICE_ITEM: 'invoice_item',
  INVOICE_VIEW_LOG: 'invoice_view_log',
  CLIENT: 'client',
  CLIENT_CONTACT: 'client_contact',
  SITE: 'site',
  PTO_BANK_CONFIG: 'pto_bank_config',
  PTO_BALANCE: 'pto_balance',
  TIME_OFF_REQUEST: 'time_off_request',
  EMPLOYEE_AVAILABILITY: 'employee_availability',
}

export const INCIDENT_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  VOID: 'void',
}

export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  VOID: 'void',
  CANCELLED: 'cancelled',
}

export const TIMESHEET_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const SHIFT_STATUSES = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
}

export const PTO_BANK_TYPES = {
  PAID: 'paid',
  SICK: 'sick',
  PERSONAL: 'personal',
  UNPAID: 'unpaid',
}

export const TIME_OFF_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
}
