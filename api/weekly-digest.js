// Vercel Cron Function — Weekly AI Business Digest Email
// Schedule: 0 20 * * 0  (Sunday 8pm UTC = Monday 6am AEST)
//
// Fetches key metrics from Supabase, sends to Claude for analysis,
// then emails the digest to Mark via Resend.
//
// Sections:
//   - P&L summary (latest month + YTD)
//   - Overdue AR / top debtors
//   - Compliance expiries in the next 30 days
//   - Cash flow position
//   - Any churn signals from customer_order_history
//   - Claude's analysis and recommendations

export const config = { runtime: 'edge' }

const RESEND_API = 'https://api.resend.com/emails'
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const DIGEST_TO = 'mark@binnedit.com.au'
const FROM_EMAIL = 'SkipSync <digest@binnedit.com.au>'

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers })
  if (!res.ok) return null
  return res.json()
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 })
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 })
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 })
  }

  const sb = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  }

  // ---- Gather data in parallel ----
  const [financials, debtors, compliance, ytdRows] = await Promise.all([
    // Latest month financials
    fetchJson(`${SUPABASE_URL}/rest/v1/financials_monthly?select=*&order=report_month.desc&limit=1`, sb),
    // Latest debtors
    fetchJson(`${SUPABASE_URL}/rest/v1/debtors_monthly?select=*&order=report_month.desc,total_outstanding.desc&limit=20`, sb),
    // Latest compliance
    fetchJson(`${SUPABASE_URL}/rest/v1/compliance_records?select=*&order=report_month.desc&limit=1`, sb),
    // Last 3 months financials for YTD/trend
    fetchJson(`${SUPABASE_URL}/rest/v1/financials_monthly?select=report_month,rev_total,net_profit,gross_margin_pct&order=report_month.desc&limit=3`, sb),
  ])

  const latestFin = financials?.[0] || null
  const latestCompliance = compliance?.[0] || null
  const latestMonth = latestFin?.report_month?.slice(0, 7) || 'N/A'

  // Summarise overdue debtors
  const latestMonthDebtors = debtors?.filter(d => d.report_month?.startsWith(latestMonth)) || []
  const overdueTotal = latestMonthDebtors.reduce((s, d) =>
    s + parseFloat(d.bucket_30 || 0) + parseFloat(d.bucket_60 || 0) + parseFloat(d.bucket_90 || 0), 0)
  const topOverdue = latestMonthDebtors
    .filter(d => (parseFloat(d.bucket_30 || 0) + parseFloat(d.bucket_60 || 0) + parseFloat(d.bucket_90 || 0)) > 0)
    .sort((a, b) => (parseFloat(b.bucket_60 || 0) + parseFloat(b.bucket_90 || 0)) - (parseFloat(a.bucket_60 || 0) + parseFloat(a.bucket_90 || 0)))
    .slice(0, 5)

  // Compliance expiries in the next 30 days
  const today = new Date()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiryFields = [
    { key: 'public_liability_expiry', label: 'Public Liability' },
    { key: 'workers_comp_expiry', label: "Workers' Comp" },
    { key: 'epa_renewal_date', label: 'EPA Licence' },
  ]
  const upcomingExpiries = []
  if (latestCompliance) {
    expiryFields.forEach(({ key, label }) => {
      const expiry = latestCompliance[key]
      if (expiry) {
        const d = new Date(expiry)
        if (d <= in30Days) {
          upcomingExpiries.push({ label, date: expiry, daysUntil: Math.round((d - today) / 86400000) })
        }
      }
    })
  }

  // Build context string for Claude
  const contextLines = [
    `=== BINNED-IT WEEKLY BUSINESS DIGEST — Week of ${today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ===`,
    '',
    `LATEST MONTH (${latestMonth}):`,
    latestFin ? [
      `  Revenue: $${Math.round(latestFin.rev_total || 0).toLocaleString('en-AU')}`,
      `  Gross Profit: $${Math.round(latestFin.gross_profit || 0).toLocaleString('en-AU')} (${(latestFin.gross_margin_pct || 0).toFixed(1)}% GM)`,
      `  Net Profit: $${Math.round(latestFin.net_profit || 0).toLocaleString('en-AU')}`,
    ].join('\n') : '  No data available',
    '',
    'REVENUE TREND (last 3 months):',
    ...(ytdRows || []).map(r =>
      `  ${r.report_month?.slice(0, 7)}: Revenue $${Math.round(r.rev_total || 0).toLocaleString('en-AU')} | NP $${Math.round(r.net_profit || 0).toLocaleString('en-AU')} | GM ${(r.gross_margin_pct || 0).toFixed(1)}%`
    ),
    '',
    `OVERDUE DEBTORS — Total: $${Math.round(overdueTotal).toLocaleString('en-AU')}`,
    topOverdue.length ? topOverdue.map(d =>
      `  ${d.customer_name}: 30-60d $${Math.round(parseFloat(d.bucket_30 || 0)).toLocaleString('en-AU')} | 60-90d $${Math.round(parseFloat(d.bucket_60 || 0)).toLocaleString('en-AU')} | 90d+ $${Math.round(parseFloat(d.bucket_90 || 0)).toLocaleString('en-AU')}`
    ).join('\n') : '  No overdue debtors',
    '',
    'COMPLIANCE EXPIRIES (next 30 days):',
    upcomingExpiries.length
      ? upcomingExpiries.map(e => `  ⚠️ ${e.label}: expires ${e.date} (${e.daysUntil} days)`).join('\n')
      : '  None — all current',
  ].join('\n')

  // Ask Claude for analysis
  let aiAnalysis = ''
  try {
    const aiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are preparing a weekly business digest for Mark Beddoe, owner of Binned-IT Pty Ltd operating via SkipSync (skip bin hire, Seaford Melbourne).

${contextLines}

Write a concise weekly digest in plain text (not markdown). Include:
1. A 2-sentence business health summary
2. Top 2-3 action items for the week (prioritised)
3. Any risks that need immediate attention
4. One positive trend or win to acknowledge

Keep it under 250 words. Be direct and practical — Mark is busy.`,
        }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      aiAnalysis = aiData.content?.[0]?.text || ''
    }
  } catch {
    aiAnalysis = 'AI analysis unavailable this week — check dashboard manually.'
  }

  // Build HTML email
  const overdueRow = overdueTotal > 0
    ? `<tr><td style="padding:8px;color:#C96B6B;font-weight:700">⚠ Overdue AR</td><td style="padding:8px">$${Math.round(overdueTotal).toLocaleString('en-AU')}</td></tr>`
    : `<tr><td style="padding:8px;color:#5E9E78">✓ Overdue AR</td><td style="padding:8px">$0 — all clear</td></tr>`

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto;padding:20px;background:#f5f5f5">
  <div style="background:#000;padding:20px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:16px">
    <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="SkipSync" style="height:40px;border-radius:4px" />
    <div>
      <div style="color:#EFDF0F;font-size:16px;font-weight:700">SkipSync Weekly Digest</div>
      <div style="color:#aaa;font-size:12px">${today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <div style="background:#fff;padding:24px;border:1px solid #ddd;border-top:none">

    <h2 style="font-size:14px;color:#2D2640;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 16px">
      AI Analysis
    </h2>
    <div style="background:#f8f7fb;border-left:3px solid #7B8FD4;padding:16px;border-radius:4px;font-size:14px;line-height:1.6;white-space:pre-wrap">${aiAnalysis}</div>

    <h2 style="font-size:14px;color:#2D2640;text-transform:uppercase;letter-spacing:0.05em;margin:24px 0 12px">
      Latest Month — ${latestMonth}
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#f8f7fb">
        <td style="padding:8px">Revenue</td>
        <td style="padding:8px;font-weight:700">$${Math.round(latestFin?.rev_total || 0).toLocaleString('en-AU')}</td>
      </tr>
      <tr>
        <td style="padding:8px">Gross Profit</td>
        <td style="padding:8px">$${Math.round(latestFin?.gross_profit || 0).toLocaleString('en-AU')} (${(latestFin?.gross_margin_pct || 0).toFixed(1)}% GM)</td>
      </tr>
      <tr style="background:#f8f7fb">
        <td style="padding:8px">Net Profit</td>
        <td style="padding:8px;color:${(latestFin?.net_profit || 0) >= 0 ? '#5E9E78' : '#C96B6B'};font-weight:700">
          $${Math.round(latestFin?.net_profit || 0).toLocaleString('en-AU')}
        </td>
      </tr>
      ${overdueRow}
    </table>

    ${topOverdue.length > 0 ? `
    <h2 style="font-size:14px;color:#2D2640;text-transform:uppercase;letter-spacing:0.05em;margin:24px 0 12px">
      Top Overdue Accounts
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="border-bottom:2px solid #eee;color:#888;font-size:11px;text-transform:uppercase">
        <th style="padding:6px;text-align:left">Customer</th>
        <th style="padding:6px;text-align:right">30-60d</th>
        <th style="padding:6px;text-align:right">60-90d</th>
        <th style="padding:6px;text-align:right">90d+</th>
      </tr>
      ${topOverdue.map((d, i) => `
      <tr style="border-bottom:1px solid #eee;background:${i % 2 ? '#f8f7fb' : '#fff'}">
        <td style="padding:6px">${d.customer_name}</td>
        <td style="padding:6px;text-align:right">$${Math.round(parseFloat(d.bucket_30 || 0)).toLocaleString('en-AU')}</td>
        <td style="padding:6px;text-align:right;color:${parseFloat(d.bucket_60 || 0) > 0 ? '#C96B6B' : '#333'}">$${Math.round(parseFloat(d.bucket_60 || 0)).toLocaleString('en-AU')}</td>
        <td style="padding:6px;text-align:right;color:${parseFloat(d.bucket_90 || 0) > 0 ? '#C96B6B' : '#333'};font-weight:${parseFloat(d.bucket_90 || 0) > 0 ? 700 : 400}">$${Math.round(parseFloat(d.bucket_90 || 0)).toLocaleString('en-AU')}</td>
      </tr>`).join('')}
    </table>` : ''}

    ${upcomingExpiries.length > 0 ? `
    <div style="background:#fff8f0;border:1px solid #f0c08a;border-radius:6px;padding:14px;margin-top:20px">
      <div style="font-size:13px;font-weight:700;color:#b85c00;margin-bottom:8px">⚠ Compliance Expiries (next 30 days)</div>
      ${upcomingExpiries.map(e => `<div style="font-size:13px;margin:4px 0">${e.label}: <strong>${e.date}</strong> (${e.daysUntil} days)</div>`).join('')}
    </div>` : ''}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
      <a href="https://binnedit-hub.vercel.app" style="color:#EFDF0F">Open SkipSync</a> ·
      Binned-IT Pty Ltd · Seaford, Melbourne · Auto-generated weekly digest
    </div>
  </div>
</body>
</html>`

  // Send via Resend
  const sendRes = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [DIGEST_TO],
      subject: `SkipSync Weekly Digest — ${today.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`,
      html,
    }),
  })

  const sendData = await sendRes.json()
  if (!sendRes.ok) {
    return new Response(JSON.stringify({ error: 'Email send failed', details: sendData }), { status: 502 })
  }

  return new Response(
    JSON.stringify({ ok: true, emailId: sendData.id, month: latestMonth, overdueTotal: Math.round(overdueTotal) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
