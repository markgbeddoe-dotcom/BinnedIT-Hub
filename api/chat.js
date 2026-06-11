// Vercel Edge Function — AI Chat (knowledge-base assistant + dispatch agent)
// POST /api/chat → streams Anthropic response as SSE

/**
 * @file api/chat.js — Vercel Edge Function
 *
 * The SkipSync assistant: (a) a knowledge-base assistant grounded in the
 * in-repo product MANUAL, and (b) an agent that can act on live dispatch data
 * via Anthropic tool use (api/lib/chat-tools.js).
 *
 * Security:
 *   - ANTHROPIC_API_KEY never reaches the browser (platform_settings override
 *     supported, same as before).
 *   - Authorization: Bearer <Supabase JWT> is verified server-side against
 *     /auth/v1/user, then the profile role is loaded with the service key.
 *     The client-sent userId is NEVER trusted for authorization — it is only
 *     used for the pre-existing rate-limit bookkeeping.
 *   - Tools are role-gated server-side: no/invalid JWT → no tools (pure
 *     knowledge-base mode); any authenticated role → read-only tools;
 *     owner|manager|fleet_manager → assign_job (the only write).
 *
 * SSE event payloads (Content-Type: text/event-stream):
 *   data: {"text":"..."}                                    — assistant text delta
 *   data: {"tool":{"name","status":"running|done|error","summary"}} — tool progress
 *   data: [DONE]                                            — end of stream
 *
 * Rate limiting: 50 messages/user/day via ai_chat_sessions (unchanged).
 * If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are absent the endpoint still
 * works in knowledge-base mode (no tools, no rate limit, no financial fetch).
 *
 * Prompt caching: system is an ARRAY — block 1 is static (business facts +
 * MANUAL + behaviour) with cache_control, block 2 is per-request dynamic
 * context (date, user, financials, permissions) with no cache_control.
 * The tools array is byte-stable (fixed order) since tools render before
 * system in the cache prefix.
 *
 * Xero is READ-ONLY — the assistant must never claim to have written to Xero.
 */

import { MANUAL } from './lib/manual.js'
import {
  toolsForRole,
  createToolExecutor,
  runToolSafe,
  melbourneToday,
  ASSIGN_JOB_CAP,
} from './lib/chat-tools.js'

export const config = { runtime: 'edge' }

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 4096
const DAILY_LIMIT = 50
const MAX_TOOL_ITERATIONS = 8

// ── Static system block — built ONCE per isolate, byte-stable, no timestamps.
// Cached via cache_control on this block (tools + this block share the prefix).
const STATIC_SYSTEM = `You are the SkipSync assistant for Binned-IT Pty Ltd, a skip bin hire business based in Seaford, Melbourne, Australia, operating in the waste management industry.

Key business facts:
- Skip bin hire for domestic, commercial, and industrial customers
- Specialises in general waste, asbestos removal, contaminated soil, and green waste
- Financial year runs July to June
- Based in Seaford, Melbourne
- Australian business context applies: GST, PAYG, ATO, WHS, EPA

=== PRODUCT MANUAL ===
${MANUAL}
=== END PRODUCT MANUAL ===

How to behave:
- For "how do I…" questions about the app, answer from the PRODUCT MANUAL above with exact UI steps (tab names, button labels, field names). Do not invent UI that the manual does not describe.
- For questions about live data (jobs, bookings, roster, drivers, trucks, business rules), use your tools — never answer from memory when a tool can fetch the truth. If you have no tools available, say the user needs to be signed in for live-data actions.
- Before assigning any work, ALWAYS call get_jobs and get_roster first so you act on current data.
- Bulk scheduling (e.g. "schedule all jobs for today"): call get_jobs with date "today" and unassigned_only true, call get_roster, and call get_business_rules to read max_jobs_per_truck_day. Then plan a sensible spread: prefer drivers who passed today's pre-start checklist, balance load across drivers (count their existing active jobs), and keep each truck at or under max_jobs_per_truck_day. State the plan as you go, then call assign_job once per booking. There is a hard cap of ${ASSIGN_JOB_CAP} assignments per request.
- After any write, summarise exactly what changed: which bookings, which drivers/trucks/dates, and any status transitions.
- If the user lacks permission for an action, say so and name who can do it (job assignment: owner, manager or fleet_manager).
- Flag compliance risks (WHS, EPA, asbestos documentation) prominently.
- Prioritise cash flow and profitability insights; be concise and practical — Mark (the owner) is a busy operator.
- Keep responses under 300 words unless the question requires more detail.
- Xero is READ-ONLY in this system. Never claim to have written, synced or pushed anything to Xero — billing adjustments are internal records only.`

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Verify the Supabase JWT and load the profile role with the service key.
 * Returns { userId, role, fullName } — role null when there is no/invalid JWT
 * or Supabase is not configured. Never throws.
 */
async function verifyUser(req, SUPABASE_URL, SERVICE_KEY) {
  const none = { userId: null, role: null, fullName: null }
  if (!SUPABASE_URL || !SERVICE_KEY) return none
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return none
  const jwt = authHeader.slice(7).trim()
  if (!jwt) return none

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
    })
    if (!userRes.ok) return none
    const user = await userRes.json()
    if (!user?.id) return none

    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,full_name&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    if (!profRes.ok) return { userId: user.id, role: null, fullName: null }
    const profiles = await profRes.json()
    const profile = profiles[0]
    if (!profile?.role) return { userId: user.id, role: null, fullName: null }
    return { userId: user.id, role: profile.role, fullName: profile.full_name || null }
  } catch {
    return none
  }
}

/**
 * Start one streamed Anthropic Messages call. Throws (with .status) on a
 * non-2xx response so the caller can surface a graceful JSON error before
 * the SSE response is committed.
 */
async function startAnthropicTurn(apiKey, payload) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ ...payload, stream: true }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const err = new Error(`AI error: ${res.status}`)
    err.status = res.status
    err.detail = errText.slice(0, 500)
    throw err
  }
  return res
}

/**
 * Consume an Anthropic SSE stream. Emits text deltas via onText as they
 * arrive; accumulates the full content array (text, tool_use with parsed
 * input, thinking/redacted_thinking blocks preserved for the next turn)
 * and the stop_reason.
 *
 * @returns {Promise<{content: object[], stopReason: string|null}>}
 */
async function consumeAnthropicTurn(res, onText) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const blocks = {} // index → accumulating block
  let stopReason = null

  const handleEvent = async (parsed) => {
    if (parsed.type === 'content_block_start') {
      const cb = parsed.content_block || {}
      if (cb.type === 'tool_use') {
        blocks[parsed.index] = { type: 'tool_use', id: cb.id, name: cb.name, _json: '' }
      } else if (cb.type === 'text') {
        blocks[parsed.index] = { type: 'text', text: cb.text || '' }
      } else if (cb.type === 'thinking') {
        blocks[parsed.index] = { type: 'thinking', thinking: cb.thinking || '', signature: cb.signature || '' }
      } else {
        // redacted_thinking and any future block types pass through untouched
        blocks[parsed.index] = { ...cb }
      }
    } else if (parsed.type === 'content_block_delta') {
      const block = blocks[parsed.index]
      const delta = parsed.delta || {}
      if (!block) return
      if (delta.type === 'text_delta' && delta.text) {
        block.text = (block.text || '') + delta.text
        await onText(delta.text)
      } else if (delta.type === 'input_json_delta') {
        block._json = (block._json || '') + (delta.partial_json || '')
      } else if (delta.type === 'thinking_delta') {
        block.thinking = (block.thinking || '') + (delta.thinking || '')
      } else if (delta.type === 'signature_delta') {
        block.signature = delta.signature || block.signature
      }
    } else if (parsed.type === 'content_block_stop') {
      const block = blocks[parsed.index]
      if (block && block.type === 'tool_use') {
        try {
          block.input = block._json ? JSON.parse(block._json) : {}
        } catch {
          block.input = {}
        }
        delete block._json
      }
    } else if (parsed.type === 'message_delta') {
      if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      let parsed
      try {
        parsed = JSON.parse(data)
      } catch {
        continue // skip malformed SSE lines
      }
      try {
        await handleEvent(parsed)
      } catch { /* never let one bad event kill the stream */ }
    }
  }

  const content = Object.keys(blocks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => blocks[i])
    .filter((b) => !(b.type === 'text' && !b.text)) // drop empty text blocks

  return { content, stopReason }
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check platform_settings for a key override; fall back to env var
  let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const psRes = await fetch(
        `${SUPABASE_URL}/rest/v1/platform_settings?key=eq.anthropic_api_key&select=value&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
      )
      if (psRes.ok) {
        const ps = await psRes.json()
        if (ps.length > 0 && ps[0].value) ANTHROPIC_API_KEY = ps[0].value
      }
    } catch { /* non-fatal — use env var */ }
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'AI service not configured' }, 500)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { messages, reportMonth, userId, financialSummary, marketResearch } = body || {}

  if (!messages || !Array.isArray(messages)) {
    return jsonResponse({ error: 'messages array required' }, 400)
  }

  // --- Verify JWT → role (server-side; client userId is never authoritative) ---
  const { userId: verifiedUserId, role, fullName } = await verifyUser(
    req, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  )

  // --- Rate limit check (unchanged — bookkeeping only) ---
  let todayMessageCount = 0
  if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_chat_sessions?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z&select=message_count`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      )
      if (res.ok) {
        const sessions = await res.json()
        todayMessageCount = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)
      }
    } catch {
      // Non-fatal — proceed without rate limit check
    }

    if (todayMessageCount >= DAILY_LIMIT) {
      return jsonResponse(
        { error: `Daily message limit (${DAILY_LIMIT}) reached. Try again tomorrow.` },
        429
      )
    }
  }

  // --- Fetch financial context from Supabase (dynamic block input) ---
  let financialContext = ''
  if (reportMonth && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const [finRes, alertsRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/financials_monthly?report_month=eq.${reportMonth}-01&select=*&limit=1`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/alerts_log?select=severity,message,category&order=severity.asc&limit=10`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        ),
      ])

      if (finRes.ok) {
        const finData = await finRes.json()
        if (finData.length > 0) {
          const f = finData[0]
          financialContext = `
FINANCIAL DATA FOR ${reportMonth}:
- Revenue: $${f.rev_total || 0}
- COS: $${f.cos_total || 0}
- Gross Profit: $${f.gross_profit || 0} (${f.gross_margin_pct || 0}% GM)
- Opex: $${f.opex_total || 0}
- Net Profit: $${f.net_profit || 0} (${f.net_margin_pct || 0}% NP margin)`
        }
      }

      if (alertsRes.ok) {
        const alertData = await alertsRes.json()
        if (alertData.length > 0) {
          financialContext += '\n\nACTIVE ALERTS:\n'
          alertData.forEach((a) => {
            financialContext += `- [${a.severity?.toUpperCase()}] ${a.category}: ${a.message}\n`
          })
        }
      }
    } catch {
      // Non-fatal — proceed with empty context
    }
  }

  // --- Tools: role-gated, byte-stable order; none without Supabase config ---
  const tools = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) ? toolsForRole(role) : []
  const executor = createToolExecutor({
    SUPABASE_URL,
    SERVICE_KEY: SUPABASE_SERVICE_ROLE_KEY,
    actorId: verifiedUserId,
    role: (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) ? role : null,
  })

  // --- Dynamic system block (per-request; NO cache_control, NO static leakage) ---
  const canAssign = tools.some((t) => t.name === 'assign_job')
  const permissionLine = !role
    ? 'The user is UNAUTHENTICATED — no tools are available, so live-data lookups and dispatch actions are unavailable this session. Answer from the manual and general knowledge only, and tell the user to sign in for live data or actions.'
    : canAssign
      ? `The user's role (${role}) can read live data AND assign jobs (assign_job available).`
      : `The user's role (${role}) can read live data (get_jobs, get_roster, get_business_rules) but CANNOT assign jobs — only owner, manager or fleet_manager can. If asked to assign work, explain that and name those roles.`

  const dynamicSystem = `Session context:
- Today's date (Australia/Melbourne): ${melbourneToday()}
- User: ${fullName || 'unknown name'}${role ? ` (role: ${role})` : ' (not signed in)'}
- Permissions: ${permissionLine}${reportMonth ? `\n- Selected report month: ${reportMonth}` : ''}${financialContext ? `\n${financialContext}` : ''}${!financialContext && financialSummary ? `\nFINANCIAL CONTEXT (from dashboard):\n${financialSummary}` : ''}${marketResearch ? '\nYou are conducting market research analysis for the skip bin hire industry in Melbourne. Focus on pricing strategy, competitive positioning, and market opportunities. Use current knowledge of the Australian waste management industry.' : ''}`

  const system = [
    { type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicSystem },
  ]

  // --- Conversation state for the agent loop ---
  const convo = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content || m.text || '',
  }))

  const basePayload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system,
    ...(tools.length > 0 ? { tools } : {}),
  }

  // --- Stream to the client ---
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const send = (obj) => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
  const sendDone = () => writer.write(encoder.encode('data: [DONE]\n\n'))

  // The first Anthropic call is STARTED (headers checked) before we return,
  // so hard failures still surface as graceful JSON errors (matching the
  // previous contract). Its body is consumed in the pump below — writing to
  // the TransformStream before the Response is returned would deadlock on
  // backpressure.
  let firstRes
  try {
    firstRes = await startAnthropicTurn(ANTHROPIC_API_KEY, { ...basePayload, messages: convo })
  } catch (err) {
    try { await writer.close() } catch { /* noop */ }
    return jsonResponse({ error: err?.status ? `AI error: ${err.status}` : 'AI service unavailable' }, 502)
  }

  // --- Update message count in Supabase (fire-and-forget, unchanged) ---
  if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/ai_chat_sessions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        report_month: reportMonth ? `${reportMonth}-01` : null,
        message_count: 1,
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {})
  }

  // --- Agent loop (tool use), pumped after the response is returned ---
  ;(async () => {
    try {
      // onText receives the raw delta string — wrap it in the {text} SSE shape
      // (passing `send` directly would emit bare JSON strings the client drops).
      const sendText = (t) => send({ text: t })
      let turn = await consumeAnthropicTurn(firstRes, sendText)
      let iterations = 1

      while (turn.stopReason === 'tool_use') {
        if (iterations >= MAX_TOOL_ITERATIONS) {
          await send({
            text: `\n\nI've hit the limit of ${MAX_TOOL_ITERATIONS} tool rounds for a single message, so I've stopped here. Ask me to continue and I'll pick up where I left off.`,
          })
          break
        }

        const toolUses = turn.content.filter((b) => b.type === 'tool_use')
        if (toolUses.length === 0) break // defensive: tool_use stop with no blocks

        // Append the assistant turn (FULL content array — thinking blocks included)
        convo.push({ role: 'assistant', content: turn.content })

        // Execute each requested tool, emitting running/done|error events
        const results = []
        for (const tu of toolUses) {
          await send({ tool: { name: tu.name, status: 'running' } })
          const result = await runToolSafe(executor, tu.name, tu.input)
          await send({
            tool: {
              name: tu.name,
              status: result.is_error ? 'error' : 'done',
              summary: result.summary,
            },
          })
          results.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: result.content,
            ...(result.is_error ? { is_error: true } : {}),
          })
        }
        convo.push({ role: 'user', content: results })

        iterations += 1
        const nextRes = await startAnthropicTurn(ANTHROPIC_API_KEY, { ...basePayload, messages: convo })
        turn = await consumeAnthropicTurn(nextRes, sendText)
      }

      await sendDone()
    } catch {
      // Mid-stream failure — surface gently, never hang the client
      try {
        await send({ text: '\n\n[Sorry — the AI service dropped out mid-response. Please try again.]' })
      } catch { /* noop */ }
      try { await sendDone() } catch { /* noop */ }
    } finally {
      try { await writer.close() } catch { /* noop */ }
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      Connection: 'keep-alive',
    },
  })
}
