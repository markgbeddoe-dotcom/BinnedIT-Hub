import { supabase } from '../lib/supabase'

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers({ search = '', churnFilter = 'all', accountStatus = 'all', creditStatus = 'all' } = {}) {
  let query = supabase
    .from('customers')
    .select('*')
    .order('total_revenue', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,suburb.ilike.%${search}%,abn.ilike.%${search}%`)
  }
  if (churnFilter !== 'all') query = query.eq('churn_risk', churnFilter)
  if (accountStatus !== 'all') query = query.eq('account_status', accountStatus)
  if (creditStatus !== 'all') query = query.eq('credit_status', creditStatus)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getCustomer(id) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCustomer(customer) {
  const { data, error } = await supabase.from('customers').insert(customer).select().single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function getCustomerContacts(customerId) {
  const { data, error } = await supabase
    .from('customer_contacts')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createCustomerContact(contact) {
  const { data, error } = await supabase.from('customer_contacts').insert(contact).select().single()
  if (error) throw error
  return data
}

export async function updateCustomerContact(id, updates) {
  const { data, error } = await supabase.from('customer_contacts').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCustomerContact(id) {
  const { error } = await supabase.from('customer_contacts').delete().eq('id', id)
  if (error) throw error
}

// ── Directors ─────────────────────────────────────────────────────────────────

export async function getCustomerDirectors(customerId) {
  const { data, error } = await supabase
    .from('customer_directors')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createCustomerDirector(director) {
  const { data, error } = await supabase.from('customer_directors').insert(director).select().single()
  if (error) throw error
  return data
}

export async function updateCustomerDirector(id, updates) {
  const { data, error } = await supabase.from('customer_directors').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCustomerDirector(id) {
  const { error } = await supabase.from('customer_directors').delete().eq('id', id)
  if (error) throw error
}

// ── Trade references ──────────────────────────────────────────────────────────

export async function getCustomerTradeRefs(customerId) {
  const { data, error } = await supabase
    .from('customer_trade_refs')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createCustomerTradeRef(ref) {
  const { data, error } = await supabase.from('customer_trade_refs').insert(ref).select().single()
  if (error) throw error
  return data
}

export async function updateCustomerTradeRef(id, updates) {
  const { data, error } = await supabase.from('customer_trade_refs').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Credit applications ───────────────────────────────────────────────────────

export async function getCreditApplication(customerId) {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createCreditApplication(app) {
  const { data, error } = await supabase.from('credit_applications').insert(app).select().single()
  if (error) throw error
  return data
}

export async function updateCreditApplication(id, updates) {
  const { data, error } = await supabase.from('credit_applications').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Account contracts ─────────────────────────────────────────────────────────

export async function getAccountContracts(customerId) {
  const { data, error } = await supabase
    .from('account_contracts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createAccountContract(contract) {
  const { data, error } = await supabase.from('account_contracts').insert(contract).select().single()
  if (error) throw error
  return data
}

// ── Customer notes ────────────────────────────────────────────────────────────

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

// ── Payment history ───────────────────────────────────────────────────────────

export async function getPaymentHistory(customerId) {
  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('paid_date', { ascending: false })
  if (error) throw error
  return data || []
}

// ── CreditorWatch check (calls our edge function) ─────────────────────────────

export async function runCreditorWatchCheck(customerId, abn) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch('/api/creditorwatch-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ customerId, abn }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `CreditorWatch check failed (${res.status})`)
  return data
}
