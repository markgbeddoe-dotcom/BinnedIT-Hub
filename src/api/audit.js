import { supabase } from '../lib/supabase'

export async function getAuditLog({
  tableName,
  action,
  changedBy,
  dateFrom,
  dateTo,
  limit = 50,
  offset = 0,
} = {}) {
  let q = supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, changed_by, old_values, new_values, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tableName) q = q.eq('table_name', tableName)
  if (action)    q = q.eq('action', action)
  if (changedBy) q = q.eq('changed_by', changedBy)
  if (dateFrom)  q = q.gte('created_at', dateFrom)
  if (dateTo)    q = q.lte('created_at', dateTo)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
