import { supabase } from './supabase'

// Invoke a billing edge function and surface its { error } message on non-2xx
// (supabase-js otherwise throws a generic "non-2xx status code" error).
export async function invokeBilling(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let msg = error.message
    try { msg = (await error.context?.json())?.error || msg } catch { /* keep generic */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const fmtCents = (c) => `$${((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ordinal = (n) => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }

export function describeSchedule(b) {
  if (!b?.frequency) return '—'
  const weekday = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  switch (b.frequency) {
    case 'daily':    return 'Daily'
    case 'weekly':   return b.start_date ? `Weekly on ${weekday(b.start_date)}` : 'Weekly'
    case 'biweekly': return b.start_date ? `Every other ${weekday(b.start_date)}` : 'Bi-weekly'
    case 'days_of_month': {
      const d = [...(b.days_of_month || [])].sort((a, c) => a - c)
      return d.length === 1 ? `Monthly on the ${ordinal(d[0])}` : `Monthly on the ${d.map(ordinal).join(', ')}`
    }
    default: return b.frequency
  }
}
