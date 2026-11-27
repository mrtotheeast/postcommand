import { supabase } from './supabase'
import { isNative } from './platform'

// Send an app invite to an employee (magic link via signInWithOtp) and mark
// employee.invitation_status = 'sent'. Used by the Invite button on the
// employee profile and by the Add Employee modal.
// companyName: pass the inviter's already-loaded company name (profile.company.name).
// If it is missing (profile still loading), it is read from the company record.
// Returns { error }. error is null when the email was sent.
export async function sendEmployeeInvite(emp, companyName) {
  let company_name = companyName
  if (!company_name && emp.company_id) {
    const { data: company } = await supabase.from('company').select('name').eq('id', emp.company_id).maybeSingle()
    company_name = company?.name
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: emp.email,
    options: {
      shouldCreateUser: true,
      // Native app keeps the production URL; browsers return to the current origin
      // (so local testing lands back on localhost; production is unchanged).
      emailRedirectTo: isNative() ? 'https://postcommand.app' : window.location.origin,
      data: { first_name: emp.first_name, last_name: emp.last_name, company_id: emp.company_id, employee_id: emp.id, company_name: company_name || null }
    }
  })
  if (error) return { error }
  await supabase.from('employee').update({ invitation_status: 'sent' }).eq('id', emp.id).eq('company_id', emp.company_id)
  return { error: null }
}
