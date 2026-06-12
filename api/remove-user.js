// Vercel Edge Function — remove a team member (auth user + profile)
// Uses SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to browser).
//
// Security:
// - Caller must be authenticated (Authorization: Bearer <JWT>) AND role 'owner'
// - Cannot remove yourself (prevents an owner locking themselves out)
// - Deletes the Supabase auth user (admin API) and the profiles row
//
// Request body: { userId: string }
// Response: { success: true } or { error: string }

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://dkjwyzjzdcgrepbgiuei.supabase.co';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const callerToken = authHeader.slice(7);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json({ error: 'Server misconfiguration: missing service key' }, 500);

  let userId;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!userId) return json({ error: 'userId is required' }, 400);

  // 1. Verify caller identity
  let caller;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${callerToken}`, apikey: serviceKey },
    });
    if (!r.ok) return json({ error: 'Could not verify caller identity' }, 401);
    caller = await r.json();
  } catch (err) {
    return json({ error: 'Auth verification failed: ' + (err.message || 'unknown') }, 500);
  }

  // 2. Caller must be an owner
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0 || rows[0].role !== 'owner') {
      return json({ error: 'Only owners can remove team members' }, 403);
    }
  } catch {
    return json({ error: 'Could not verify caller role' }, 500);
  }

  // 3. Cannot remove yourself
  if (userId === caller.id) {
    return json({ error: "You can't remove your own account" }, 400);
  }

  // 4. Delete the profile row, then the auth user
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!del.ok && del.status !== 404) {
      const body = await del.text();
      return json({ error: `Could not delete auth user (${del.status}): ${body.slice(0, 200)}` }, 502);
    }
  } catch (err) {
    return json({ error: 'Removal failed: ' + (err.message || 'unknown') }, 500);
  }

  return json({ success: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
