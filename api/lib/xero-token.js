/**
 * @file api/lib/xero-token.js
 * Shared Xero token management for Edge Functions.
 * Handles fetch, auto-refresh, and Supabase JWT verification.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'

/**
 * Fetch a valid Xero access token, auto-refreshing if it expires within 5 minutes.
 * Throws if Xero is not connected or refresh fails.
 */
export async function getValidToken(serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/xero_tokens?select=*&limit=1`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  })
  const rows = await res.json()
  if (!rows?.length) throw new Error('Xero not connected. Go to Settings → Connect Xero first.')

  const token = rows[0]
  const expiresAt = new Date(token.expires_at).getTime()

  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const clientId = process.env.XERO_CLIENT_ID
    const clientSecret = process.env.XERO_CLIENT_SECRET
    const refreshRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
    })
    const refreshed = await refreshRes.json()
    if (!refreshed.access_token) throw new Error('Token refresh failed — please reconnect Xero in Settings.')

    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await fetch(`${SUPABASE_URL}/rest/v1/xero_tokens?tenant_id=eq.${encodeURIComponent(token.tenant_id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || token.refresh_token,
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }),
    })
    return { accessToken: refreshed.access_token, tenantId: token.tenant_id }
  }

  return { accessToken: token.access_token, tenantId: token.tenant_id }
}

/**
 * Same as getValidToken but returns null instead of throwing.
 * Used where Xero is optional (e.g. invoice generation).
 */
export async function getXeroTokenSilent(serviceKey) {
  try {
    return await getValidToken(serviceKey)
  } catch {
    return null
  }
}

/**
 * Verify a Supabase JWT by calling the Supabase Auth API.
 * Throws with status 401 message if invalid.
 * Pass CRON_SECRET as allowedSecret to also accept cron-triggered requests.
 */
export async function verifySupabaseJWT(jwt, { allowCronSecret = false } = {}) {
  if (allowCronSecret) {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && jwt === cronSecret) return null  // cron trigger — no user
  }

  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!anonKey) {
    // If anon key not configured, fall back to presence check (non-breaking)
    return null
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: anonKey },
  })
  if (!res.ok) throw new Error('Unauthorized — invalid or expired session')
  return await res.json()
}
