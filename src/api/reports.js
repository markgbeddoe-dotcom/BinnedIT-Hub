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
