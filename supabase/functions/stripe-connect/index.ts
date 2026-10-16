// Stripe Connect onboarding for a company's own Stripe account.
// Client payments are direct charges on the connected account, so funds settle
// to the security company — never to PostCommand's platform account.
//
// Actions (POST { action, ... }):
//   status         → { connected, charges_enabled, payouts_enabled, details_submitted, card_surcharge_pct }
//   onboard        → { url }   create account if needed, return Stripe-hosted onboarding link
//   set_surcharge  → { ok }    { pct: 0–3 } credit-card surcharge
//
// Env: STRIPE_SECRET_KEY, APP_URL

import { corsHeaders, json, getStripe, adminClient, requireBillingUser, HttpError } from '../_shared/billing.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, pct, return_path } = await req.json()
    // Status is readable by accounting; connecting/changing the account is chief+.
    const roles = action === 'status' ? ['chief', 'super_admin', 'accounting'] : ['chief', 'super_admin']
    const { companyId } = await requireBillingUser(req, roles)
    const supabase = adminClient()
    const stripe = getStripe()

    const { data: acct } = await supabase.from('company_payment_account').select('*').eq('company_id', companyId).maybeSingle()

    switch (action) {
      case 'status': {
        if (!acct) return json({ connected: false })
        // Refresh from Stripe so the UI is correct even if a webhook was missed.
        const a = await stripe.accounts.retrieve(acct.stripe_account_id)
        const fields = { charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted }
        await supabase.from('company_payment_account').update({ ...fields, updated_at: new Date().toISOString() }).eq('company_id', companyId)
        return json({ connected: true, ...fields, card_surcharge_pct: Number(acct.card_surcharge_pct) })
      }

      case 'onboard': {
        let accountId = acct?.stripe_account_id
        if (!accountId) {
          const { data: company } = await supabase.from('company').select('name, email').eq('id', companyId).maybeSingle()
          const a = await stripe.accounts.create({
            type: 'standard',
            country: 'US',
            email: company?.email || undefined,
            business_profile: { name: company?.name || undefined },
            metadata: { company_id: companyId },
          })
          accountId = a.id
          const { error } = await supabase.from('company_payment_account').insert({ company_id: companyId, stripe_account_id: accountId })
          if (error) throw error
        }
        const appUrl = Deno.env.get('APP_URL') || 'https://postcommand.app'
        const back = `${appUrl}${return_path || '/settings'}`
        const link = await stripe.accountLinks.create({
          account: accountId,
          type: 'account_onboarding',
          refresh_url: `${back}${back.includes('?') ? '&' : '?'}stripe=refresh`,
          return_url: `${back}${back.includes('?') ? '&' : '?'}stripe=connected`,
        })
        return json({ url: link.url })
      }

      case 'set_surcharge': {
        const n = Number(pct)
        if (!Number.isFinite(n) || n < 0 || n > 3) throw new HttpError(400, 'Surcharge must be between 0% and 3%')
        if (!acct) throw new HttpError(400, 'Connect a Stripe account first')
        const { error } = await supabase.from('company_payment_account')
          .update({ card_surcharge_pct: Math.round(n * 100) / 100, updated_at: new Date().toISOString() })
          .eq('company_id', companyId)
        if (error) throw error
        return json({ ok: true })
      }

      default:
        throw new HttpError(400, 'Unknown action')
    }
  } catch (err) {
    return json({ error: (err as Error).message }, err instanceof HttpError ? err.status : 500)
  }
})
