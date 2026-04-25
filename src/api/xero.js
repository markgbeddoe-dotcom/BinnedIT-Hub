import { supabase } from '../lib/supabase'

export async function getXeroStatus() {
  const { data, error } = await supabase
    .from('xero_tokens')
    .select('tenant_name, updated_at, expires_at')
    .limit(1)
    .single()
  if (error) return { connected: false }
  return { connected: true, tenantName: data.tenant_name, updatedAt: data.updated_at }
}

export async function syncXeroMonth(month) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch('/api/xero-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ month, userId: session.user.id }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 404) throw new Error('Xero sync API not found. Use `vercel dev` for local testing — `npm run dev` does not serve API routes.')
    throw new Error(data.error || `Sync failed (${res.status})`)
  }
  return data
}

export async function syncXeroAllHistory(fromMonth, toMonth) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch('/api/xero-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action: 'sync_all',
      from_month: fromMonth,
      to_month: toMonth,
      userId: session.user.id,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 404) throw new Error('Xero sync API not found. Use `vercel dev` for local testing — `npm run dev` does not serve API routes.')
    throw new Error(data.error || `Bulk sync failed (${res.status})`)
  }
  return data
}

export async function getXeroSyncLog() {
  const { data, error } = await supabase
    .from('xero_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data
}
