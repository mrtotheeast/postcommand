/**
 * Wraps any async data-load function with a fallback timeout.
 *
 * If the wrapped function does not settle within `ms` milliseconds,
 * the timeout fires immediately: setLoading(false) is called so the
 * UI exits the loading state, and setError (if provided) displays a
 * "Please refresh" message. The original fetch is left to complete or
 * abort on its own — state updates from it arrive normally if it does.
 *
 * The wrapped function is still expected to call setLoading(false)
 * in a finally block itself. This is belt-and-suspenders: whichever
 * fires first (normal completion vs. timeout) wins.
 *
 * Usage:
 *   const load = withLoadTimeout(async function() {
 *     setLoading(true)
 *     try {
 *       const { data } = await supabase.from('table').select('*')
 *       setData(data || [])
 *     } finally {
 *       setLoading(false)
 *     }
 *   }, { setLoading, setError })
 */
export function withLoadTimeout(fn, { setLoading, setError, ms = 10_000 } = {}) {
  return function (...args) {
    const timer = setTimeout(() => {
      setLoading?.(false)
      setError?.('Failed to load. Please refresh.')
    }, ms)
    return Promise.resolve(fn(...args)).finally(() => clearTimeout(timer))
  }
}
