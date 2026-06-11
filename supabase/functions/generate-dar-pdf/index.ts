import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACCENT_RGB = rgb(0.788, 0.635, 0.153) // #c9a227
const DARK_RGB   = rgb(0.055, 0.063, 0.078) // #0e1014
const GRAY_RGB   = rgb(0.53, 0.58, 0.635)

function wrap(text: string, maxChars: number): string[] {
  if (!text) return []
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trimStart().length <= maxChars) {
      current = (current + ' ' + word).trimStart()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { dar_id } = await req.json()
    if (!dar_id) return new Response(JSON.stringify({ error: 'dar_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: dar, error: darErr } = await supabase
      .from('dar')
      .select('*, site:site_id(name,address,city,state,zip_code), company:company_id(name,logo_url,company_address,company_phone,company_email)')
      .eq('id', dar_id)
      .single()

    if (darErr || !dar) {
      return new Response(JSON.stringify({ error: 'DAR not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const pdfDoc = await PDFDocument.create()
    const page   = pdfDoc.addPage([612, 792]) // US Letter
    const { width, height } = page.getSize()
    const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const margin = 48
    const contentW = width - margin * 2

    // Header band
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK_RGB })

    // Title
    page.drawText('DAILY ACTIVITY REPORT', {
      x: margin, y: height - 34, size: 18, font: bold, color: ACCENT_RGB,
    })

    // Company name
    const companyName = dar.company?.name || 'PostCommand'
    page.drawText(companyName, {
      x: margin, y: height - 54, size: 10, font: reg, color: rgb(0.75, 0.78, 0.82),
    })

    // Header right — date
    const dateStr = dar.shift_date
      ? new Date(dar.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
      : ''
    const dateW = reg.widthOfTextAtSize(dateStr, 9)
    page.drawText(dateStr, {
      x: width - margin - dateW, y: height - 36, size: 9, font: reg, color: rgb(0.75, 0.78, 0.82),
    })

    let y = height - 100

    // Site + shift info
    const siteName = dar.site?.name || '—'
    page.drawText(siteName, { x: margin, y, size: 14, font: bold, color: DARK_RGB })
    y -= 18
    const shiftStr = `${dar.shift_label || 'General Shift'}  ·  ${dateStr}`
    page.drawText(shiftStr, { x: margin, y, size: 9, font: reg, color: GRAY_RGB })
    y -= 6

    // Address
    if (dar.site?.address || dar.site?.city) {
      y -= 12
      const addrParts = [dar.site.address, dar.site.city, dar.site.state, dar.site.zip_code].filter(Boolean)
      page.drawText(addrParts.join(', '), { x: margin, y, size: 9, font: reg, color: GRAY_RGB })
      y -= 4
    }

    y -= 16

    // Divider
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.87, 0.88, 0.89) })
    y -= 20

    function drawSection(title: string, content: string | null) {
      if (!content?.trim()) return
      if (y < 80) return

      // Section label
      page.drawText(title.toUpperCase(), { x: margin, y, size: 8, font: bold, color: ACCENT_RGB })
      y -= 14

      const lines = wrap(content.trim(), 90)
      for (const line of lines) {
        if (y < 60) break
        page.drawText(line, { x: margin, y, size: 10, font: reg, color: rgb(0.15, 0.18, 0.22) })
        y -= 14
      }
      y -= 10
    }

    drawSection('Officers on Duty', dar.officers_on_duty)
    drawSection('Incident Summary', dar.incident_summary)
    drawSection('Patrol Summary', dar.patrol_summary)
    drawSection('Maintenance Concerns', dar.maintenance_concerns)
    drawSection('Resident / Client Concerns', dar.resident_concerns)
    drawSection('Other Notes', dar.other_notes)

    // Footer
    page.drawLine({ start: { x: margin, y: 48 }, end: { x: width - margin, y: 48 }, thickness: 0.5, color: rgb(0.87, 0.88, 0.89) })
    const footerParts = [companyName]
    if (dar.company?.company_phone) footerParts.push(dar.company.company_phone)
    if (dar.company?.company_email) footerParts.push(dar.company.company_email)
    page.drawText(footerParts.join('  ·  '), {
      x: margin, y: 30, size: 8, font: reg, color: GRAY_RGB,
    })
    const pageLabel = 'Page 1'
    const pgW = reg.widthOfTextAtSize(pageLabel, 8)
    page.drawText(pageLabel, { x: width - margin - pgW, y: 30, size: 8, font: reg, color: GRAY_RGB })

    const pdfBytes = await pdfDoc.save()

    // Upload to storage
    const fileName = `dar_${dar_id}_${Date.now()}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('dar-pdfs')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: urlData } = supabase.storage.from('dar-pdfs').getPublicUrl(fileName)
    const pdf_url = urlData?.publicUrl || null

    if (pdf_url) {
      await supabase.from('dar').update({ pdf_url }).eq('id', dar_id)
    }

    return new Response(JSON.stringify({ success: true, pdf_url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
