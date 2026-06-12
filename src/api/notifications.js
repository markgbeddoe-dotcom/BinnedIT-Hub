import { supabase } from '../lib/supabase'

export async function getNotifications(limit = 30) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function markAllRead() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) throw error
}

export async function dismissNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)

  if (error) throw error
}

// Live columns: (user_id, type, title, message, read/is_read, link).
// type CHECK allows booking|job|invoice|compliance|hazard|system — NOT
// 'general'. `body`/`related_*` do not exist (assessment DEAD-2).
export async function createNotification({ type, title, message, link, userId } = {}) {
  const targetId = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!targetId) return

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: targetId,
      type: type || 'system',
      title,
      message: message || null,
      link: link || null,
    })

  if (error) throw error
}
