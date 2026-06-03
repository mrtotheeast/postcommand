import { supabase } from './supabase'

export async function logChange({
  companyId,
  employeeId,
  changedById,
  changedByName,
  changedByRole,
  fieldName,
  fieldLabel,
  oldValue,
  newValue,
  changeType = 'field_update',
  notes = null,
}) {
  if (!companyId || !employeeId) return
  try {
    await supabase.from('employee_change_log').insert({
      company_id:      companyId,
      employee_id:     employeeId,
      changed_by_id:   changedById,
      changed_by_name: changedByName,
      changed_by_role: changedByRole,
      field_name:      fieldName,
      field_label:     fieldLabel,
      old_value:       oldValue != null ? String(oldValue) : null,
      new_value:       newValue != null ? String(newValue) : null,
      change_type:     changeType,
      notes,
      created_at:      new Date().toISOString(),
    })
  } catch {
    // Non-fatal — log but don't break the save flow
  }
}

// Convenience: diff two objects and log every changed field
export async function logFieldChanges(ctx, oldObj, newObj, fieldMap) {
  // fieldMap: { fieldName: { label, changeType } }
  const promises = []
  for (const [field, meta] of Object.entries(fieldMap)) {
    if (oldObj[field] !== newObj[field]) {
      promises.push(logChange({
        ...ctx,
        fieldName:  field,
        fieldLabel: meta.label,
        oldValue:   oldObj[field],
        newValue:   newObj[field],
        changeType: meta.changeType || 'field_update',
      }))
    }
  }
  await Promise.allSettled(promises)
}
