import { supabase } from '../lib/supabase'

export async function getWorkPlanItems() {
  const { data, error } = await supabase
    .from('work_plan_items')
    .select(`
      *,
      work_plan_completions (
        id, completed_by, completed_at, notes
      )
    `)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function markItemComplete(itemId, notes = null) {
  const { data, error } = await supabase
    .from('work_plan_completions')
    .insert({ item_id: itemId, notes })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function unmarkItemComplete(itemId) {
  const { error } = await supabase
    .from('work_plan_completions')
    .delete()
    .eq('item_id', itemId)

  if (error) throw error
}

export async function createWorkPlanItem(item) {
  const { data, error } = await supabase
    .from('work_plan_items')
    .insert(item)
    .select()
    .single()

  if (error) throw error
  return data
}
