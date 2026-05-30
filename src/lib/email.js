// Email notification helpers — calls send-email Supabase Edge Function
import { supabase } from './supabase'

async function sendEmail(type, to, data) {
  if (!to) return
  try {
    await supabase.functions.invoke('send-email', { body: { type, to, data } })
  } catch (e) {
    console.warn('Email send failed (non-fatal):', e.message)
  }
}

// ── Individual helpers called from each module ────────────────────────────────

export async function emailTimesheetApproved({ to, firstName, date, hours, siteName }) {
  return sendEmail('timesheet_approved', to, { firstName, date, hours, siteName })
}

export async function emailTimesheetRejected({ to, firstName, date, reason }) {
  return sendEmail('timesheet_rejected', to, { firstName, date, reason })
}

export async function emailSchedulePublished({ to, firstName, shiftCount, period }) {
  return sendEmail('schedule_published', to, { firstName, shiftCount, period })
}

export async function emailTrainingAssigned({ to, firstName, courseTitle, dueDate, duration }) {
  return sendEmail('training_assigned', to, { firstName, courseTitle, dueDate, duration })
}

export async function emailPTOApproved({ to, firstName, ptoType, startDate, endDate, days }) {
  return sendEmail('pto_approved', to, { firstName, ptoType, startDate, endDate, days })
}

export async function emailPTODenied({ to, firstName, ptoType, startDate, endDate }) {
  return sendEmail('pto_denied', to, { firstName, ptoType, startDate, endDate })
}

export async function emailSOSAlert({ to, officerName, siteName, time, location }) {
  return sendEmail('sos_alert', to, { officerName, siteName, time, location })
}

export async function emailIncidentSubmitted({ to, cadNumber, incidentType, siteName, officerName, time }) {
  return sendEmail('incident_submitted', to, { cadNumber, incidentType, siteName, officerName, time })
}

export async function emailWelcome({ to, firstName, companyName }) {
  return sendEmail('welcome', to, { firstName, companyName })
}
