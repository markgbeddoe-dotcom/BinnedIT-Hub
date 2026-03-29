/**
 * @file api/xero-callback.js — Vercel Edge Function
 * Receives OAuth callback from Xero, exchanges code for tokens,
 * fetches the tenant list, and stores tokens in Supabase.
 * Redirects to /dashboard on success or /?xero_error=... on failure.
 */
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'

export default async function handler(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    return Response.redirect(`https://binnedit-hub.vercel.app/?xero_error=${encodeURIComponent(error || 'no_code')}`, 302)
  }

  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!clientId || !clientSecret || !serviceKey) {
    return Response.redirect('https://binnedit-hub.vercel.app/?xero_error=server_misconfiguration', 302)
  }

  // Exchange code for tokens
  let tokens
  try {
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://binnedit-hub.vercel.app/api/xero-callback',
      }),
    })
    tokens = await tokenRes.json()
    if (!tokens.access_token) throw new Error(tokens.error || 'No access token returned')
  } catch (err) {
    return Response.redirect(`https://binnedit-hub.vercel.app/?xero_error=${encodeURIComponent(err.message)}`, 302)
  }

  // Get connected tenant(s)
  let tenantId, tenantName
  try {
    const connRes = await fetch('https://api.xero.com/connections', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    })
    const connections = await connRes.json()
    const org = connections[0]
    tenantId = org?.tenantId
    tenantName = org?.tenantName
  } catch {
    return Response.redirect('https://binnedit-hub.vercel.app/?xero_error=tenant_fetch_failed', 302)
  }

  if (!tenantId) {
    return Response.redirect('https://binnedit-hub.vercel.app/?xero_error=no_tenant', 302)
  }

  // Store tokens in Supabase
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/xero_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        tenant_name: tenantName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    })
  } catch {
    return Response.redirect('https://binnedit-hub.vercel.app/?xero_error=token_save_failed', 302)
  }

  return Response.redirect('https://binnedit-hub.vercel.app/settings?xero_connected=1', 302)
}
