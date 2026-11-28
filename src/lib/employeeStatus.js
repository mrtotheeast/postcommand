import { supabase } from './supabase'
import { logChange } from './changeLog'
import { saveEmployeeHr } from './employeeData'

// Statuses Reactivate applies to. Rehire applies to 'terminated', Restore to 'archived'.
export const REACTIVATE_FROM = ['suspended', 'on_leave', 'inactive']

// Which return-to-active action fits a status, or null if the employee is already active.
export function activationModeFor(status) {
  if (REACTIVATE_FROM.includes(status)) return 'reactivate'
  if (status === 'terminated') return 'rehire'
  if (status === 'archived') return 'restore'
  return null
}

const NOTES = { reactivate: 'Reactivated', rehire: 'Rehired', restore: 'Restored' }

// Return an employee to 'active'. Shared by the status-change dialog (Personnel),
// the Reactivate / Rehire / Restore buttons in the employee profile header, and
// Restore on the Archived page, so all run the same update and change-log entry.
//   reactivate: from suspended / on_leave / inactive
//   rehire:     from terminated
//   restore:    from archived
// Archive fields are cleared in every mode. Returns { error } (null on success).
// The *_reason fields live in employee_hr and are cleared there in a separate write
// after the status change; if that write fails the status has still changed.
export async function returnEmployeeToActive(emp, { mode, actor }) {
  const updates = {
    status: 'active',
    archived_at: null,
    ...(mode === 'rehire'     ? { terminated_at: null, terminated_date: null } : {}),
    ...(mode === 'reactivate' ? { suspended_at: null, leave_type: null, leave_return_date: null, leave_started_at: null } : {}),
    ...(mode === 'restore'    ? { terminated_date: null } : {}),
  }
  const hrUpdates = {
    archived_reason: null,
    ...(mode === 'rehire'     ? { terminated_reason: null } : {}),
    ...(mode === 'reactivate' ? { suspended_reason: null } : {}),
  }
  const { error } = await supabase.from('employee').update(updates).eq('id', emp.id).eq('company_id', emp.company_id)
  if (error) return { error }
  let hrError = null
  try {
    await saveEmployeeHr(emp.id, hrUpdates, emp.company_id)
  } catch (e) {
    hrError = e
  }
  await logChange({
    companyId: emp.company_id, employeeId: emp.id,
    changedById: actor?.id, changedByName: `${actor?.first_name} ${actor?.last_name}`, changedByRole: actor?.role,
    fieldName: 'status', fieldLabel: 'Employment Status',
    oldValue: emp.status, newValue: 'active',
    changeType: 'status_change', notes: NOTES[mode],
  })
  return { error: hrError }
}
