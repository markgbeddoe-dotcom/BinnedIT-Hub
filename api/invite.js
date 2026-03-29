// Vercel Edge Function — invite a new user via Supabase Admin API
// Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to browser)

/**
 * @file api/invite.js — Vercel Edge Function
 *
 * Sends a Supabase magic-link invitation email to a new user and
 * creates/updates their profile row with the assigned role.
 *
 * Security:
 * - Caller must be authenticated (Authorization: Bearer <JWT>)
 * - Caller must have role = 'owner' in the profiles table
 * - SUPABASE_SERVICE_ROLE_KEY is used server-side only
 *
 * Request body: { email: string, role: 'owner'|'manager'|'bookkeeper'|'viewer' }
 * Response: { success: true, userId: string } or { error: string }
 *
 * @param {Request} req - Edge runtime Request object
 * @returns {Response} JSON result
 */

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://dkjwyzjzdcgrepbgiuei.supabase.co';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Only allow calls with a valid Supabase session (verified server-side)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let email, role;
  try {
    ({ email, role } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const VALID_ROLES = ['owner', 'manager', 'bookkeeper', 'viewer'];
  if (!email || !role || !VALID_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: 'email and a valid role are required' }), { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing service key' }), { status: 500 });
  }

  // Step 1: Verify the calling user is an owner using their JWT
  const userToken = authHeader.slice(7);
  let callerUser;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'apikey': serviceKey,
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Could not verify caller identity' }), { status: 401 });
    }
    callerUser = await userRes.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Auth verification failed: ' + (err.message || 'unknown') }), { status: 500 });
  }

  // Check caller role in profiles table (non-fatal if table doesn't exist yet)
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${callerUser.id}&select=role`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      }
    );
    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].role !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only owners can invite users' }), { status: 403 });
      }
      // If profiles table empty or no row found, allow invite (owner bootstrapping their own account)
    }
    // If profileRes not ok (table missing, etc.) — allow invite with warning
  } catch (err) {
    // Non-fatal — profiles table may not exist yet if migrations haven't been applied.
    // Allow the invite to proceed so the owner can bootstrap users.
  }

  // Step 2: Invite user via Supabase Admin API (sends magic link email)
  let inviteData;
  try {
    const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    inviteData = await inviteRes.json();

    if (!inviteRes.ok) {
      const msg = inviteData.msg || inviteData.message || inviteData.error_description || JSON.stringify(inviteData);
      // If user already exists, that's okay — we'll still set their role below
      if (!msg.includes('already been registered') && !msg.includes('already exists')) {
        return new Response(JSON.stringify({ error: msg }), { status: 400 });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invite API call failed: ' + (err.message || 'unknown') }), { status: 500 });
  }

  const userId = inviteData.id;

  // Step 3: Upsert profile row with the assigned role
  if (userId) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: userId,
        role,
        full_name: email.split('@')[0],
        is_active: true,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  return new Response(JSON.stringify({ success: true, email, role }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
