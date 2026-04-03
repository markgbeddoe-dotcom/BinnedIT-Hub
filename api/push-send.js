// Vercel Edge Function — Send Web Push Notification
// POST /api/push-send  { subscription, title, body, url }

export const config = { runtime: 'edge' }

// Minimal VAPID signing using Web Crypto (Edge-compatible, no npm deps)
// Spec: https://datatracker.ietf.org/doc/html/rfc8292

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function uint8ArrayToBase64Url(arr) {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function buildVapidAuthHeader(audience, subject, publicKeyB64u, privateKeyB64u) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 12 * 3600

  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp, sub: subject }

  const encode = obj => uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)))
  const signingInput = `${encode(header)}.${encode(payload)}`

  const privateKeyBytes = urlBase64ToUint8Array(privateKeyB64u)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    // Convert raw EC private key bytes to PKCS8 DER — push spec uses raw 32-byte key
    // We need to wrap it; build a minimal DER wrapper for P-256
    buildPkcs8Der(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(sigBytes))}`
  const vapidPublicKeyB64u = publicKeyB64u

  return `vapid t=${jwt},k=${vapidPublicKeyB64u}`
}

// Build PKCS8 DER wrapper around a raw 32-byte P-256 private key
// This is the minimal structure required by Web Crypto subtle.importKey
function buildPkcs8Der(rawPrivateKey) {
  // SEC1 ECPrivateKey structure wrapped in PKCS8
  // OID for ecPublicKey: 1.2.840.10045.2.1
  // OID for P-256 / prime256v1: 1.2.840.10045.3.1.7
  const oid = new Uint8Array([
    0x30, 0x41,                         // SEQUENCE (65 bytes)
    0x02, 0x01, 0x00,                   // version INTEGER 0
    0x30, 0x13,                         // SEQUENCE
      0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,  // OID ecPublicKey
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27,                         // OCTET STRING
      0x30, 0x25,                       // SEQUENCE (SEC1)
        0x02, 0x01, 0x01,               // version INTEGER 1
        0x04, 0x20,                     // OCTET STRING (32 bytes = raw key)
  ])
  const der = new Uint8Array(oid.length + rawPrivateKey.length)
  der.set(oid)
  der.set(rawPrivateKey, oid.length)
  return der.buffer
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:mark@binnedit.com.au'

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500 })
  }

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { subscription, title, pushBody, url } = body || {}
  if (!subscription?.endpoint) {
    return new Response(JSON.stringify({ error: 'subscription.endpoint required' }), { status: 400 })
  }

  const payload = JSON.stringify({ title: title || 'SkipSync Alert', body: pushBody || '', url: url || '/' })
  const endpoint = subscription.endpoint
  const audience = new URL(endpoint).origin

  try {
    const authHeader = await buildVapidAuthHeader(audience, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const pushRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        Authorization: authHeader,
        TTL: '86400',
      },
      body: new TextEncoder().encode(payload),
    })

    if (pushRes.status === 201 || pushRes.status === 200) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    return new Response(JSON.stringify({ error: `Push returned ${pushRes.status}` }), { status: 502 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
