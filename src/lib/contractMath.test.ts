import { describe, it, expect } from 'vitest'
import {
  weeklyCharges, securityDeposit, holidayRate, lateFee, lateFeeSchedule,
  earlyTerminationFee, accountStanding, roundDiv, toScaledInt, formatCents,
  derivedRates, postDerivedRates, termLength, contractValue, countScheduledDays,
  type TaxRate, type LateFeeSettings, type PostInput,
} from './contractMath'

// Test fixtures only — real rates and fees live in the database per company.
const TAX_600: TaxRate = { jurisdictionCode: 'MD', rateBps: 600, confirmedAt: '2026-11-01T00:00:00Z' }
const LATE: LateFeeSettings = { lateFeeMinCents: 5000, lateFeeRateBps: 150, lateFeeIntervalDays: 30 }

const POST_A: PostInput = { postName: 'Post A', hoursPerWeek: 56, hourlyRateCents: 3200 }
const POST_B: PostInput = { postName: 'Post B', hoursPerWeek: 30, hourlyRateCents: 3000 }

describe('worked example (must match to the cent)', () => {
  const r = weeklyCharges([POST_A, POST_B], TAX_600)

  it('per-post weekly charges', () => {
    expect(r.perPost.map(p => p.weeklyChargeCents)).toEqual([179_200, 90_000])
  })
  it('subtotal, tax, weekly total', () => {
    expect(r.subtotalCents).toBe(269_200)
    expect(r.taxCents).toBe(16_152)
    expect(r.weeklyTotalCents).toBe(285_352)
  })
  it('2-week deposit includes tax (Section 5.1)', () => {
    expect(securityDeposit(r.weeklyTotalCents, 2)).toBe(570_704)
  })
})

describe('weeklyCharges', () => {
  it('zero posts → all zeros', () => {
    const r = weeklyCharges([], TAX_600)
    expect(r).toMatchObject({ perPost: [], subtotalCents: 0, taxCents: 0, weeklyTotalCents: 0, warnings: [] })
  })

  it('fractional hours are exact (37.5 h × $31.33)', () => {
    const r = weeklyCharges([{ postName: 'X', hoursPerWeek: '37.5', hourlyRateCents: 3133 }], TAX_600)
    expect(r.perPost[0].weeklyChargeCents).toBe(117_488) // 117,487.5 → half-up
  })

  it('tax rounds half-up once on the subtotal', () => {
    // 1,025 × 6% = 61.5 → 62
    const r = weeklyCharges([{ postName: 'X', hoursPerWeek: 1, hourlyRateCents: 1025 }], TAX_600)
    expect(r.taxCents).toBe(62)
  })

  it('shift below the 4-hour minimum warns but does not change hours', () => {
    const short: PostInput = { postName: 'Lobby', hoursPerWeek: 15, hourlyRateCents: 3000, startTime: '09:00', endTime: '12:00' }
    const r = weeklyCharges([short], TAX_600, { minimumShiftHours: 4 })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatch(/Lobby.*3 hours.*4-hour minimum/)
    expect(r.perPost[0].hoursPerWeek).toBe('15.00')
    expect(r.perPost[0].weeklyChargeCents).toBe(45_000)
  })

  it('overnight shift is measured across midnight (no false warning)', () => {
    const night: PostInput = { postName: 'Night', hoursPerWeek: 56, hourlyRateCents: 3200, startTime: '22:00', endTime: '06:00' }
    expect(weeklyCharges([night], TAX_600, { minimumShiftHours: 4 }).warnings).toEqual([])
  })

  it('missing tax rate throws a clear error', () => {
    expect(() => weeklyCharges([POST_A], null)).toThrow(/No sales tax rate is set up/)
  })

  it('unconfirmed tax rate throws a clear error', () => {
    expect(() => weeklyCharges([POST_A], { ...TAX_600, confirmedAt: null })).toThrow(/MD has not been confirmed/)
  })

  it('rejects float-y or negative inputs instead of rounding them silently', () => {
    expect(() => weeklyCharges([{ ...POST_A, hoursPerWeek: '10.555' }], TAX_600)).toThrow(/at most 2 decimal places/)
    expect(() => weeklyCharges([{ ...POST_A, hourlyRateCents: 32.5 }], TAX_600)).toThrow(/integer number of cents/)
    expect(() => weeklyCharges([{ ...POST_A, hoursPerWeek: -5 }], TAX_600)).toThrow(/non-negative decimal/)
  })
})

describe('holidayRate', () => {
  it('1.5 × $32.00 = $48.00', () => expect(holidayRate(3200, 1.5)).toBe(4800))
  it('rounds half-up: 1.5 × $31.33 = $46.995 → $47.00', () => expect(holidayRate(3133, '1.5')).toBe(4700))
})

describe('lateFee (Section 8.5)', () => {
  it('285,352 past due → 5,000 (minimum applies)', () => expect(lateFee(285_352, LATE)).toBe(5_000))
  it('1,000,000 past due → 15,000', () => expect(lateFee(1_000_000, LATE)).toBe(15_000))
  it('nothing past due → 0', () => expect(lateFee(0, LATE)).toBe(0))
})

describe('lateFeeSchedule', () => {
  it('day after due date, then every 30 days', () => {
    expect(lateFeeSchedule('2026-01-07', '2026-03-10', 30)).toEqual(['2026-01-08', '2026-02-07', '2026-03-09'])
  })
  it('nothing on or before the due date', () => {
    expect(lateFeeSchedule('2026-01-07', '2026-01-07', 30)).toEqual([])
  })
})

describe('earlyTerminationFee (Section 9.6)', () => {
  it('269,200 subtotal, 210 days remaining, 5000 bps → 4,038,000', () => {
    expect(earlyTerminationFee(269_200, '2026-01-01', '2026-07-30', 5000)).toBe(4_038_000)
  })
  it('termination on the term end date → 0', () => {
    expect(earlyTerminationFee(269_200, '2026-07-30', '2026-07-30', 5000)).toBe(0)
  })
  it('termination after the term end date → 0', () => {
    expect(earlyTerminationFee(269_200, '2026-08-15', '2026-07-30', 5000)).toBe(0)
  })
  it('partial weeks are proportional and rounded once (10 days)', () => {
    // 269,200 × 10/7 × 0.5 = 192,285.714… → 192,286
    expect(earlyTerminationFee(269_200, '2026-07-20', '2026-07-30', 5000)).toBe(192_286)
  })
})

describe('accountStanding', () => {
  const TODAY = '2026-06-30'
  const DEPOSIT = 570_704

  it('one invoice 3 days late → suspend only', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-06-27', amountCents: 285_352 }], DEPOSIT, TODAY, LATE)
    expect(s.pastDueCents).toBe(285_352)
    expect(s.oldestDaysPastDue).toBe(3)
    expect(s.lateFeesDueCents).toBe(5_000)
    expect(s.suspendEligible).toBe(true)
    expect(s.terminateEligible).toBe(false)
    expect(s.reasons.map(r => r.section)).toEqual(['8.1(b), 8.2'])
  })

  it('one invoice 15 days late → terminate eligible (Section 8.9)', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-06-15', amountCents: 285_352 }], DEPOSIT, TODAY, LATE)
    expect(s.oldestDaysPastDue).toBe(15)
    expect(s.suspendEligible).toBe(true)
    expect(s.terminateEligible).toBe(true)
    expect(s.reasons.some(r => r.rule === 'terminate' && r.section.includes('8.9') && /15 days/.test(r.message))).toBe(true)
  })

  it('past due greater than the deposit → terminate eligible', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-06-28', amountCents: 600_000 }], DEPOSIT, TODAY, LATE)
    expect(s.oldestDaysPastDue).toBe(2)
    expect(s.terminateEligible).toBe(true)
    expect(s.reasons.some(r => r.message === 'Past-due balance exceeds the Security Deposit')).toBe(true)
  })

  it('declined payment alone → suspend eligible (Section 8.1(a))', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-07-05', amountCents: 285_352, declinedDates: ['2026-06-29'] }], DEPOSIT, TODAY, LATE)
    expect(s.pastDueCents).toBe(0)
    expect(s.suspendEligible).toBe(true)
    expect(s.terminateEligible).toBe(false)
  })

  it('2 payment defaults in 6 months → terminate eligible (Section 8.6)', () => {
    const s = accountStanding([
      { id: 'i1', dueDate: '2026-03-01', amountCents: 285_352, paidCents: 285_352, paidDate: '2026-03-04' }, // paid late
      { id: 'i2', dueDate: '2026-05-01', amountCents: 285_352, paidCents: 285_352, paidDate: '2026-05-02', declinedDates: ['2026-05-01'] },
    ], DEPOSIT, TODAY, LATE)
    expect(s.pastDueCents).toBe(0)
    expect(s.paymentDefaultsLast6Months).toBe(3)
    expect(s.terminateEligible).toBe(true)
    expect(s.reasons.some(r => r.section.startsWith('8.6'))).toBe(true)
  })

  it('defaults older than 6 months do not count', () => {
    const s = accountStanding([
      { id: 'i1', dueDate: '2025-11-01', amountCents: 1000, paidCents: 1000, paidDate: '2025-11-10' },
      { id: 'i2', dueDate: '2025-12-01', amountCents: 1000, paidCents: 1000, paidDate: '2025-12-10' },
    ], DEPOSIT, TODAY, LATE)
    expect(s.paymentDefaultsLast6Months).toBe(0)
    expect(s.terminateEligible).toBe(false)
  })

  it('paid-on-time account is in good standing', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-06-20', amountCents: 285_352, paidCents: 285_352, paidDate: '2026-06-20' }], DEPOSIT, TODAY, LATE)
    expect(s).toMatchObject({ pastDueCents: 0, lateFeesDueCents: 0, suspendEligible: false, terminateEligible: false, reasons: [] })
  })

  it('late fees accrue again every 30 days on one invoice', () => {
    // due 2026-05-01: fees on 05-02, 06-01 → 2 × max(5,000, 1.5% × 1,000,000 = 15,000)
    const s = accountStanding([{ id: 'i1', dueDate: '2026-05-01', amountCents: 1_000_000 }], DEPOSIT, TODAY, LATE)
    expect(s.lateFeesDueCents).toBe(30_000)
  })

  it('client 3 weeks behind gets ONE account-level late fee, not three', () => {
    // Weekly invoices due 06-09, 06-16, 06-23, all unpaid, today 06-30.
    // One accrual (06-10); next would be 07-10. On 06-10 only the first invoice
    // was past due: max(5,000, 1.5% × 285,352 = 4,280) = 5,000.
    const s = accountStanding([
      { id: 'w1', dueDate: '2026-06-09', amountCents: 285_352 },
      { id: 'w2', dueDate: '2026-06-16', amountCents: 285_352 },
      { id: 'w3', dueDate: '2026-06-23', amountCents: 285_352 },
    ], DEPOSIT, TODAY, LATE)
    expect(s.pastDueCents).toBe(856_056)
    expect(s.lateFeesDueCents).toBe(5_000)
  })

  it('second account-level fee uses the larger balance past due on its date', () => {
    // Due 05-05, 05-12, 05-19, 05-26, all unpaid, today 06-30.
    // Accruals: 05-06 (1 invoice past due → 5,000) and 06-05 (all 4 past due:
    // 1.5% × 1,141,408 = 17,121.12 → 17,121). Total 22,121.
    const s = accountStanding(['05-05', '05-12', '05-19', '05-26'].map((d, i) => (
      { id: `w${i}`, dueDate: `2026-${d}`, amountCents: 285_352 }
    )), DEPOSIT, TODAY, LATE)
    expect(s.lateFeesDueCents).toBe(22_121)
  })

  it('declined payment on an invoice since paid no longer supports suspension', () => {
    const s = accountStanding([{ id: 'i1', dueDate: '2026-06-20', amountCents: 285_352, paidCents: 285_352, paidDate: '2026-06-20', declinedDates: ['2026-06-19'] }], DEPOSIT, TODAY, LATE)
    expect(s.suspendEligible).toBe(false)
    expect(s.paymentDefaultsLast6Months).toBe(1)
  })
})

describe('accountStanding: logged defaults, 8.1(c)–(e)', () => {
  const TODAY = '2026-06-30'
  const DEPOSIT = 570_704
  const paidOnTime = [{ id: 'i1', dueDate: '2026-06-20', amountCents: 285_352, paidCents: 285_352, paidDate: '2026-06-20' }]

  it('each uncured logged default supports suspension with its section', () => {
    const s = accountStanding(paidOnTime, DEPOSIT, TODAY, LATE, [
      { eventType: 'authorization_revoked', date: '2026-06-25' },
    ])
    expect(s.suspendEligible).toBe(true)
    expect(s.terminateEligible).toBe(false)
    expect(s.reasons.map(r => r.section)).toEqual(['8.1(c), 8.2'])
  })

  it('cured logged default counts toward 8.6 but not suspension', () => {
    const s = accountStanding(paidOnTime, DEPOSIT, TODAY, LATE, [
      { eventType: 'deposit_not_restored', date: '2026-04-01', curedDate: '2026-04-03' },
    ])
    expect(s.suspendEligible).toBe(false)
    expect(s.paymentDefaultsLast6Months).toBe(1)
  })

  it('two logged defaults in 6 months → terminate eligible (8.6)', () => {
    const s = accountStanding(paidOnTime, DEPOSIT, TODAY, LATE, [
      { eventType: 'chargeback_unfounded', date: '2026-02-10', curedDate: '2026-02-20' },
      { eventType: 'deposit_not_restored', date: '2026-05-10', curedDate: '2026-05-12' },
    ])
    expect(s.paymentDefaultsLast6Months).toBe(2)
    expect(s.terminateEligible).toBe(true)
  })

  it('logged and invoice defaults combine toward 8.6', () => {
    const s = accountStanding(
      [{ id: 'i1', dueDate: '2026-03-01', amountCents: 1000, paidCents: 1000, paidDate: '2026-03-05' }],
      DEPOSIT, TODAY, LATE,
      [{ eventType: 'chargeback_unfounded', date: '2026-05-01', curedDate: '2026-05-02' }],
    )
    expect(s.paymentDefaultsLast6Months).toBe(2)
    expect(s.terminateEligible).toBe(true)
  })

  it('unknown event type throws', () => {
    expect(() => accountStanding([], DEPOSIT, TODAY, LATE, [{ eventType: 'bogus' as never, date: '2026-06-01' }])).toThrow(/Unknown logged default/)
  })
})

describe('helpers', () => {
  it('roundDiv rounds half-up exactly', () => {
    expect(roundDiv(5, 10)).toBe(1)
    expect(roundDiv(4, 10)).toBe(0)
    expect(roundDiv(15, 10)).toBe(2)
  })
  it('toScaledInt parses decimals without float error', () => {
    expect(toScaledInt('0.07', 2)).toBe(7)
    expect(toScaledInt(1.5, 4)).toBe(15000)
  })
  it('formatCents', () => {
    expect(formatCents(570_704)).toBe('$5,707.04')
    expect(formatCents(5)).toBe('$0.05')
  })
})

const MULT = { overtime: '1.50', holiday: '1.50', shortNotice: '1.70', emergency: null }

describe('derivedRates', () => {
  it('$50 base: overtime and holiday 1.5×, short-notice 1.7× = $85, emergency unset', () => {
    expect(derivedRates(5000, MULT)).toEqual({ regular: 5000, overtime: 7500, holiday: 7500, shortNotice: 8500, emergency: null })
  })
  it('rounds half-up once: $31.33 × 1.7 = $53.261 → $53.26', () => {
    expect(derivedRates(3133, MULT).shortNotice).toBe(5326)
  })
  it('emergency multiplier applies once set', () => {
    expect(derivedRates(5000, { ...MULT, emergency: '2.00' }).emergency).toBe(10000)
  })
})

describe('postDerivedRates: each post uses its own rate, else the base', () => {
  it('post with a rate uses it; post without falls back to the contract base', () => {
    const r = postDerivedRates([
      { postName: 'Lobby', hoursPerWeek: 40, hourlyRateCents: 3200 },
      { postName: 'Garage', hoursPerWeek: 20 },
    ], 3000, MULT)
    expect(r[0]).toMatchObject({ rateSource: 'post', regular: 3200, overtime: 4800, shortNotice: 5440 })
    expect(r[1]).toMatchObject({ rateSource: 'base', regular: 3000, overtime: 4500, shortNotice: 5100 })
  })
  it('no post rate and no base rate throws', () => {
    expect(() => postDerivedRates([{ postName: 'Gate', hoursPerWeek: 10 }], null, MULT)).toThrow(/no hourly rate/)
  })
})

describe('termLength (inclusive dates)', () => {
  it('10-day contract', () => {
    expect(termLength('2026-07-01', '2026-07-10')).toMatchObject({ days: 10, weeksExact: '1.43', wholeWeeks: 1, months: 0, label: '10 days' })
  })
  it('one day', () => expect(termLength('2026-07-01', '2026-07-01')).toMatchObject({ days: 1, label: '1 day' }))
  it('weeks when under a month', () => expect(termLength('2026-01-05', '2026-02-03').label).toBe('4 weeks 2 days'))
  it('exact months', () => expect(termLength('2026-01-01', '2026-06-30')).toMatchObject({ months: 6, monthRemainderDays: 0, label: '6 months' }))
  it('one year', () => expect(termLength('2026-01-01', '2026-12-31')).toMatchObject({ days: 365, years: 1, label: '1 year' }))
  it('months and days', () => expect(termLength('2026-01-01', '2026-04-12').label).toBe('3 months 12 days'))
  it('years and months', () => expect(termLength('2026-01-01', '2027-02-28').label).toBe('1 year 2 months'))
  it('end before start throws', () => expect(() => termLength('2026-07-10', '2026-07-01')).toThrow(/on or after/))
})

describe('contractValue: 10-day contract starting mid-week (estimate)', () => {
  // 2026-07-01 is a Wednesday; term runs Wed 07-01 through Fri 07-10.
  const TERM = { start: '2026-07-01', end: '2026-07-10' }
  const WEEKDAYS: PostInput = { postName: 'Lobby', hoursPerWeek: 40, hourlyRateCents: 3200, daysOfWeek: [1, 2, 3, 4, 5] }
  const WEEKEND: PostInput  = { postName: 'Weekend', hoursPerWeek: 16, hourlyRateCents: 3000, daysOfWeek: [0, 6] }

  it('counts the actual scheduled days', () => {
    expect(countScheduledDays(TERM.start, TERM.end, [1, 2, 3, 4, 5])).toBe(8)   // W Th F, M T W Th F
    expect(countScheduledDays(TERM.start, TERM.end, [0, 6])).toBe(2)            // Sat 07-04, Sun 07-05
  })

  it('values each post by its occurrences, then tax once', () => {
    const v = contractValue([WEEKDAYS, WEEKEND], TERM, TAX_600)
    // Lobby: 8 days × 8 h × $32 = $2,048.00; Weekend: 2 days × 8 h × $30 = $480.00
    expect(v.perPost.map(p => [p.method, p.occurrences, p.valueCents])).toEqual([['scheduled_days', 8, 204_800], ['scheduled_days', 2, 48_000]])
    expect(v.subtotalCents).toBe(252_800)
    expect(v.taxCents).toBe(15_168)
    expect(v.totalCents).toBe(267_968)
    expect(v.isEstimate).toBe(true)
    expect(v.note).toMatch(/^Estimate/)
  })

  it('post with no days set falls back to days ÷ 7 proration', () => {
    // 56 h × $32 = $1,792/week × 10/7 = $2,560.00
    const v = contractValue([{ postName: 'Gate', hoursPerWeek: 56, hourlyRateCents: 3200 }], TERM, TAX_600)
    expect(v.perPost[0]).toMatchObject({ method: 'prorated', occurrences: null, valueCents: 256_000 })
  })

  it('post without a rate uses the contract base rate', () => {
    const v = contractValue([{ ...WEEKEND, hourlyRateCents: null }], TERM, TAX_600, { baseRateCents: 2500 })
    expect(v.perPost[0]).toMatchObject({ hourlyRateCents: 2500, valueCents: 40_000 })
  })

  it('tax-exempt client: no tax and no confirmed rate needed', () => {
    const v = contractValue([WEEKDAYS], TERM, null, { exempt: true })
    expect(v).toMatchObject({ subtotalCents: 204_800, taxCents: 0, totalCents: 204_800 })
  })

  it('not exempt and no confirmed rate throws', () => {
    expect(() => contractValue([WEEKDAYS], TERM, null)).toThrow(/No sales tax rate/)
  })

  it('uneven split rounds once per post', () => {
    // 10 h/wk split over Mon/Wed/Fri doesn't divide evenly, so the post is computed as one fraction.
    const v = contractValue([{ postName: 'Odd', hoursPerWeek: 10, hourlyRateCents: 3333, daysOfWeek: [1, 3, 5] }], TERM, TAX_600)
    // occurrences: W 07-01, F 07-03, M 07-06, W 07-08, F 07-10 = 5; 10 h × $33.33 × 5 / 3 = $555.50
    expect(v.perPost[0]).toMatchObject({ occurrences: 5, valueCents: 55_550 })
  })
})

describe('weeklyCharges: exempt option', () => {
  it('exempt client pays no tax and needs no confirmed rate', () => {
    const r = weeklyCharges([POST_A, POST_B], null, { exempt: true })
    expect(r).toMatchObject({ subtotalCents: 269_200, taxCents: 0, weeklyTotalCents: 269_200 })
    expect(securityDeposit(r.weeklyTotalCents, 2)).toBe(538_400)
  })
  it('post rate falls back to the base rate', () => {
    expect(weeklyCharges([{ postName: 'X', hoursPerWeek: 10 }], TAX_600, { baseRateCents: 3000 }).subtotalCents).toBe(30_000)
  })
})
