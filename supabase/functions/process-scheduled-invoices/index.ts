import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Called by cron-job.org on a schedule (e.g. every 15 minutes)
// Finds invoices with send_scheduled_at <= now() and status = 'draft'
// Sends them via the send-email function and marks them sent

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    // Find all invoices scheduled to send that haven't been sent yet
    const { data: invoices, error } = await supabase
      .from('invoice')
      .select('*, client:client_id(name), company:company_id(name, email)')
      .lte('send_scheduled_at', now)
      .eq('status', 'draft')
      .not('send_scheduled_at', 'is', null)
      .not('client_email', 'is', null)

    if (error) throw error
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let sent = 0
    let failed = 0

    for (const invoice of invoices) {
      try {
        // Call send-email function
        const emailRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            type: 'invoice',
            to: invoice.client_email,
            data: {
              invoiceNumber: invoice.invoice_number,
              amount: invoice.total,
              dueDate: invoice.due_date,
              pdf_url: invoice.pdf_url,
              companyName: invoice.company?.name,
              company_id: invoice.company_id,
              total_cents: Math.round((invoice.total || 0) * 100),
              invoice_id: invoice.id,
            }
          })
        })

        if (emailRes.ok) {
          // Mark as sent
          await supabase
            .from('invoice')
            .update({ status: 'sent', sent_at: new Date().toISOString(), send_scheduled_at: null })
            .eq('id', invoice.id)
            .eq('company_id', invoice.company_id)
          sent++
        } else {
          failed++
        }
      } catch (invoiceErr) {
        console.error(`Failed to send invoice ${invoice.id}:`, invoiceErr)
        failed++
      }
    }

    return new Response(JSON.stringify({ processed: invoices.length, sent, failed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
