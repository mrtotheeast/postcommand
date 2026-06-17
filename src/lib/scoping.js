// ── Data scoping helpers ───────────────────────────────────────────────────────
//
// Single source of truth for "does this role see only their own records?"
// Any page that needs officer-level data isolation should import from here
// instead of re-implementing the role check inline.
//
// Scope hierarchy:
//   officer (level 1)  → own records only by default
//   corporal+          → company-wide records (management visibility)
//
// Usage:
//   import { scopeToOwnEmployee } from '../../lib/scoping'
//   const query = scopeToOwnEmployee(
//     supabase.from('timesheet').select('*').eq('company_id', profile.company_id),
//     profile
//   )

/**
 * Returns true if this role should see only their own records by default.
 * Add additional roles here (e.g. 'office_staff') if they should be similarly
 * restricted — this is the only place that decision needs to be made.
 */
export function isOwnDataOnly(role) {
  return role === 'officer'
}

/**
 * Conditionally scopes a Supabase query to the current user's employee_id.
 * Officers get only their own rows; all other roles get company-wide results.
 *
 * @param {object} query - Supabase query builder (already has .from() and base filters)
 * @param {object} profile - Current user's profile from AuthContext
 * @param {string} [employeeIdColumn='employee_id'] - Column name linking the row to an employee
 * @returns {object} The query with an optional .eq() appended
 */
export function scopeToOwnEmployee(query, profile, employeeIdColumn = 'employee_id') {
  if (isOwnDataOnly(profile?.role)) {
    return query.eq(employeeIdColumn, profile.employee_id)
  }
  return query
}
