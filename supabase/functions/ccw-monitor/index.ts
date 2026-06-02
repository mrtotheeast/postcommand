import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CCW Monitor — runs monthly via cron-job.org
// Checks handgunlaw.us for the last-updated date on the reciprocity PDF
// If it has changed since our last check, flags it in the admin panel
// Super Admin reviews and approves the update before it goes live

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch the handgunlaw.us reciprocity page to check for update date
    const res = await fetch('https://handgunlaw.us/states/USStatesThatHonorMyPermit.pdf', {
      headers: { 'User-Agent': 'PostCommand-CCW-Monitor/1.0' }
    })

    const lastModified = res.headers.get('last-modified') || new Date().toISOString()
    const checkDate = new Date().toISOString()

    // Get our stored last-verified date
    const { data: existing } = await supabase
      .from('ccw_monitor_log')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(1)
      .single()

    const sourceLastModified = new Date(lastModified).toISOString()
    const needsReview = !existing ||
      (existing.source_last_modified !== sourceLastModified)

    // Log the check
    await supabase.from('ccw_monitor_log').insert({
      checked_at: checkDate,
      source_url: 'https://handgunlaw.us/states/USStatesThatHonorMyPermit.pdf',
      source_last_modified: sourceLastModified,
      needs_review: needsReview,
      status: needsReview ? 'NEEDS_REVIEW' : 'CURRENT',
      notes: needsReview
        ? 'Handgunlaw.us reciprocity data has been updated. Super Admin review required before data refresh.'
        : 'No changes detected.'
    })

    // If needs review, create a platform notification for Super Admin
    if (needsReview) {
      await supabase.from('platform_notification').insert({
        type: 'ccw_update_required',
        title: 'CCW Reciprocity Data Update Available',
        message: `Handgunlaw.us updated their reciprocity data on ${new Date(sourceLastModified).toLocaleDateString()}. Review and approve the update in Super Admin → CCW Monitor before the map reflects new data. Always cross-reference with official state sources before approving.`,
        severity: 'warning',
        created_at: checkDate,
        resolved: false
      })
    }

    return new Response(JSON.stringify({
      status: needsReview ? 'NEEDS_REVIEW' : 'CURRENT',
      checked_at: checkDate,
      source_last_modified: sourceLastModified,
      message: needsReview ? 'Update available — admin review required' : 'Data is current'
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
