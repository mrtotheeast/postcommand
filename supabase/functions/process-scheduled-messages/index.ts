// Scheduled Message Processor
// Flushes scheduled_message rows where send_at <= NOW() and sent = false
// into the message table so they appear in real-time chat.
// Run via Supabase cron every 5 minutes:
//   schedule: "*/5 * * * *"
//   function: process-scheduled-messages

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    // Fetch all messages due to be sent
    const { data: due, error: fetchErr } = await supabase
      .from('scheduled_message')
      .select('*')
      .lte('send_at', now)
      .eq('sent', false)

    if (fetchErr) throw fetchErr
    if (!due?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // Insert each into the message table
    const inserts = due.map(m => ({
      company_id:   m.company_id,
      channel_id:   m.channel_id,
      channel_name: m.channel_name,
      sender_id:    m.sender_id,
      sender_name:  m.sender_name ? `${m.sender_name} (scheduled)` : 'Scheduled',
      sender_role:  m.sender_role,
      content:      m.content,
      message_type: 'announcement',
      created_at:   m.send_at,  // Use the scheduled time, not now
    }))

    const { error: insertErr } = await supabase.from('message').insert(inserts)
    if (insertErr) throw insertErr

    // Mark as sent
    const ids = due.map(m => m.id)
    await supabase.from('scheduled_message').update({ sent: true, sent_at: now }).in('id', ids)

    return new Response(JSON.stringify({ processed: due.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
