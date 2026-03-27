import { supabase } from '../lib/supabase'

export async function getAllCompetitorRates() {
  const { data, error } = await supabase
    .from('competitor_rates')
    .select('*')
    .order('competitor_name')
    .order('bin_type')

  if (error) throw error
  return data ?? []
}

export async function upsertCompetitorRate(competitorName, binType, rate, notes = null) {
  const { data, error } = await supabase
    .from('competitor_rates')
    .upsert(
      { competitor_name: competitorName, bin_type: binType, rate, notes, updated_at: new Date().toISOString() },
      { onConflict: 'competitor_name,bin_type' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCompetitorRate(id) {
  const { error } = await supabase.from('competitor_rates').delete().eq('id', id)
  if (error) throw error
}
