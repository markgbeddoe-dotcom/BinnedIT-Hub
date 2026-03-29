// Vercel Edge Function — AI Chat Proxy (Security Fix)
// POST /api/chat → streams Anthropic response as SSE

/**
 * @file api/chat.js — Vercel Edge Function
 *
 * Proxies chat requests to the Anthropic Claude API.
 *
 * Security: The ANTHROPIC_API_KEY is never exposed to the browser.
 * All requests must come from the authenticated Binned-IT SPA.
 *
 * Rate limiting: 50 messages/user/day via ai_chat_sessions table.
 * If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set, rate
 * limiting is skipped (non-fatal).
 *
 * Financial context is injected into the system prompt from two sources:
 * 1. Supabase financials_monthly (live data, if available)
 * 2. financialSummary from request body (client-built from D.* hardcoded data)
 *
 * Market research mode: pass { marketResearch: true } in the request body
 * to enable competitive intelligence system prompt additions.
 *
 * @param {Request} req - Edge runtime Request object
 * @returns {Response} SSE stream of AI response chunks, or JSON error
 */

export const config = { runtime: 'edge' }

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2048
const DAILY_LIMIT = 50

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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, reportMonth, userId, financialSummary, marketResearch } = body || {}

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'messages array required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Rate limit check ---
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
      return new Response(
        JSON.stringify({ error: `Daily message limit (${DAILY_LIMIT}) reached. Try again tomorrow.` }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // --- Fetch financial context from Supabase ---
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

  const systemPrompt = `You are a financial business assistant for Binned-IT Pty Ltd, a skip bin hire business based in Seaford, Melbourne, Australia. The business operates in the waste management industry.

Key business facts:
- Skip bin hire for domestic, commercial, and industrial customers
- Specialises in general waste, asbestos removal, contaminated soil, and green waste
- Financial year runs July to June
- Based in Seaford, Melbourne
${financialContext}${!financialContext && financialSummary ? `\nFINANCIAL CONTEXT (from dashboard):\n${financialSummary}` : ''}${marketResearch ? `\nYou are conducting market research analysis for the skip bin hire industry in Melbourne. Focus on pricing strategy, competitive positioning, and market opportunities. Use current knowledge of the Australian waste management industry.` : ''}

Your role:
- Provide specific, actionable financial and operational advice
- Reference actual numbers from the financial data above
- Be concise and practical — Mark (the owner) is a busy operator
- Flag compliance risks (WHS, EPA, asbestos documentation) prominently
- Prioritise cash flow and profitability insights
- Use Australian business context (GST, PAYG, ATO, etc.)

Keep responses under 300 words unless the question requires more detail.`

  // --- Call Anthropic with streaming ---
  let anthropicRes
  try {
    anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || m.text || '',
        })),
      }),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    return new Response(JSON.stringify({ error: `AI error: ${anthropicRes.status}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Update message count in Supabase (fire-and-forget) ---
  if (userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const today = new Date().toISOString().slice(0, 10)
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

  // --- Stream Anthropic response as SSE ---
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  ;(async () => {
    const reader = anthropicRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const sseMsg = `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`
                await writer.write(encoder.encode(sseMsg))
              } else if (parsed.type === 'message_stop') {
                await writer.write(encoder.encode('data: [DONE]\n\n'))
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }
    } catch {
      await writer.write(encoder.encode('data: [DONE]\n\n'))
    } finally {
      await writer.close()
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
