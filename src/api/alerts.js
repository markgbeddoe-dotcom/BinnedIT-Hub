import { supabase } from '../lib/supabase'

export async function getAlertsForReport(reportId) {
  const { data, error } = await supabase
    .from('alerts_log')
    .select('*')
    .eq('report_id', reportId)
    .order('severity')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function saveAlerts(reportId, alerts) {
  // Replace all alerts for this report
  await supabase.from('alerts_log').delete().eq('report_id', reportId)

  if (!alerts.length) return []

  const rows = alerts.map(a => ({
    report_id: reportId,
    category: a.category,
    severity: a.severity,
    message: a.message,
  }))

  const { data, error } = await supabase.from('alerts_log').insert(rows).select()
  if (error) throw error
  return data
}

export async function acknowledgeAlert(alertId, notes = null) {
  const { data, error } = await supabase
    .from('alerts_log')
    .update({ acknowledged_at: new Date().toISOString(), notes })
    .eq('id', alertId)
    .select()
    .single()

  if (error) throw error
  return data
}
