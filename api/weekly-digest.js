// api/weekly-digest.js — Weekly AI business digest email
// Vercel Cron: every Monday 8am AEST (Sunday 21:00 UTC)
// Schedule defined in vercel.json: "0 21 * * 0"
//
// Queries Supabase for latest business metrics, sends data to Claude API
// for plain-English analysis, emails summary to Mark via Resend.
//
// Required env vars:
//   ANTHROPIC_API_KEY
//   SUPABASE_URL (default: https://dkjwyzjzdcgrepbgiuei.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   CRON_SECRET (Vercel auto-injects for cron auth)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
const DIGEST_TO = 'mark@binnedit.com.au'
const DIGEST_FROM = 'BinnedIT Hub <digest@binnedit.com.au>'

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchMetrics() {
  // Get last 3 months of financials for trend
  const [financials, debtors, compliance, alerts] = await Promise.all([
    supabaseGet('financials_monthly?select=report_month,rev_total,gross_profit,gross_margin_pct,net_profit,net_margin_pct&order=report_month.desc&limit=3'),
    supabaseGet('debtors_monthly?select=report_month,debtor_name,total_outstanding,overdue_30,overdue_60,overdue_90plus&order=report_month.desc&limit=20'),
    supabaseGet('compliance_records?select=report_month,epa_expiry_date,insurance_expiry_date,vehicle_rego_current,asbestos_jobs,asbestos_docs_complete&order=report_month.desc&limit=1'),
    supabaseGet('alerts_log?select=severity,category,message,created_at&order=created_at.desc&limit=15'),
  ])

  return { financials, debtors, compliance, alerts }
}

function buildMetricsSummary(metrics) {
  const { financials, debtors, compliance, alerts } = metrics
  const lines = []

  // Revenue trends
  if (financials && financials.length > 0) {
    lines.push('=== REVENUE TREND (latest 3 months) ===')
    financials.forEach(f => {
      const month = f.report_month ? f.report_month.slice(0, 7) : 'Unknown'
      lines.push(`${month}: Revenue $${Math.round(f.rev_total || 0).toLocaleString('en-AU')} | GP ${(f.gross_margin_pct || 0).toFixed(1)}% | Net Profit $${Math.round(f.net_profit || 0).toLocaleString('en-AU')} (${(f.net_margin_pct || 0).toFixed(1)}%)`)
    })
    if (financials.length >= 2) {
      const latest = financials[0]
      const prev = financials[1]
      const revChange = prev.rev_total > 0 ? ((latest.rev_total / prev.rev_total) - 1) * 100 : 0
      const npChange = (latest.net_profit || 0) - (prev.net_profit || 0)
      lines.push(`Month-on-month revenue: ${revChange >= 0 ? '+' : ''}${revChange.toFixed(1)}%`)
      lines.push(`Net profit change: ${npChange >= 0 ? '+' : ''}$${Math.round(Math.abs(npChange)).toLocaleString('en-AU')} ${npChange >= 0 ? 'improvement' : 'decline'}`)
    }
    lines.push('')
  }

  // Overdue AR
  if (debtors && debtors.length > 0) {
    const latestMonth = debtors[0].report_month
    const monthDebtors = debtors.filter(d => d.report_month === latestMonth)
    const totalOverdue = monthDebtors.reduce((s, d) => s + (d.overdue_30 || 0) + (d.overdue_60 || 0) + (d.overdue_90plus || 0), 0)
    const over90 = monthDebtors.reduce((s, d) => s + (d.overdue_90plus || 0), 0)
    const topOverdue = monthDebtors
      .filter(d => (d.overdue_30 + d.overdue_60 + d.overdue_90plus) > 0)
      .sort((a, b) => (b.total_outstanding - a.total_outstanding))
      .slice(0, 5)

    lines.push('=== ACCOUNTS RECEIVABLE ===')
    lines.push(`Total overdue: $${Math.round(totalOverdue).toLocaleString('en-AU')}`)
    lines.push(`90+ days overdue: $${Math.round(over90).toLocaleString('en-AU')}`)
    if (topOverdue.length > 0) {
      lines.push('Top debtors:')
      topOverdue.forEach(d => {
        const owed = (d.overdue_30 || 0) + (d.overdue_60 || 0) + (d.overdue_90plus || 0)
        lines.push(`  - ${d.debtor_name}: $${Math.round(owed).toLocaleString('en-AU')} overdue`)
      })
    }
    lines.push('')
  }

  // Compliance expiries
  if (compliance && compliance.length > 0) {
    const c = compliance[0]
    lines.push('=== COMPLIANCE STATUS ===')
    if (c.epa_expiry_date) {
      const daysToEpa = Math.round((new Date(c.epa_expiry_date) - new Date()) / 86400000)
      lines.push(`EPA licence expiry: ${c.epa_expiry_date} (${daysToEpa} days)`)
    }
    if (c.insurance_expiry_date) {
      const daysToIns = Math.round((new Date(c.insurance_expiry_date) - new Date()) / 86400000)
      lines.push(`Insurance expiry: ${c.insurance_expiry_date} (${daysToIns} days)`)
    }
    lines.push(`Vehicle rego current: ${c.vehicle_rego_current ? 'Yes' : 'No'}`)
    lines.push(`Asbestos jobs (last month): ${c.asbestos_jobs || 0} — docs complete: ${c.asbestos_docs_complete ? 'Yes' : 'No'}`)
    lines.push('')
  }

  // Active alerts
  if (alerts && alerts.length > 0) {
    lines.push('=== ACTIVE ALERTS ===')
    const critical = alerts.filter(a => a.severity === 'critical')
    const warnings = alerts.filter(a => a.severity === 'warning')
    if (critical.length > 0) {
      lines.push(`CRITICAL (${critical.length}):`)
      critical.forEach(a => lines.push(`  - [${a.category}] ${a.message}`))
    }
    if (warnings.length > 0) {
      lines.push(`WARNINGS (${warnings.length}):`)
      warnings.slice(0, 5).forEach(a => lines.push(`  - [${a.category}] ${a.message}`))
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function getAIAnalysis(metricsSummary) {
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Australia/Melbourne' })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: `You are a financial advisor for Binned-IT Pty Ltd, a skip bin hire business in Seaford, Melbourne. Today is ${today}.

Here is the latest business data:

${metricsSummary}

Write a concise weekly business digest for the owner Mark. Structure it as:

1. **Business Health This Week** — 2-3 sentences on overall performance
2. **Revenue & Profitability** — key observations and trends (2-3 bullet points)
3. **Cash Flow Watch** — overdue AR, top collection priorities (2-3 bullet points)
4. **Compliance Alerts** — anything urgent or expiring soon (bullet points, or "All clear" if none)
5. **3 Actions for This Week** — specific, practical priorities Mark should focus on

Be direct and practical. Mark is a busy operator — no fluff. Use Australian business context (GST, ATO, EPA). Keep the whole response under 400 words.`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || 'Analysis unavailable.'
}

function buildEmailHtml(aiAnalysis, metricsSummary, generatedAt) {
  // Convert markdown-style bold and bullets to HTML
  const formatted = aiAnalysis
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\d+\.\s+<strong>.*<\/strong>)/gm, '<h3 style="margin:18px 0 6px;color:#2D2640;font-family:Georgia,serif;font-size:15px;">$1</h3>')
    .replace(/^- (.*)/gm, '<li style="margin:4px 0;color:#3a3450;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin:6px 0 10px 18px;padding:0;">$&</ul>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;color:#3a3450;line-height:1.6;">')
    .replace(/^(?!<[hul])(.+)$/gm, '<p style="margin:8px 0;color:#3a3450;line-height:1.6;">$1</p>')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>BinnedIT Weekly Digest</title></head>
<body style="margin:0;padding:0;background:#D8D5E0;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#D8D5E0;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#000000;padding:24px 32px;border-radius:10px 10px 0 0;">
            <div style="font-family:'Oswald',Georgia,sans-serif;font-size:22px;font-weight:700;color:#7B8FD4;text-transform:uppercase;letter-spacing:0.08em;">
              BinnedIT HUB
            </div>
            <div style="font-size:13px;color:#888;margin-top:4px;">Weekly Business Digest</div>
            <div style="font-size:12px;color:#666;margin-top:2px;">${generatedAt}</div>
          </td>
        </tr>

        <!-- AI Analysis -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;">
            <div style="font-family:'Oswald',Georgia,sans-serif;font-size:13px;font-weight:700;color:#7B8FD4;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
              AI BUSINESS ANALYSIS
            </div>
            <div style="font-size:14px;line-height:1.7;color:#2D2640;">
              ${formatted}
            </div>
          </td>
        </tr>

        <!-- Raw Metrics -->
        <tr>
          <td style="background:#f5f4f8;padding:20px 32px;border-top:1px solid #ddd;">
            <div style="font-family:'Oswald',Georgia,sans-serif;font-size:12px;font-weight:700;color:#8E87A0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">
              DATA SNAPSHOT
            </div>
            <pre style="font-size:11px;color:#5A5270;line-height:1.6;white-space:pre-wrap;margin:0;font-family:'Courier New',monospace;">${metricsSummary.trim()}</pre>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#000000;padding:16px 32px;border-radius:0 0 10px 10px;text-align:center;">
            <div style="font-size:11px;color:#555;">
              Auto-generated by BinnedIT Hub · <a href="https://binnedit-hub.vercel.app" style="color:#7B8FD4;text-decoration:none;">binnedit-hub.vercel.app</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: [DIGEST_TO],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }

  return res.json()
}

export default async function handler(req, res) {
  // Verify cron secret (Vercel sets Authorization: Bearer {CRON_SECRET})
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' })
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' })

  try {
    // 1. Fetch metrics from Supabase
    const metrics = await fetchMetrics()
    const metricsSummary = buildMetricsSummary(metrics)

    // 2. Get AI analysis
    const aiAnalysis = await getAIAnalysis(metricsSummary)

    // 3. Build and send email
    const generatedAt = new Date().toLocaleString('en-AU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Melbourne',
    })
    const weekLabel = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Melbourne' })
    const html = buildEmailHtml(aiAnalysis, metricsSummary, generatedAt)

    await sendEmail(`BinnedIT Weekly Digest — ${weekLabel}`, html)

    return res.status(200).json({ ok: true, generatedAt })
  } catch (err) {
    console.error('Weekly digest error:', err)
    return res.status(500).json({ error: err.message })
  }
}
