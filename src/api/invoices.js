import { supabase } from '../lib/supabase'

export async function getInvoices({ status } = {}) {
  let query = supabase
    .from('invoices')
    .select('*, bookings(bin_size, waste_type, suburb, scheduled_date)')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getInvoice(id) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, bookings(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateInvoiceStatus(id, status) {
  const patch = { status }
  if (status === 'sent') patch.sent_at = new Date().toISOString()
  if (status === 'paid') patch.paid_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getInvoiceSummary() {
  const { data, error } = await supabase
    .from('invoices')
    .select('status, total')
  if (error) throw error

  const summary = { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0, totalOutstanding: 0, totalPaid: 0 }
  for (const inv of (data || [])) {
    const t = parseFloat(inv.total || 0)
    summary[inv.status] = (summary[inv.status] || 0) + 1
    if (inv.status === 'sent' || inv.status === 'overdue') summary.totalOutstanding += t
    if (inv.status === 'paid') summary.totalPaid += t
  }
  return summary
}
