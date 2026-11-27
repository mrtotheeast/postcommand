// Turn a Supabase / Postgres error into a sentence a user can act on.
//
// Trigger guards (RAISE EXCEPTION → code P0001) already carry readable
// messages, e.g. "This contract was sent on 2026-11-20 and its terms are
// frozen.", so those pass through unchanged. Constraint and permission errors
// are translated; callers can override per code via `overrides`.
export function dbErrorMessage(error, overrides = {}) {
  if (!error) return overrides.fallback || 'Something went wrong'
  const code = error.code
  const msg = error.message || ''

  if (overrides[code]) return overrides[code]
  if (code === 'P0001') return msg
  if (code === '23505') return 'That record already exists.'
  if (code === '23503') return 'This record is linked to other records and cannot be removed.'
  if (code === '23514') return `A value is outside the allowed range${constraintHint(msg)}.`
  if (code === '23502') return `A required field is missing${columnHint(msg)}.`
  if (code === '22P02' || code === '22007' || code === '22008') return 'A value is in the wrong format.'
  if (code === '42501' || /row-level security/i.test(msg)) return "You don't have permission to do that."
  return msg || overrides.fallback || 'Something went wrong'
}

function constraintHint(msg) {
  const m = /constraint "([^"]+)"/.exec(msg)
  if (!m) return ''
  // e.g. company_contract_setting_late_fee_rate_bps_check → "late fee rate bps"
  const field = m[1].replace(/_check$/, '').replace(/^(company_contract_setting|tax_rate|service_contract|client_tax_exemption|client)_/, '').replace(/_/g, ' ')
  return ` (${field})`
}

function columnHint(msg) {
  const m = /column "([^"]+)"/.exec(msg)
  return m ? ` (${m[1].replace(/_/g, ' ')})` : ''
}
