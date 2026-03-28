import { supabase } from '../lib/supabase'

export async function inviteUser(email, role) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch('/api/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, role }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Invite failed (${res.status})`)
  }
  const data = await res.json()
  return data
}

export async function getAlertThresholds() {
  const { data, error } = await supabase
    .from('alert_thresholds')
    .select('*')
    .order('category')
    .order('metric_key')

  if (error) throw error
  return data ?? []
}

export async function upsertThreshold(threshold) {
  const { data, error } = await supabase
    .from('alert_thresholds')
    .upsert(threshold, { onConflict: 'category,metric_key' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, is_active')
    .order('created_at')

  if (error) throw error
  return data ?? []
}

export async function updateProfileRole(userId, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getBinTypes() {
  const { data, error } = await supabase
    .from('bin_types')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data ?? []
}

export async function upsertBinType(binType) {
  const { data, error } = await supabase
    .from('bin_types')
    .upsert(binType)
    .select()
    .single()

  if (error) throw error
  return data
}
