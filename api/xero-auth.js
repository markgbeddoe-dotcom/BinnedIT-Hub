/**
 * @file api/xero-auth.js — Vercel Edge Function
 * Redirects the browser to Xero's OAuth 2.0 authorisation page.
 * Called when the user clicks "Connect Xero" in Settings.
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
  const scopes = 'accounting.reports.read accounting.contacts.read offline_access openid profile email'
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  })

  const xeroAuthUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`
  return Response.redirect(xeroAuthUrl, 302)
}
