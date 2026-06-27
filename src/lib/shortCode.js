import { supabase } from './supabase'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = genCode()
    const { data } = await supabase.from('company').select('id').eq('short_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('short_code generation: exhausted retries')
}
