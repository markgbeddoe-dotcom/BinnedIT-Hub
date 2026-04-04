import { supabase } from '../lib/supabase'

export async function getCustomers({ search = '', churnFilter = 'all' } = {}) {
  let query = supabase
    .from('customers')
    .select('*')
    .order('total_revenue', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,suburb.ilike.%${search}%`)
  }
  if (churnFilter !== 'all') {
    query = query.eq('churn_risk', churnFilter)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getCustomer(id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCustomer(customer) {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getCustomerNotes(customerId) {
  const { data, error } = await supabase
    .from('customer_notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addCustomerNote(customerId, note) {
  const { data, error } = await supabase
    .from('customer_notes')
    .insert({ customer_id: customerId, note })
    .select()
    .single()
  if (error) throw error
  return data
}
