import { supabase } from '../lib/supabase'

// -------------------------------------------------------
// Monthly Reports
// -------------------------------------------------------

export async function getAvailableMonths() {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('id, report_month, status, created_at')
    .order('report_month', { ascending: false })

  if (error) throw error
  return data
}

export async function getReportForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('report_month', reportMonth)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function createReport(reportMonth) {
  const { data, error } = await supabase
    .from('monthly_reports')
    .insert({ report_month: reportMonth, status: 'draft' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function markReportComplete(reportId) {
  const { data, error } = await supabase
    .from('monthly_reports')
    .update({ status: 'complete', updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select()
    .single()

  if (error) throw error
  return data
}

// -------------------------------------------------------
// Financials
// -------------------------------------------------------

export async function getFinancialsForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('financials_monthly')
    .select('*')
    .eq('report_month', reportMonth)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getFinancialsRange(fromMonth, toMonth) {
  const { data, error } = await supabase
    .from('financials_monthly')
    .select('*')
    .gte('report_month', fromMonth)
    .lte('report_month', toMonth)
    .order('report_month', { ascending: true })

  if (error) throw error
  return data
}

export async function upsertFinancials(reportId, reportMonth, financialsData) {
  const { data, error } = await supabase
    .from('financials_monthly')
    .upsert({ report_id: reportId, report_month: reportMonth, ...financialsData })
    .select()
    .single()

  if (error) throw error
  return data
}

// -------------------------------------------------------
// Balance Sheet
// -------------------------------------------------------

export async function getBalanceSheetForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('balance_sheet_monthly')
    .select('*')
    .eq('report_month', reportMonth)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getBalanceSheetRange(fromMonth, toMonth) {
  const { data, error } = await supabase
    .from('balance_sheet_monthly')
    .select('*')
    .gte('report_month', fromMonth)
    .lte('report_month', toMonth)
    .order('report_month', { ascending: true })

  if (error) throw error
  return data
}

export async function upsertBalanceSheet(reportId, reportMonth, bsData) {
  const { data, error } = await supabase
    .from('balance_sheet_monthly')
    .upsert({ report_id: reportId, report_month: reportMonth, ...bsData })
    .select()
    .single()

  if (error) throw error
  return data
}

// -------------------------------------------------------
// Debtors
// -------------------------------------------------------

export async function getDebtorsForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('debtors_monthly')
    .select('*')
    .eq('report_month', reportMonth)
    .order('total_outstanding', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function upsertDebtors(reportId, reportMonth, debtorRows) {
  // Delete existing rows for this month first, then insert fresh
  await supabase
    .from('debtors_monthly')
    .delete()
    .eq('report_id', reportId)

  if (!debtorRows.length) return []

  const rows = debtorRows.map(d => ({ report_id: reportId, report_month: reportMonth, ...d }))
  const { data, error } = await supabase.from('debtors_monthly').insert(rows).select()
  if (error) throw error
  return data
}

// -------------------------------------------------------
// Bin Type Performance
// -------------------------------------------------------

export async function getBinPerformanceForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('bin_type_performance')
    .select('*')
    .eq('report_month', reportMonth)
    .order('net_margin_pct', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function upsertBinPerformance(reportId, reportMonth, binRows) {
  await supabase.from('bin_type_performance').delete().eq('report_id', reportId)

  if (!binRows.length) return []

  const rows = binRows.map(b => ({ report_id: reportId, report_month: reportMonth, ...b }))
  const { data, error } = await supabase.from('bin_type_performance').insert(rows).select()
  if (error) throw error
  return data
}

// -------------------------------------------------------
// Customer Acquisitions
// -------------------------------------------------------

export async function getCustomerAcquisitionsForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('customer_acquisitions')
    .select('*')
    .eq('report_month', reportMonth)
    .order('jobs_in_month', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function upsertCustomerAcquisitions(reportId, reportMonth, acquisitionRows) {
  await supabase.from('customer_acquisitions').delete().eq('report_id', reportId)

  if (!acquisitionRows.length) return []

  const rows = acquisitionRows.map(a => ({ report_id: reportId, report_month: reportMonth, ...a }))
  const { data, error } = await supabase.from('customer_acquisitions').insert(rows).select()
  if (error) throw error
  return data
}

// -------------------------------------------------------
// Churn Detection
// -------------------------------------------------------

/**
 * Detects customers at risk of churn by comparing their most recent
 * month's AR balance against their 3-month rolling average.
 *
 * Falls back to debtors_monthly when customer_order_history is empty.
 * A >40% drop in total_outstanding (as a proxy for ordering activity)
 * flags a customer as at-risk.
 */
export async function getChurnSignals(currentMonth) {
  // Try customer_order_history first (populated by Xero sync)
  const { data: orderHistory } = await supabase
    .from('customer_order_history')
    .select('customer_name, report_month, revenue, order_count')
    .gte('report_month', '2025-01-01')
    .lte('report_month', currentMonth)
    .order('report_month', { ascending: false })
    .limit(200)

  if (orderHistory && orderHistory.length > 0) {
    return buildChurnSignalsFromHistory(orderHistory, currentMonth)
  }

  // Fallback: use debtors_monthly AR as a proxy for ordering activity
  // Get 4 months of debtor data up to currentMonth
  const fourMonthsAgo = new Date(currentMonth)
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
  const fromMonth = fourMonthsAgo.toISOString().slice(0, 10)

  const { data: debtors, error } = await supabase
    .from('debtors_monthly')
    .select('customer_name, report_month, total_outstanding')
    .gte('report_month', fromMonth)
    .lte('report_month', currentMonth)
    .order('report_month', { ascending: false })
    .limit(400)

  if (error || !debtors?.length) return []

  return buildChurnSignalsFromDebtors(debtors, currentMonth)
}

function buildChurnSignalsFromHistory(rows, currentMonth) {
  const byCustomer = {}
  rows.forEach(r => {
    if (!byCustomer[r.customer_name]) byCustomer[r.customer_name] = []
    byCustomer[r.customer_name].push({ month: r.report_month.slice(0, 7), revenue: r.revenue || 0, orders: r.order_count || 0 })
  })

  const signals = []
  const curMonthKey = currentMonth.slice(0, 7)
  Object.entries(byCustomer).forEach(([name, entries]) => {
    entries.sort((a, b) => b.month.localeCompare(a.month))
    const current = entries.find(e => e.month === curMonthKey)
    const previous = entries.filter(e => e.month < curMonthKey).slice(0, 3)
    if (!current || previous.length < 2) return
    const avgPrevRevenue = previous.reduce((s, e) => s + e.revenue, 0) / previous.length
    if (avgPrevRevenue < 500) return // ignore low-value customers
    const drop = avgPrevRevenue > 0 ? ((avgPrevRevenue - current.revenue) / avgPrevRevenue) * 100 : 0
    if (drop >= 40) {
      signals.push({ customer_name: name, drop_pct: Math.round(drop), current_revenue: current.revenue, avg_revenue: Math.round(avgPrevRevenue), source: 'order_history' })
    }
  })
  return signals.sort((a, b) => b.drop_pct - a.drop_pct)
}

function buildChurnSignalsFromDebtors(rows, currentMonth) {
  const byCustomer = {}
  rows.forEach(r => {
    if (!byCustomer[r.customer_name]) byCustomer[r.customer_name] = []
    byCustomer[r.customer_name].push({ month: r.report_month.slice(0, 7), total: parseFloat(r.total_outstanding || 0) })
  })

  const signals = []
  const curMonthKey = currentMonth.slice(0, 7)
  Object.entries(byCustomer).forEach(([name, entries]) => {
    entries.sort((a, b) => b.month.localeCompare(a.month))
    const current = entries.find(e => e.month === curMonthKey)
    const previous = entries.filter(e => e.month < curMonthKey).slice(0, 3)
    if (previous.length < 2) return
    const avgPrev = previous.reduce((s, e) => s + e.total, 0) / previous.length
    if (avgPrev < 1000) return // ignore small accounts
    const curTotal = current?.total ?? 0
    const drop = avgPrev > 0 ? ((avgPrev - curTotal) / avgPrev) * 100 : 0
    if (drop >= 40) {
      signals.push({ customer_name: name, drop_pct: Math.round(drop), current_revenue: curTotal, avg_revenue: Math.round(avgPrev), source: 'debtors_ar' })
    }
  })
  return signals.sort((a, b) => b.drop_pct - a.drop_pct)
}

// -------------------------------------------------------
// Compliance Records
// -------------------------------------------------------

export async function getComplianceForMonth(reportMonth) {
  const { data, error } = await supabase
    .from('compliance_records')
    .select('*')
    .eq('report_month', reportMonth)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertCompliance(reportId, reportMonth, complianceData) {
  const { data, error } = await supabase
    .from('compliance_records')
    .upsert({ report_id: reportId, report_month: reportMonth, ...complianceData })
    .select()
    .single()

  if (error) throw error
  return data
}
