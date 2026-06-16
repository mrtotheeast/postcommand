import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOLD  = rgb(200/255, 168/255, 75/255)   // #c8a84b
const DARK  = rgb(13/255,  15/255,  20/255)   // #0d0f14
const MUTED = rgb(110/255, 120/255, 135/255)
const LIGHT = rgb(0.95, 0.96, 0.97)
const WHITE = rgb(1, 1, 1)
const GREEN = rgb(0.13, 0.55, 0.32)

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!text) return []
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? current + ' ' + word : word
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test
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
    const { invoice_id, company_id } = await req.json()
    if (!invoice_id || !company_id) {
      return new Response(JSON.stringify({ error: 'invoice_id and company_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: invoice, error: invErr } = await supabase
      .from('invoice')
      .select('*, invoice_item(*)')
      .eq('id', invoice_id)
      .eq('company_id', company_id)
      .single()

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: invErr?.message || 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: company } = await supabase
      .from('company')
      .select('name, email, phone, address')
      .eq('id', company_id)
      .single()

    // ── Build PDF ────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create()
    const page   = pdfDoc.addPage([612, 792])
    const { width, height } = page.getSize()
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const margin   = 48
    const contentW = width - margin * 2
    const items    = invoice.invoice_item || []
    const coName   = (company?.name || 'PostCommand').toUpperCase()

    let y = height - 52

    // ── COMPANY (left) / INVOICE label (right) ───────────────────────────────
    const invLabel = 'INVOICE'
    const invLabelW = bold.widthOfTextAtSize(invLabel, 28)
    page.drawText(invLabel, { x: width - margin - invLabelW, y, font: bold, size: 28, color: GOLD })
    page.drawText(coName, { x: margin, y, font: bold, size: 14, color: DARK })

    y -= 18

    // Invoice number (right)
    const invNumW = bold.widthOfTextAtSize(invoice.invoice_number, 11)
    page.drawText(invoice.invoice_number, { x: width - margin - invNumW, y, font: bold, size: 11, color: GOLD })

    // Company contact details (left)
    const coDetails = [company?.address, company?.phone, company?.email].filter(Boolean) as string[]
    for (const line of coDetails) {
      page.drawText(line, { x: margin, y, font: reg, size: 9, color: MUTED })
      y -= 13
    }
    if (coDetails.length === 0) y -= 13

    y -= 10

    // Gold rule
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: GOLD })
    y -= 20

    // ── ISSUE DATE / DUE DATE / STATUS ───────────────────────────────────────
    const col2 = margin + 150
    const col3 = margin + 300

    page.drawText('ISSUE DATE', { x: margin, y, font: bold, size: 7.5, color: MUTED })
    page.drawText('DUE DATE',   { x: col2,   y, font: bold, size: 7.5, color: MUTED })
    page.drawText('STATUS',     { x: col3,   y, font: bold, size: 7.5, color: MUTED })
    y -= 14

    page.drawText(fmtDate(invoice.issue_date), { x: margin, y, font: reg, size: 11, color: DARK })
    page.drawText(fmtDate(invoice.due_date),   { x: col2,   y, font: reg, size: 11, color: DARK })
    const statusStr = (invoice.status || 'draft').toUpperCase()
    const statusColor = invoice.status === 'paid' ? GREEN : DARK
    page.drawText(statusStr, { x: col3, y, font: bold, size: 11, color: statusColor })

    y -= 24

    // ── BILL TO ──────────────────────────────────────────────────────────────
    page.drawText('BILL TO', { x: margin, y, font: bold, size: 7.5, color: MUTED })
    y -= 14

    page.drawText(invoice.client_name || '—', { x: margin, y, font: bold, size: 12, color: DARK })
    y -= 14

    if (invoice.client_email) {
      page.drawText(invoice.client_email, { x: margin, y, font: reg, size: 9, color: MUTED })
      y -= 13
    }
    if (invoice.client_address) {
      page.drawText(invoice.client_address, { x: margin, y, font: reg, size: 9, color: MUTED })
      y -= 13
    }

    y -= 16

    // ── LINE ITEMS TABLE ─────────────────────────────────────────────────────
    const ROW_H    = 22
    const HDR_H    = 26
    const COL_QTY  = margin + Math.round(contentW * 0.57)
    const COL_UP   = margin + Math.round(contentW * 0.70)
    const COL_AMT  = width - margin - 6

    // Header band
    page.drawRectangle({ x: margin, y: y - HDR_H + 8, width: contentW, height: HDR_H, color: GOLD })
    const hdrY = y - HDR_H + 20
    page.drawText('DESCRIPTION', { x: margin + 6, y: hdrY, font: bold, size: 7.5, color: WHITE })
    page.drawText('QTY',        { x: COL_QTY,    y: hdrY, font: bold, size: 7.5, color: WHITE })
    page.drawText('UNIT PRICE', { x: COL_UP,     y: hdrY, font: bold, size: 7.5, color: WHITE })
    page.drawText('AMOUNT',     { x: COL_AMT - reg.widthOfTextAtSize('AMOUNT', 7.5), y: hdrY, font: bold, size: 7.5, color: WHITE })

    y -= HDR_H + 6

    // Rows
    for (let i = 0; i < items.length; i++) {
      const it  = items[i]
      const rowY = y - 4

      if (i % 2 === 1) {
        page.drawRectangle({ x: margin, y: rowY - 10, width: contentW, height: ROW_H, color: LIGHT })
      }

      // Truncate description to fit column
      const maxDescW = COL_QTY - margin - 12
      let desc = it.description || ''
      if (reg.widthOfTextAtSize(desc, 10) > maxDescW) {
        while (desc.length > 0 && reg.widthOfTextAtSize(desc + '…', 10) > maxDescW) {
          desc = desc.slice(0, -1)
        }
        desc += '…'
      }

      const amtStr = fmtMoney(it.amount)
      const amtW   = reg.widthOfTextAtSize(amtStr, 10)
      const upStr  = fmtMoney(it.unit_price)
      const upW    = reg.widthOfTextAtSize(upStr, 10)

      page.drawText(desc,                 { x: margin + 6, y: rowY, font: reg, size: 10, color: DARK })
      page.drawText(String(it.quantity),  { x: COL_QTY,   y: rowY, font: reg, size: 10, color: DARK })
      page.drawText(upStr,                { x: COL_UP + (60 - upW), y: rowY, font: reg, size: 10, color: DARK })
      page.drawText(amtStr,               { x: COL_AMT - amtW, y: rowY, font: bold, size: 10, color: DARK })

      y -= ROW_H
    }

    // Bottom table rule
    y -= 4
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.82, 0.84, 0.87) })
    y -= 18

    // ── TOTALS ───────────────────────────────────────────────────────────────
    const TOTAL_X = width - margin - 200

    const subStr = fmtMoney(invoice.subtotal)
    page.drawText('Subtotal', { x: TOTAL_X, y, font: reg, size: 11, color: MUTED })
    page.drawText(subStr,     { x: COL_AMT - reg.widthOfTextAtSize(subStr, 11), y, font: reg, size: 11, color: DARK })
    y -= 16

    if ((invoice.tax_amount || 0) > 0) {
      const taxStr = fmtMoney(invoice.tax_amount)
      page.drawText(`Tax (${invoice.tax_rate}%)`, { x: TOTAL_X, y, font: reg, size: 11, color: MUTED })
      page.drawText(taxStr, { x: COL_AMT - reg.widthOfTextAtSize(taxStr, 11), y, font: reg, size: 11, color: DARK })
      y -= 16
    }

    page.drawLine({ start: { x: TOTAL_X, y: y + 4 }, end: { x: width - margin, y: y + 4 }, thickness: 1, color: GOLD })
    y -= 10

    const totStr  = fmtMoney(invoice.total)
    const totStrW = bold.widthOfTextAtSize(totStr, 14)
    page.drawText('TOTAL DUE', { x: TOTAL_X,             y, font: bold, size: 14, color: DARK })
    page.drawText(totStr,      { x: COL_AMT - totStrW,   y, font: bold, size: 14, color: GOLD })
    y -= 30

    // ── NOTES ────────────────────────────────────────────────────────────────
    if (invoice.notes?.trim()) {
      page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.5, color: rgb(0.82, 0.84, 0.87) })
      y -= 8
      page.drawText('NOTES', { x: margin, y, font: bold, size: 7.5, color: MUTED })
      y -= 14
      const noteLines = wrapText(invoice.notes.trim(), reg, 10, contentW)
      for (const line of noteLines) {
        if (y < 70) break
        page.drawText(line, { x: margin, y, font: reg, size: 10, color: MUTED })
        y -= 13
      }
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = 36
    page.drawLine({ start: { x: margin, y: footerY + 18 }, end: { x: width - margin, y: footerY + 18 }, thickness: 0.5, color: rgb(0.82, 0.84, 0.87) })
    const footerText = `Thank you for your business.${company?.email ? `  Questions? ${company.email}` : ''}`
    const ftW = reg.widthOfTextAtSize(footerText, 8.5)
    page.drawText(footerText, { x: (width - ftW) / 2, y: footerY, font: reg, size: 8.5, color: MUTED })

    const pdfBytes = await pdfDoc.save()

    // ── Upload to Storage ────────────────────────────────────────────────────
    await supabase.storage.createBucket('invoices', { public: true }).catch(() => {})

    const path = `${company_id}/${invoice_id}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(path)
    const pdf_url = urlData?.publicUrl || null

    if (pdf_url) {
      await supabase.from('invoice').update({ pdf_url }).eq('id', invoice_id)
    }

    return new Response(JSON.stringify({ success: true, pdf_url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
