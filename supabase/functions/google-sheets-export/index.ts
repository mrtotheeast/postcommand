// Google Sheets Export via Google Sheets API
// Uses OAuth 2.0 service account (no user OAuth flow needed)
// Env vars: GOOGLE_SERVICE_ACCOUNT_JSON (full JSON key as string)
//
// Setup:
//   1. Create Google Cloud project
//   2. Enable Google Sheets API + Google Drive API
//   3. Create Service Account, download JSON key
//   4. Set GOOGLE_SERVICE_ACCOUNT_JSON = contents of JSON key file
//   5. Share any target folder with the service account email

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64url } from 'https://deno.land/std@0.177.0/encoding/base64url.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg:'RS256', typ:'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const enc = (obj: object) => base64url(new TextEncoder().encode(JSON.stringify(obj)))
  const unsigned = `${enc(header)}.${enc(payload)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(sig)}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })
  const data = await res.json()
  return data.access_token
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,'')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i)
  return buf.buffer
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { type, rows, title, company_id } = await req.json()
    if (!rows?.length || !title) throw new Error('rows and title required')

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')

    const token = await getAccessToken(saJson)

    // Create spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        properties: { title: `PostCommand — ${title} — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` },
        sheets: [{ properties: { title: type || 'Export' } }]
      })
    })
    const sheet = await createRes.json()
    if (!sheet.spreadsheetId) throw new Error('Failed to create spreadsheet: ' + JSON.stringify(sheet))

    // Write data
    const values = rows.map((row: any[]) => row.map(c => String(c ?? '')))
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/A1:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ values })
    })

    // Bold the header row
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: { startRowIndex:0, endRowIndex:1 },
            cell: { userEnteredFormat: { textFormat:{ bold:true }, backgroundColor:{ red:0.05, green:0.06, blue:0.08 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        }, {
          autoResizeDimensions: { dimensions: { dimension:'COLUMNS', startIndex:0, endIndex:values[0]?.length||10 } }
        }]
      })
    })

    return new Response(JSON.stringify({ url: sheet.spreadsheetUrl, id: sheet.spreadsheetId }), {
      headers: { ...cors, 'Content-Type':'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type':'application/json' }
    })
  }
})
