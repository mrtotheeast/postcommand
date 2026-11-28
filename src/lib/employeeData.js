import { supabase } from './supabase'

// Sensitive employee columns now live in three RLS-protected side tables,
// each keyed by employee_id. The same columns still exist on `employee` until
// they are dropped — never read or write them there.
export const PAY_FIELDS     = ['base_hourly_rate', 'pay_rate', 'pay_rate_type', 'paychex_worker_id']
export const PRIVATE_FIELDS = ['date_of_birth', 'address', 'phone_number', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email', 'emergency_contact_relation']
export const HR_FIELDS      = ['notes', 'suspended_reason', 'terminated_reason', 'archived_reason', 'is_rehirable']
const SENSITIVE_FIELDS = [...PAY_FIELDS, ...PRIVATE_FIELDS, ...HR_FIELDS]

// PostgREST returns a 1:1 embed as an object, but normalise in case it comes back as an array.
function one(x) { return Array.isArray(x) ? (x[0] ?? null) : (x ?? null) }
function pick(row, fields) {
  const out = {}
  if (row) for (const f of fields) out[f] = row[f] ?? null
  return out
}

// Loads one employee plus their pay/private/hr rows, flattened so existing
// components keep using emp.phone_number, emp.notes, etc.
// A side row the viewer may not see (RLS) comes back null; hasPay / hasPrivate / hasHr
// tell the UI whether to show the field or "Restricted". Returns null if the employee is not visible.
export async function loadEmployeeDetail(id) {
  const { data, error } = await supabase
    .from('employee')
    .select('*, employee_pay(*), employee_private(*), employee_hr(*)')
    .eq('id', id)
    .maybeSingle()

  let row = data
  if (error) {
    // e.g. no SELECT grant on a side table: load the base row and treat all sensitive data as restricted
    console.warn('[employeeData] detail embed failed, falling back to base row:', error.message)
    const res = await supabase.from('employee').select('*').eq('id', id).maybeSingle()
    if (res.error) throw res.error
    row = res.data
  }
  if (!row) return null

  const { employee_pay, employee_private, employee_hr, ...base } = row
  for (const f of SENSITIVE_FIELDS) delete base[f]
  const pay = one(employee_pay), priv = one(employee_private), hr = one(employee_hr)

  return {
    ...base,
    ...pick(pay, PAY_FIELDS),
    ...pick(priv, PRIVATE_FIELDS),
    ...pick(hr, HR_FIELDS),
    hasPay: !!pay,
    hasPrivate: !!priv,
    hasHr: !!hr,
  }
}

// Upsert on employee_id. Only the given fields are written; other columns are untouched.
// With no fields this just ensures the row exists (ON CONFLICT DO NOTHING).
async function saveSide(table, allowed, id, fields, companyId) {
  if (!id) throw new Error(`${table}: employee id is required`)
  if (!companyId) throw new Error(`${table}: company id is required`)
  const clean = {}
  for (const [k, v] of Object.entries(fields || {})) {
    if (!allowed.includes(k)) throw new Error(`${table}: unexpected field "${k}"`)
    clean[k] = v
  }
  const empty = Object.keys(clean).length === 0
  const { error } = await supabase
    .from(table)
    .upsert({ employee_id: id, company_id: companyId, ...clean }, { onConflict: 'employee_id', ignoreDuplicates: empty })
  if (error) throw error
}

export function saveEmployeePay(id, fields, companyId)     { return saveSide('employee_pay',     PAY_FIELDS,     id, fields, companyId) }
export function saveEmployeePrivate(id, fields, companyId) { return saveSide('employee_private', PRIVATE_FIELDS, id, fields, companyId) }
export function saveEmployeeHr(id, fields, companyId)      { return saveSide('employee_hr',      HR_FIELDS,      id, fields, companyId) }

// After inserting a new employee: make sure all three side rows exist (a DB trigger
// also creates them, hence upsert), writing any initial values given.
export async function createEmployeeSideRows(id, companyId, { pay, private: priv, hr } = {}) {
  const results = await Promise.allSettled([
    saveEmployeePay(id, pay, companyId),
    saveEmployeePrivate(id, priv, companyId),
    saveEmployeeHr(id, hr, companyId),
  ])
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) throw failed[0].reason
}
