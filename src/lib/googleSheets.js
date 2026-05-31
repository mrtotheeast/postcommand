// Google Sheets export helper — calls google-sheets-export edge function
import { supabase } from './supabase'

export async function exportToSheets(title, type, rows) {
  if (!rows?.length) return null
  try {
    const { data, error } = await supabase.functions.invoke('google-sheets-export', {
      body: { title, type, rows }
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    if (data?.url) window.open(data.url, '_blank')
    return data
  } catch (e) {
    console.error('Google Sheets export failed:', e.message)
    throw e
  }
}
