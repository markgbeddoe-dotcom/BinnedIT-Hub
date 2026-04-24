import { supabase } from '../lib/supabase'

// ── Collections events ────────────────────────────────────────────────────────

export async function getCollectionsEvents(customerId) {
  const { data, error } = await supabase
    .from('collections_events')
    .select('*')
    .eq('customer_id', customerId)
    .order('sent_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllCollectionsEvents({ level = null, limit = 100 } = {}) {
  let query = supabase
    .from('collections_events')
    .select('*, customers(name, abn)')
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (level) query = query.eq('level', level)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createCollectionsEvent(event) {
  const { data, error } = await supabase.from('collections_events').insert(event).select().single()
  if (error) throw error
  return data
}

export async function updateCollectionsEvent(id, updates) {
  const { data, error } = await supabase.from('collections_events').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Overdue invoices for collections dashboard ────────────────────────────────

export async function getOverdueInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customers(id, name, abn, payment_terms_days, account_type, director_guarantee_received)')
    .in('status', ['sent', 'overdue'])
    .order('due_date', { ascending: true })

  if (error) throw error
  const today = new Date()
  return (data || [])
    .map(inv => {
      const due = inv.due_date ? new Date(inv.due_date) : null
      const daysOverdue = due ? Math.max(0, Math.floor((today - due) / 86400000)) : 0
      const collectionsLevel = daysOverdue >= 21 ? 4
        : daysOverdue >= 15 ? 3
        : daysOverdue >= 10 ? 2
        : daysOverdue >= 5  ? 1
        : 0
      return { ...inv, daysOverdue, collectionsLevel }
    })
    .filter(inv => inv.daysOverdue > 0)
}

// ── Update invoice collections level ─────────────────────────────────────────

export async function escalateInvoice(invoiceId, level) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ collections_level: level, collections_last_action_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Collections summary stats ─────────────────────────────────────────────────

export async function getCollectionsSummary() {
  const invoices = await getOverdueInvoices()

  const byLevel = { 0: [], 1: [], 2: [], 3: [], 4: [] }
  for (const inv of invoices) byLevel[inv.collectionsLevel].push(inv)

  const sum = arr => arr.reduce((s, i) => s + (parseFloat(i.total) || 0), 0)

  return {
    totalOverdue: invoices.length,
    totalOverdueAmount: sum(invoices),
    level1: { count: byLevel[1].length, amount: sum(byLevel[1]) },
    level2: { count: byLevel[2].length, amount: sum(byLevel[2]) },
    level3: { count: byLevel[3].length, amount: sum(byLevel[3]) },
    level4: { count: byLevel[4].length, amount: sum(byLevel[4]) },
    invoices,
  }
}
