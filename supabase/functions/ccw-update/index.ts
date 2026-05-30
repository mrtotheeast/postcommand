// CCW Reciprocity AI Update Agent
// Runs monthly via Supabase cron scheduler
// Calls Anthropic Claude to check for state law changes and updates ccw_state_data table

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const supabase  = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch current data from DB
    const { data: currentData } = await supabase
      .from('ccw_state_data')
      .select('*')
      .order('state_code')

    const today = new Date().toISOString().slice(0, 10)

    // Ask Claude to check for recent changes
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      system: `You are a legal research assistant specializing in US firearms law and concealed carry reciprocity.
Your job is to identify recent changes (within the last 60 days) to state concealed carry laws.
Be conservative — only report confirmed legislative changes, not pending bills.
Focus on: constitutional carry enactments, reciprocity agreement changes, permit fee updates, training requirement changes.
Format your response as a JSON array of changes. If no changes, return an empty array.`,
      messages: [{
        role: 'user',
        content: `Today is ${today}. Review the current CCW data and identify any state law changes in the past 60 days.

Current data snapshot (permitType, fee, trainingHours per state):
${JSON.stringify(currentData?.map(s => ({ code:s.state_code, type:s.permit_type, fee:s.fee, training:s.training_hours })), null, 2)}

Return a JSON array of objects with this shape:
{ "state_code": "TX", "field": "permitType", "old_value": "shall_issue", "new_value": "constitutional", "reason": "HB 1927 enacted July 2021", "source": "Texas Legislature" }

Only include confirmed enacted laws, not bills under consideration.`
      }]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse changes
    let changes: any[] = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) changes = JSON.parse(jsonMatch[0])
    } catch {}

    // Apply changes to DB
    const applied: string[] = []
    for (const change of changes) {
      const { state_code, field, new_value, reason } = change
      if (!state_code || !field || new_value === undefined) continue

      await supabase.from('ccw_state_data')
        .update({ [field]: new_value, updated_by_agent: true, last_agent_update: today, agent_notes: reason })
        .eq('state_code', state_code)

      applied.push(`${state_code}: ${field} → ${new_value}`)
    }

    // Log the run
    await supabase.from('ccw_agent_log').insert({
      run_date: today,
      changes_applied: applied.length,
      change_summary: applied.join('; ') || 'No changes detected',
      claude_response: responseText.slice(0, 2000),
    })

    return new Response(
      JSON.stringify({ success: true, changes_applied: applied.length, changes: applied }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
