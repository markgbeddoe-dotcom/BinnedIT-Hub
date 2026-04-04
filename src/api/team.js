import { supabase } from '../lib/supabase'

// ── Team members ─────────────────────────────────────────────

export async function getTeamMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, is_active, created_at, updated_at')
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function updateTeamMember(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Staff certificates ────────────────────────────────────────

export async function getStaffCertificates() {
  const { data, error } = await supabase
    .from('staff_certificates')
    .select('*')
    .eq('is_active', true)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function upsertStaffCertificate(cert) {
  const { id, ...fields } = cert
  if (id) {
    const { data, error } = await supabase
      .from('staff_certificates')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('staff_certificates')
      .insert(fields)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteStaffCertificate(id) {
  const { error } = await supabase
    .from('staff_certificates')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ── Insurance policies ────────────────────────────────────────

export async function getInsurancePolicies() {
  const { data, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('is_active', true)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function upsertInsurancePolicy(policy) {
  const { id, ...fields } = policy
  if (id) {
    const { data, error } = await supabase
      .from('insurance_policies')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('insurance_policies')
      .insert(fields)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ── Team activity (from audit log) ───────────────────────────

export async function getTeamRecentActivity(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, table_name, action, record_id, created_at')
    .eq('changed_by', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return []
  return data ?? []
}
