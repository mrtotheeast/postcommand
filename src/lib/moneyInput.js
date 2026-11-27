// Convert between form strings and the integer units stored in the database.
// Parsing goes through toScaledInt (string-based), never parseFloat, so
// "19.99" is exactly 1999 cents.
import { toScaledInt } from './contractMath'

const scaledToString = (n, places) => {
  const neg = n < 0
  const abs = Math.abs(n)
  const div = 10 ** places
  return `${neg ? '-' : ''}${Math.floor(abs / div)}.${String(abs % div).padStart(places, '0')}`
}

// Dollars "1,250.5" → 125050 cents. Empty → null.
export function dollarsToCents(str, label) {
  const s = String(str ?? '').replace(/[$,\s]/g, '')
  if (s === '') return null
  return toScaledInt(s, 2, label)
}
export const centsToDollars = (c) => (c == null ? '' : scaledToString(c, 2))

// Percent "1.5" → 150 basis points.
export function percentToBps(str, label) {
  const s = String(str ?? '').replace(/[%\s]/g, '')
  if (s === '') return null
  return toScaledInt(s, 2, label)
}
export const bpsToPercent = (b) => (b == null ? '' : scaledToString(b, 2).replace(/\.?0+$/, '') || '0')

// Exact decimal for Postgres numeric columns: validated, sent as a string.
export function decimalString(str, places, label) {
  const s = String(str ?? '').trim()
  if (s === '') return null
  return scaledToString(toScaledInt(s, places, label), places)
}

export function wholeNumber(str, label) {
  const s = String(str ?? '').trim()
  if (s === '') return null
  if (!/^\d+$/.test(s)) throw new Error(`${label} must be a whole number`)
  return Number(s)
}
