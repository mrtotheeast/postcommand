// Contract calculator — pure functions, no React or Supabase.
//
// Money rules:
//   • All money is integer cents. Rates are basis points (1 bp = 0.01%).
//   • Decimal inputs (hours, multipliers) are parsed from their decimal string
//     form into scaled integers, never multiplied as floats.
//   • Every division goes through roundDiv(), which uses BigInt and rounds
//     half-up exactly once per line item.
//
// Dates are 'YYYY-MM-DD' strings, compared and stepped in UTC so daylight
// saving never shifts a day.

// ── Types ─────────────────────────────────────────────────────────────────────

export type Cents = number
export type ISODate = string // 'YYYY-MM-DD'

export interface PostInput {
  postName: string
  hoursPerWeek: number | string   // decimal allowed, up to 2 places (e.g. 37.5)
  hourlyRateCents?: Cents | null  // falls back to the contract base rate when absent
  startTime?: string              // 'HH:MM', 24h — used only for the minimum-shift check
  endTime?: string
  daysOfWeek?: number[]           // 0 = Sunday … 6 = Saturday (matches the database)
}

// Default multipliers from company_contract_setting. Decimal strings or
// numbers (e.g. '1.70'); null means "not set" and yields a null rate.
export interface RateMultipliers {
  overtime?: number | string | null
  holiday?: number | string | null
  shortNotice?: number | string | null
  emergency?: number | string | null
}

export interface DerivedRates {
  regular: Cents
  overtime: Cents | null
  holiday: Cents | null
  shortNotice: Cents | null
  emergency: Cents | null
}

export interface TaxRate {
  jurisdictionCode: string
  rateBps: number
  confirmedAt: string | null      // must be set by an admin before any contract math runs
}

export interface PostCharge {
  postName: string
  hoursPerWeek: string
  hourlyRateCents: Cents
  weeklyChargeCents: Cents
}

export interface WeeklyChargesResult {
  perPost: PostCharge[]
  subtotalCents: Cents
  taxCents: Cents
  weeklyTotalCents: Cents
  warnings: string[]
}

export interface LateFeeSettings {
  lateFeeMinCents: Cents
  lateFeeRateBps: number
  lateFeeIntervalDays: number
}

export interface InvoiceInput {
  id: string
  dueDate: ISODate
  amountCents: Cents
  paidCents?: Cents
  paidDate?: ISODate | null       // date the invoice was paid in full, if it has been
  declinedDates?: ISODate[]       // each declined / returned / reversed payment attempt
}

// Payment Defaults a person logs in contract_events because invoice data can't
// show them (Section 8.1 (c)–(e)).
export type LoggedDefaultType = 'authorization_revoked' | 'chargeback_unfounded' | 'deposit_not_restored'

export interface LoggedDefault {
  eventType: LoggedDefaultType
  date: ISODate
  curedDate?: ISODate | null   // once cured it still counts toward 8.6, but no longer supports suspension
}

const LOGGED_DEFAULT_RULES: Record<LoggedDefaultType, { section: string; message: string }> = {
  authorization_revoked: { section: '8.1(c), 8.2', message: 'Client revoked the Schedule B authorization without a replacement' },
  chargeback_unfounded:  { section: '8.1(d), 8.2', message: 'Client filed an unfounded chargeback' },
  deposit_not_restored:  { section: '8.1(e), 8.2', message: 'Client did not restore the Security Deposit when required' },
}

export interface StandingReason {
  rule: 'suspend' | 'terminate'
  section: string
  message: string
}

export interface AccountStanding {
  pastDueCents: Cents
  oldestDaysPastDue: number
  lateFeesDueCents: Cents
  paymentDefaultsLast6Months: number
  suspendEligible: boolean
  terminateEligible: boolean
  reasons: StandingReason[]
}

// ── Exact arithmetic helpers ──────────────────────────────────────────────────

// Round numerator / denominator half-up to the nearest integer, exactly.
// BigInt avoids float error; inputs are already integers.
export function roundDiv(numerator: number | bigint, denominator: number | bigint): number {
  const n = BigInt(numerator)
  const d = BigInt(denominator)
  if (d <= 0n) throw new Error('roundDiv: denominator must be positive')
  if (n < 0n) return -roundDiv(-n, d)
  const result = (2n * n + d) / (2n * d)   // floor((n + d/2) / d) without fractions
  return Number(result)
}

// Parse a non-negative decimal (number or string) into an integer scaled by
// 10^places, exactly. '37.5' with places=2 → 3750. Rejects more precision than
// `places` rather than silently rounding an input.
export function toScaledInt(value: number | string, places: number, label = 'value'): number {
  const str = typeof value === 'number' ? String(value) : value.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(str)
  if (!m) throw new Error(`${label} must be a non-negative decimal number (got "${value}")`)
  const frac = m[2] || ''
  if (frac.length > places) throw new Error(`${label} allows at most ${places} decimal places (got "${value}")`)
  return Number(m[1]) * 10 ** places + Number(frac.padEnd(places, '0') || '0')
}

function assertCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer number of cents (got ${value})`)
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function parseDate(d: ISODate, label = 'date'): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`${label} must be YYYY-MM-DD (got "${d}")`)
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  if (new Date(t).toISOString().slice(0, 10) !== d) throw new Error(`${label} is not a real date (got "${d}")`)
  return t
}
const fmtDate = (t: number): ISODate => new Date(t).toISOString().slice(0, 10)

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS)
}
export function addDays(d: ISODate, days: number): ISODate {
  return fmtDate(parseDate(d) + days * DAY_MS)
}
export function addMonths(d: ISODate, months: number): ISODate {
  const t = new Date(parseDate(d))
  const day = t.getUTCDate()
  const target = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + months, 1))
  const dim = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, dim))
  return fmtDate(target.getTime())
}

// ── Tax rate guard ────────────────────────────────────────────────────────────

// A wrong tax rate creates real liability, so the math refuses to run without
// a rate an admin has explicitly confirmed. No default rate exists anywhere.
export function requireConfirmedTaxRate(taxRate: TaxRate | null | undefined): number {
  if (!taxRate) throw new Error('No sales tax rate is set up for this jurisdiction. An admin must add and confirm one in Contract Settings.')
  if (!taxRate.confirmedAt) throw new Error(`The sales tax rate for ${taxRate.jurisdictionCode} has not been confirmed. An admin must confirm it in Contract Settings before a contract can be generated.`)
  if (!Number.isInteger(taxRate.rateBps) || taxRate.rateBps < 0 || taxRate.rateBps > 10000) {
    throw new Error(`Sales tax rate for ${taxRate.jurisdictionCode} is invalid (${taxRate.rateBps} bps)`)
  }
  return taxRate.rateBps
}

// ── Shift length (for the minimum-shift warning) ──────────────────────────────

function shiftMinutes(start: string, end: string): number {
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t)
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Time must be HH:MM (got "${t}")`)
    return Number(m[1]) * 60 + Number(m[2])
  }
  const diff = toMin(end) - toMin(start)
  return diff > 0 ? diff : diff + 24 * 60   // overnight shift wraps past midnight; equal times = 24h post
}

// ── Calculator functions ──────────────────────────────────────────────────────

// Weekly charges per post, subtotal, sales tax on the subtotal, and total.
// Shifts shorter than the minimum produce a warning; the hours are NOT changed.
export function weeklyCharges(
  posts: PostInput[],
  taxRate: TaxRate | null | undefined,
  options: { minimumShiftHours?: number | string; baseRateCents?: Cents | null; exempt?: boolean } = {},
): WeeklyChargesResult {
  // A tax-exempt client pays no sales tax, so no confirmed rate is needed.
  const taxRateBps = options.exempt ? 0 : requireConfirmedTaxRate(taxRate)
  const warnings: string[] = []
  const minShiftMinutes = options.minimumShiftHours != null
    ? roundDiv(toScaledInt(options.minimumShiftHours, 2, 'minimumShiftHours') * 60, 100)
    : null

  const perPost = posts.map((p, i) => {
    const label = p.postName || `Post ${i + 1}`
    const rate = postHourlyRate(p, options.baseRateCents, label)
    const centiHours = toScaledInt(p.hoursPerWeek, 2, `${label} hours per week`)
    if (minShiftMinutes != null && p.startTime && p.endTime) {
      const mins = shiftMinutes(p.startTime, p.endTime)
      if (mins < minShiftMinutes) {
        warnings.push(`${label}: shift ${p.startTime}–${p.endTime} is ${(mins / 60).toFixed(2).replace(/\.?0+$/, '')} hours, below the ${options.minimumShiftHours}-hour minimum shift (Section 6.6). Each shift will be billed at the minimum.`)
      }
    }
    return {
      postName: label,
      hoursPerWeek: (centiHours / 100).toFixed(2),
      hourlyRateCents: rate,
      // hours are scaled ×100, so divide back out — rounded once per post
      weeklyChargeCents: roundDiv(centiHours * rate, 100),
    }
  })

  const subtotalCents = perPost.reduce((a, p) => a + p.weeklyChargeCents, 0)
  const taxCents = roundDiv(subtotalCents * taxRateBps, 10000)
  return { perPost, subtotalCents, taxCents, weeklyTotalCents: subtotalCents + taxCents, warnings }
}

// A post's own hourly rate, or the contract base rate when it has none.
export function postHourlyRate(post: PostInput, baseRateCents: Cents | null | undefined, label = post.postName): Cents {
  const rate = post.hourlyRateCents ?? baseRateCents
  if (rate == null) throw new Error(`${label || 'Post'} has no hourly rate and the contract has no base rate`)
  assertCents(rate, `${label || 'Post'} hourly rate`)
  return rate
}

// Every rate derived from one hourly rate: regular × each multiplier, rounded
// half-up once. $50.00 × 1.7 = $85.00. An unset multiplier gives a null rate.
export function derivedRates(hourlyRateCents: Cents, multipliers: RateMultipliers): DerivedRates {
  assertCents(hourlyRateCents, 'hourly rate')
  const apply = (m: number | string | null | undefined, label: string) =>
    m == null || m === '' ? null : roundDiv(hourlyRateCents * toScaledInt(m, 4, `${label} multiplier`), 10000)
  return {
    regular: hourlyRateCents,
    overtime: apply(multipliers.overtime, 'overtime'),
    holiday: apply(multipliers.holiday, 'holiday'),
    shortNotice: apply(multipliers.shortNotice, 'short-notice'),
    emergency: apply(multipliers.emergency, 'emergency'),
  }
}

// Derived rates for each post, from that post's own rate (falling back to the base).
export function postDerivedRates(posts: PostInput[], baseRateCents: Cents | null | undefined, multipliers: RateMultipliers) {
  return posts.map((p, i) => {
    const label = p.postName || `Post ${i + 1}`
    return {
      postName: label,
      rateSource: (p.hourlyRateCents != null ? 'post' : 'base') as 'post' | 'base',
      ...derivedRates(postHourlyRate(p, baseRateCents, label), multipliers),
    }
  })
}

export interface TermLength {
  days: number              // inclusive: 00:00 on start through 23:59 on end
  weeksExact: string        // e.g. '1.43'
  wholeWeeks: number
  months: number            // whole calendar months from the start date
  monthRemainderDays: number
  years: number
  label: string             // the most natural unit, e.g. '10 days', '6 months', '1 year 2 months'
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

export function termLength(start: ISODate, end: ISODate): TermLength {
  const days = daysBetween(start, end) + 1
  if (days < 1) throw new Error('The term end date must be on or after the start date')
  let months = 0
  while (daysBetween(addMonths(start, months + 1), addDays(end, 1)) >= 0) months++
  const monthRemainderDays = daysBetween(addMonths(start, months), end) + 1
  const years = Math.floor(months / 12)
  const wholeWeeks = Math.floor(days / 7)
  const weekRem = days % 7
  const weeksExact = (roundDiv(days * 100, 7) / 100).toFixed(2)

  let label: string
  if (days < 28) label = plural(days, 'day')
  else if (months === 0) label = [plural(wholeWeeks, 'week'), weekRem ? plural(weekRem, 'day') : ''].filter(Boolean).join(' ')
  else {
    const parts = [years ? plural(years, 'year') : '', months % 12 ? plural(months % 12, 'month') : '', monthRemainderDays ? plural(monthRemainderDays, 'day') : '']
    label = parts.filter(Boolean).join(' ')
  }
  return { days, weeksExact, wholeWeeks, months, monthRemainderDays, years, label }
}

// Days in [start, end] (inclusive) that fall on one of `daysOfWeek`.
export function countScheduledDays(start: ISODate, end: ISODate, daysOfWeek: number[]): number {
  const set = new Set(daysOfWeek)
  for (const d of set) if (!Number.isInteger(d) || d < 0 || d > 6) throw new Error(`Day of week must be 0–6 (got ${d})`)
  let count = 0
  const total = daysBetween(start, end) + 1
  const firstDow = new Date(`${start}T00:00:00Z`).getUTCDay()
  for (let i = 0; i < total; i++) if (set.has((firstDow + i) % 7)) count++
  return count
}

export interface ContractValue {
  isEstimate: true
  note: string
  termDays: number
  perPost: { postName: string; hourlyRateCents: Cents; method: 'scheduled_days' | 'prorated'; occurrences: number | null; valueCents: Cents }[]
  subtotalCents: Cents
  taxCents: Cents
  totalCents: Cents
}

// Estimated contract value over the term. Never typed by hand.
//   • Post with days_of_week: hours per occurrence = hours_per_week ÷ number of
//     scheduled days; value = occurrences in the term × hours × rate.
//   • Post without days: weekly charge × term days ÷ 7.
// Each post is rounded once; tax is computed once on the subtotal (0 if exempt).
// It's an estimate: actual invoices follow hours worked, holidays, and changes.
export function contractValue(
  posts: PostInput[],
  term: { start: ISODate; end: ISODate },
  taxRate: TaxRate | null | undefined,
  options: { exempt?: boolean; baseRateCents?: Cents | null } = {},
): ContractValue {
  const taxRateBps = options.exempt ? 0 : requireConfirmedTaxRate(taxRate)
  const termDays = termLength(term.start, term.end).days

  const perPost = posts.map((p, i) => {
    const label = p.postName || `Post ${i + 1}`
    const rate = postHourlyRate(p, options.baseRateCents, label)
    const centiHours = toScaledInt(p.hoursPerWeek, 2, `${label} hours per week`)
    const days = [...new Set(p.daysOfWeek || [])]
    if (days.length) {
      const occurrences = countScheduledDays(term.start, term.end, days)
      return { postName: label, hourlyRateCents: rate, method: 'scheduled_days' as const, occurrences,
        valueCents: roundDiv(centiHours * rate * occurrences, 100 * days.length) }
    }
    return { postName: label, hourlyRateCents: rate, method: 'prorated' as const, occurrences: null,
      valueCents: roundDiv(centiHours * rate * termDays, 100 * 7) }
  })

  const subtotalCents = perPost.reduce((a, p) => a + p.valueCents, 0)
  const taxCents = roundDiv(subtotalCents * taxRateBps, 10000)
  return {
    isEstimate: true,
    note: 'Estimate based on the scheduled posts. Actual invoices follow hours worked, holidays, and schedule changes.',
    termDays,
    perPost,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  }
}

// Section 5.1: deposit = N weeks of scheduled charges INCLUDING sales tax.
export function securityDeposit(weeklyTotalCents: Cents, weeks: number): Cents {
  assertCents(weeklyTotalCents, 'weeklyTotalCents')
  if (!Number.isInteger(weeks) || weeks < 0) throw new Error(`Deposit weeks must be a whole number (got ${weeks})`)
  return weeklyTotalCents * weeks
}

// Section 6.4: holiday hours billed at multiplier × regular rate (e.g. 1.5).
export function holidayRate(hourlyRateCents: Cents, multiplier: number | string): Cents {
  assertCents(hourlyRateCents, 'hourlyRateCents')
  const multBps = toScaledInt(multiplier, 4, 'holiday multiplier')   // 1.5 → 15000
  return roundDiv(hourlyRateCents * multBps, 10000)
}

// Section 8.5: greater of the minimum or rate × past-due balance. 0 if nothing is past due.
export function lateFee(pastDueCents: Cents, settings: LateFeeSettings): Cents {
  assertCents(pastDueCents, 'pastDueCents')
  if (pastDueCents === 0) return 0
  return Math.max(settings.lateFeeMinCents, roundDiv(pastDueCents * settings.lateFeeRateBps, 10000))
}

// Section 8.5 timing: first fee the day after the Due Date, then every
// `intervalDays` while unpaid. Returns accrual dates on or before `today`.
export function lateFeeSchedule(dueDate: ISODate, today: ISODate, intervalDays = 30): ISODate[] {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) throw new Error('intervalDays must be a positive whole number')
  const dates: ISODate[] = []
  for (let d = addDays(dueDate, 1); daysBetween(d, today) >= 0; d = addDays(d, intervalDays)) dates.push(d)
  return dates
}

// Section 9.6: pctBps × weekly charges × weeks remaining in the term.
// Weeks remaining = remaining days / 7 (fractional weeks count proportionally),
// computed as one fraction and rounded once at the end.
//
// Uses the PRE-TAX weekly subtotal.
// TODO(CPA): confirming whether Maryland / DC sales tax applies to the Early
// Termination Fee. If it does, add tax on top of this result, don't change the base.
export function earlyTerminationFee(
  weeklySubtotalCents: Cents,
  terminationDate: ISODate,
  termEndDate: ISODate,
  pctBps: number,
): Cents {
  assertCents(weeklySubtotalCents, 'weeklySubtotalCents')
  const remainingDays = daysBetween(terminationDate, termEndDate)
  if (remainingDays <= 0) return 0
  return roundDiv(weeklySubtotalCents * remainingDays * pctBps, 7 * 10000)
}

// Sections 8.1, 8.2, 8.6, 8.9, 9.3. Advisory only — the app never suspends or
// terminates on its own.
//
// Payment Defaults counted (Section 8.1):
//   (a) each declined / returned / reversed payment, dated the day it happened
//   (b) each invoice not paid in full by its Due Date, dated the day after the Due Date
//   (c)–(e) revoked authorization, unfounded chargeback, unrestored deposit —
//       not visible in invoice data; passed in as `loggedDefaults` from contract_events
//
// Late fees are assessed at the ACCOUNT level (Section 8.5): one fee per
// accrual date, on the total balance past due on that date. The first accrual
// is the day after the oldest still-unpaid invoice's Due Date, then every
// `lateFeeIntervalDays` while any balance remains unpaid. Because the oldest
// unpaid invoice has stayed unpaid since then, the balance never hit zero in
// between, so the 30-day clock never reset.
//
// Limitation: the balance on each past accrual date is rebuilt from invoices
// that are still unpaid today. An invoice paid since then isn't counted toward
// earlier fees, so this can understate (never overstate) what was owed. Fees
// already assessed and paid are tracked in contract_events, not here.
export function accountStanding(
  invoices: InvoiceInput[],
  depositCents: Cents,
  today: ISODate,
  settings: LateFeeSettings,
  loggedDefaults: LoggedDefault[] = [],
): AccountStanding {
  assertCents(depositCents, 'depositCents')
  const sixMonthsAgo = addMonths(today, -6)
  const inWindow = (d: ISODate) => daysBetween(sixMonthsAgo, d) >= 0 && daysBetween(d, today) >= 0

  let pastDueCents = 0
  let oldestDaysPastDue = 0
  let oldestUnpaidDueDate: ISODate | null = null
  const unpaid: { dueDate: ISODate; balance: Cents }[] = []
  let defaults = 0
  let anyDeclined = false

  for (const inv of invoices) {
    assertCents(inv.amountCents, `invoice ${inv.id} amount`)
    const balance = Math.max(0, inv.amountCents - (inv.paidCents || 0))
    const daysLate = daysBetween(inv.dueDate, today)
    const unpaidPastDue = balance > 0 && daysLate > 0

    if (unpaidPastDue) {
      pastDueCents += balance
      unpaid.push({ dueDate: inv.dueDate, balance })
      if (daysLate > oldestDaysPastDue) { oldestDaysPastDue = daysLate; oldestUnpaidDueDate = inv.dueDate }
    }

    // 8.1(b): not paid by the Due Date — whether still unpaid or paid late.
    const paidLate = inv.paidDate != null && daysBetween(inv.dueDate, inv.paidDate) > 0
    if ((unpaidPastDue || paidLate) && inWindow(addDays(inv.dueDate, 1))) defaults++

    // 8.1(a): each declined payment. It supports suspension only while that
    // invoice is still unpaid; every decline counts toward 8.6 for 6 months.
    for (const d of inv.declinedDates || []) {
      if (balance > 0 && daysBetween(d, today) >= 0) anyDeclined = true
      if (inWindow(d)) defaults++
    }
  }

  // One account-level fee per accrual date, on the balance past due that day.
  let lateFeesDueCents = 0
  if (oldestUnpaidDueDate) {
    for (const accrual of lateFeeSchedule(oldestUnpaidDueDate, today, settings.lateFeeIntervalDays)) {
      const pastDueOnDate = unpaid.filter(u => daysBetween(u.dueDate, accrual) > 0).reduce((a, u) => a + u.balance, 0)
      lateFeesDueCents += lateFee(pastDueOnDate, settings)
    }
  }

  // 8.1(c)–(e): defaults logged by a person.
  const loggedReasons: StandingReason[] = []
  for (const ev of loggedDefaults) {
    const rule = LOGGED_DEFAULT_RULES[ev.eventType]
    if (!rule) throw new Error(`Unknown logged default type "${ev.eventType}"`)
    if (daysBetween(ev.date, today) < 0) continue // future-dated entry: ignore
    if (inWindow(ev.date)) defaults++
    const cured = ev.curedDate != null && daysBetween(ev.curedDate, today) >= 0
    if (!cured && !loggedReasons.some(r => r.section === rule.section)) loggedReasons.push({ rule: 'suspend', ...rule })
  }

  const reasons: StandingReason[] = []
  if (pastDueCents > 0) {
    reasons.push({ rule: 'suspend', section: '8.1(b), 8.2', message: `Invoice not paid by its Due Date (${oldestDaysPastDue} day${oldestDaysPastDue === 1 ? '' : 's'} past due)` })
  }
  if (anyDeclined) {
    reasons.push({ rule: 'suspend', section: '8.1(a), 8.2', message: 'A payment was declined, reversed, or returned' })
  }
  reasons.push(...loggedReasons)
  if (oldestDaysPastDue >= 14) {
    reasons.push({ rule: 'terminate', section: '8.9, 9.3(b)', message: `An invoice is ${oldestDaysPastDue} days past its Due Date (14 or more)` })
  }
  if (pastDueCents > depositCents) {
    reasons.push({ rule: 'terminate', section: '8.9, 9.3(b)', message: `Past-due balance exceeds the Security Deposit` })
  }
  if (defaults >= 2) {
    reasons.push({ rule: 'terminate', section: '8.6, 9.3(b)', message: `${defaults} Payment Defaults in the last 6 months (2 or more)` })
  }

  return {
    pastDueCents,
    oldestDaysPastDue,
    lateFeesDueCents,
    paymentDefaultsLast6Months: defaults,
    suspendEligible: reasons.some(r => r.rule === 'suspend'),
    terminateEligible: reasons.some(r => r.rule === 'terminate'),
    reasons,
  }
}

// ── Display ───────────────────────────────────────────────────────────────────

export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100).toLocaleString('en-US')
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`
}
