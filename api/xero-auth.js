/**
 * @file api/xero-auth.js — Vercel Edge Function
 * Redirects the browser to Xero's OAuth 2.0 authorisation page.
 * Called when the user clicks "Connect Xero" in Settings.
 * Sets a short-lived CSRF cookie to verify the state on callback.
 */
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'XERO_CLIENT_ID not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const redirectUri = 'https://binnedit-hub.vercel.app/api/xero-callback'
  const scopes = [
    'accounting.reports.read',
    'accounting.transactions.read',
    'accounting.contacts.read',
    'offline_access',
    'openid',
    'profile',
    'email',
  ].join(' ')
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  })

  const xeroAuthUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`

  // Store state in a short-lived HttpOnly cookie so xero-callback.js can verify it
  const headers = new Headers({
    Location: xeroAuthUrl,
    'Set-Cookie': `xero_csrf_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
  })

  return new Response(null, { status: 302, headers })
}
