import { supabase } from '../lib/supabase'

export async function getFleetAssets() {
  const { data, error } = await supabase
    .from('fleet_assets')
    .select('*')
    .eq('is_active', true)
    .order('asset_type')
    .order('identifier')

  if (error) throw error
  return data ?? []
}

export async function getFleetAsset(id) {
  const { data, error } = await supabase
    .from('fleet_assets')
    .select(`
      *,
      fleet_maintenance_records (*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function upsertFleetAsset(asset) {
  const { data, error } = await supabase
    .from('fleet_assets')
    .upsert({ ...asset, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function addMaintenanceRecord(record) {
  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .insert(record)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getMaintenanceRecords(assetId) {
  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .select('*')
    .eq('asset_id', assetId)
    .order('performed_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getUpcomingMaintenance(daysAhead = 30) {
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  const futureDateStr = futureDate.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('fleet_maintenance_records')
    .select(`
      *,
      fleet_assets ( identifier, description, registration )
    `)
    .lte('next_due_date', futureDateStr)
    .gte('next_due_date', todayStr)
    .order('next_due_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getDisposalReceipts(reportId) {
  const { data, error } = await supabase
    .from('disposal_receipts')
    .select('*')
    .eq('report_id', reportId)
    .order('disposal_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function addDisposalReceipt(receipt) {
  const { data, error } = await supabase
    .from('disposal_receipts')
    .insert(receipt)
    .select()
    .single()

  if (error) throw error
  return data
}
