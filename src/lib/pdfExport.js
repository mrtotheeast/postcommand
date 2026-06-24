// PDF Export utilities using jsPDF + jspdf-autotable
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const BRAND = { primary: [200, 168, 75], dark: [13, 15, 20], gray: [122, 130, 153], lightGray: [240, 242, 248] }

// Fetches a logo URL and returns { dataUrl, aspectRatio } for jsPDF, or null on failure.
async function fetchLogoForPDF(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const img = new Image()
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = dataUrl })
    const aspectRatio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
    return { dataUrl, aspectRatio }
  } catch { return null }
}

function renderNameText(doc, company) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...BRAND.primary)
  doc.text((company?.name || 'POSTCOMMAND').toUpperCase(), 14, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.lightGray)
  doc.text('Security Workforce Management', 14, 15)
}

// company: optional { name, ... }; logo: optional { dataUrl, aspectRatio } from fetchLogoForPDF.
// Fallback chain: logo image → company name text → "POSTCOMMAND" text.
function addHeader(doc, title, subtitle, company, logo) {
  doc.setFillColor(...BRAND.dark)
  doc.rect(0, 0, 210, 24, 'F')
  if (logo) {
    const h = 16
    const w = Math.min(h * logo.aspectRatio, 60)
    try { doc.addImage(logo.dataUrl, 'PNG', 14, 4, w, h) } catch { renderNameText(doc, company) }
  } else {
    renderNameText(doc, company)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.lightGray)
  doc.text(title.toUpperCase(), 210 - 14, 10, { align:'right' })
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.gray)
    doc.text(subtitle, 210 - 14, 16, { align:'right' })
  }
  return 30
}

function addFooter(doc) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(37, 40, 56)
    doc.line(14, 285, 196, 285)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.gray)
    doc.text('PostCommand · Security Workforce Management · postcommand.app', 14, 290)
    doc.text(`Page ${i} of ${pages}`, 196, 290, { align:'right' })
  }
}

function fmtMoney(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0) }
function fmtDate(d) { if (!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

// ── Invoice PDF ───────────────────────────────────────────────────────────────

export async function exportInvoicePDF(invoice, items, company) {
  const logo = await fetchLogoForPDF(company?.logo_url)
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  let y = addHeader(doc, `Invoice ${invoice.invoice_number}`, invoice.client_name, company, logo)

  // Status badge
  const statusColors = { draft:[60,60,60], sent:[42,114,184], paid:[26,122,74], overdue:[176,48,48], void:[100,100,100] }
  const sc = statusColors[invoice.status] || statusColors.draft
  doc.setFillColor(...sc)
  doc.roundedRect(14, y, 24, 7, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255,255,255)
  doc.text((invoice.status||'draft').toUpperCase(), 26, y+4.5, { align:'center' })
  y += 12

  // Bill-to + dates
  doc.setTextColor(60,60,60)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('BILL TO', 14, y)
  doc.text('INVOICE DETAILS', 120, y)
  y += 5
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(invoice.client_name || '—', 14, y)
  doc.setFontSize(8); doc.setTextColor(100,100,100)
  if (invoice.client_email) doc.text(invoice.client_email, 14, y+4)
  if (invoice.client_address) doc.text(invoice.client_address, 14, y+8)
  doc.setFontSize(8); doc.setTextColor(60,60,60)
  const details = [
    ['Invoice Number:', invoice.invoice_number],
    ['Issue Date:', fmtDate(invoice.issue_date)],
    ['Due Date:', fmtDate(invoice.due_date)],
  ]
  details.forEach(([label, val], i) => {
    doc.setFont('helvetica','bold'); doc.text(label, 120, y + i*5)
    doc.setFont('helvetica','normal'); doc.text(val, 155, y + i*5)
  })
  y += 22

  // Line items table
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: (items||[]).map(it => [it.description, String(it.quantity), fmtMoney(it.unit_price), fmtMoney(it.amount)]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark, textColor: BRAND.primary, fontStyle:'bold', fontSize:8 },
    bodyStyles: { fontSize:9, textColor:[40,40,40] },
    columnStyles: { 1:{halign:'right',cellWidth:20}, 2:{halign:'right',cellWidth:30}, 3:{halign:'right',cellWidth:30} },
    margin: { left:14, right:14 },
    styles: { lineColor:[240,240,240], lineWidth:0.3 },
  })
  y = doc.lastAutoTable.finalY + 6

  // Totals block
  const totals = [['Subtotal', fmtMoney(invoice.subtotal)]]
  if (invoice.tax_amount > 0) totals.push([`Tax (${invoice.tax_rate}%)`, fmtMoney(invoice.tax_amount)])
  totals.push(['TOTAL', fmtMoney(invoice.total)])
  autoTable(doc, {
    startY: y,
    body: totals,
    theme: 'plain',
    columnStyles: { 0:{cellWidth:160,halign:'right',fontStyle:'normal',textColor:[100,100,100],fontSize:9}, 1:{cellWidth:22,halign:'right',fontStyle:'bold',textColor:[40,40,40],fontSize:9} },
    margin: { left:14, right:14 },
    didDrawCell: (data) => {
      if (data.row.index === totals.length - 1) {
        doc.setDrawColor(...BRAND.dark); doc.setLineWidth(0.5)
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y)
      }
    }
  })
  if (invoice.notes) {
    y = doc.lastAutoTable.finalY + 8
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(120,120,120)
    doc.text(invoice.notes, 14, y)
  }

  addFooter(doc)
  doc.save(`${invoice.invoice_number}.pdf`)
}

// ── Timesheet / Report PDF ────────────────────────────────────────────────────

export async function exportTimesheetPDF(timesheets, employees, sites, periodLabel, company) {
  const logo = await fetchLogoForPDF(company?.logo_url)
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  let y = addHeader(doc, 'Timesheet Report', periodLabel, company, logo)
  const empMap  = Object.fromEntries(employees.map(e=>[e.id,`${e.first_name} ${e.last_name}`]))
  const siteMap = Object.fromEntries(sites.map(s=>[s.id,s.name]))

  // Summary stats
  const approved = timesheets.filter(t=>t.status==='approved')
  const totalH   = approved.reduce((a,t)=>a+(Number(t.total_hours)||0),0)
  const stats = [
    ['Total Shifts', String(timesheets.length)],
    ['Approved', String(approved.length)],
    ['Pending', String(timesheets.filter(t=>t.status==='pending').length)],
    ['Total Hours', `${totalH.toFixed(2)}h`],
  ]
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,80,80)
  stats.forEach(([label, val], i) => {
    doc.setFont('helvetica','bold'); doc.text(val, 30 + i*60, y, {align:'right'})
    doc.setFont('helvetica','normal'); doc.setTextColor(120,120,120); doc.text(label, 30 + i*60, y+4, {align:'right'})
    doc.setTextColor(80,80,80)
  })
  y += 12

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Employee', 'Site', 'Clock In', 'Clock Out', 'Hours', 'Status']],
    body: timesheets.slice(0,200).map(t => [
      t.date,
      empMap[t.employee_id]||'—',
      siteMap[t.site_id]||'—',
      t.clock_in ? new Date(t.clock_in).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '—',
      t.clock_out ? new Date(t.clock_out).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '—',
      t.total_hours ? `${Number(t.total_hours).toFixed(2)}h` : '—',
      (t.status||'').toUpperCase(),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BRAND.dark, textColor: BRAND.primary, fontStyle:'bold', fontSize:7 },
    bodyStyles: { fontSize:7, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[248,248,250] },
    margin: { left:14, right:14 },
    styles: { lineColor:[240,240,240], lineWidth:0.2 },
    didParseCell: (data) => {
      if (data.column.index === 6) {
        const v = data.cell.text[0]
        if (v==='APPROVED') data.cell.styles.textColor = [26,122,74]
        else if (v==='PENDING') data.cell.styles.textColor = [200,120,26]
        else if (v==='REJECTED') data.cell.styles.textColor = [176,48,48]
      }
    }
  })

  addFooter(doc)
  doc.save(`timesheets-${periodLabel.replace(/\s+/g,'-')}.pdf`)
}

// ── Analytics Report PDF ──────────────────────────────────────────────────────

export async function exportReportPDF(computed, periodLabel, company) {
  const logo = await fetchLogoForPDF(company?.logo_url)
  const { incTypeChart, incSiteChart, topHours, siteHoursChart, totalHours, incidents, patrols, activeEmployees } = computed
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  let y = addHeader(doc, 'Operations Report', periodLabel, company, logo)

  // KPI row
  const kpis = [
    ['Incidents', String(incidents.length)],
    ['Hours Worked', `${Math.round(totalHours)}h`],
    ['Patrols', String(patrols.length)],
    ['Active Officers', String(activeEmployees)],
  ]
  kpis.forEach(([label, val], i) => {
    const x = 14 + i*47
    doc.setFillColor(26,29,42); doc.roundedRect(x, y, 44, 16, 2, 2, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...BRAND.primary)
    doc.text(val, x+22, y+8, {align:'center'})
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...BRAND.gray)
    doc.text(label.toUpperCase(), x+22, y+13, {align:'center'})
  })
  y += 22

  const tableOpts = {
    theme:'striped', headStyles:{fillColor:BRAND.dark,textColor:BRAND.primary,fontStyle:'bold',fontSize:7},
    bodyStyles:{fontSize:8,textColor:[40,40,40]}, margin:{left:14,right:14},
    styles:{lineColor:[240,240,240],lineWidth:0.2}
  }

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(40,40,40)
  doc.text('INCIDENTS BY TYPE', 14, y); doc.text('INCIDENTS BY SITE', 120, y); y += 3
  autoTable(doc, { ...tableOpts, startY:y, head:[['Type','Count']], body:incTypeChart.map(d=>[d.label,String(d.value)]), tableWidth:90, margin:{left:14,right:116} })
  autoTable(doc, { ...tableOpts, startY:y, head:[['Site','Count']], body:incSiteChart.map(d=>[d.label,String(d.value)]), tableWidth:90, margin:{left:120,right:14} })
  y = Math.max(doc.lastAutoTable.finalY, y) + 8

  doc.text('HOURS BY OFFICER', 14, y); doc.text('HOURS BY SITE', 120, y); y += 3
  autoTable(doc, { ...tableOpts, startY:y, head:[['Officer','Hours']], body:topHours.map(d=>[d.label,String(d.value)+'h']), tableWidth:90, margin:{left:14,right:116} })
  autoTable(doc, { ...tableOpts, startY:y, head:[['Site','Hours']], body:siteHoursChart.map(d=>[d.label,String(d.value)+'h']), tableWidth:90, margin:{left:120,right:14} })

  addFooter(doc)
  doc.save(`postcommand-report-${periodLabel.replace(/\s+/g,'-')}.pdf`)
}
