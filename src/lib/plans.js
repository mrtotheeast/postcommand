export const NPS_COMPANY_ID = '9af02c98-04f3-4dbd-9f7e-07e7f9bbdc6c'

export const PLANS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    basePrice: 0,
    officerLimit: 5,
    siteLimit: 1,
    perOfficerPrice: 0,
    perSitePrice: 0,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    basePrice: 49,
    officerLimit: 10,
    siteLimit: 3,
    perOfficerPrice: 10, // per block of 5 officers
    perSitePrice: 15,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    basePrice: 129,
    officerLimit: 25,
    siteLimit: 15,
    perOfficerPrice: 12, // per block of 5 officers
    perSitePrice: 15,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    basePrice: 299,
    officerLimit: Infinity,
    siteLimit: Infinity,
    perOfficerPrice: 15, // per block of 5 officers
    perSitePrice: 15,
  },
}

export const PAYROLL_ADDON = {
  id: 'payroll',
  name: 'ADP Payroll Sync Add-on',
  price: 49,
}

export function getPlan(planId) {
  return PLANS[planId] || PLANS.trial
}

export function getSiteLimit(planId) {
  return getPlan(planId).siteLimit
}

export function getOfficerLimit(planId) {
  return getPlan(planId).officerLimit
}

export function canAddSite(planId, currentCount) {
  const plan = getPlan(planId)
  if (plan.siteLimit === Infinity) return true
  return currentCount < plan.siteLimit
}

export function canAddOfficer(planId, currentCount) {
  const plan = getPlan(planId)
  if (plan.officerLimit === Infinity) return true
  return currentCount < plan.officerLimit
}

export function getUpgradeMessage(planId, resource) {
  const plan = getPlan(planId)
  if (resource === 'site') {
    if (plan.siteLimit === Infinity) return null
    return `Your ${plan.name} plan includes up to ${plan.siteLimit} site${plan.siteLimit === 1 ? '' : 's'}. Upgrade to add more.`
  }
  if (resource === 'officer') {
    if (plan.officerLimit === Infinity) return null
    return `Your ${plan.name} plan includes up to ${plan.officerLimit} officer${plan.officerLimit === 1 ? '' : 's'}. Upgrade to add more.`
  }
  return 'Upgrade your plan to unlock this feature.'
}
