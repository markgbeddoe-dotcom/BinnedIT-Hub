/**
 * @file api/invoice-chase.js — Vercel Cron Function
 *
 * Daily payment chasing for overdue invoices.
 * Schedule: 0 9 * * *  (9am UTC = 7pm AEST)
 *
 * Logic:
 *   1. Fetch all unpaid invoices (status: sent or overdue) with a due_date set
 *   2. Mark any past-due invoices as 'overdue'
 *   3. Send escalating reminders based on days overdue:
 *      - 7+ days  → friendly reminder  (once, if !reminder_7_sent)
 *      - 14+ days → firm follow-up     (once, if !reminder_14_sent)
 *      - 30+ days → final notice       (once, if !reminder_30_sent)
 *   4. All reminder emails are sent FROM accounts@binnedit.com.au
 *
 * Also accepts manual POST trigger: POST /api/invoice-chase
 */
export const config = { runtime: 'edge' }

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const RESEND_API    = 'https://api.resend.com/emails'
const FROM_EMAIL    = 'SkipSync Accounts <accounts@binnedit.com.au>'
const OWNER_EMAIL   = 'mark@binnedit.com.au'
const BUSINESS_NAME = 'Binned-IT Pty Ltd'

// ── Email templates ───────────────────────────────────────────────────────────

function reminder7Html(name, invoiceNumber, amount, dueDate) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="SkipSync" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#2D2640">Friendly Payment Reminder — Invoice ${invoiceNumber}</h2>
  <p>Dear ${name},</p>
  <p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for
     <strong>$${amount}</strong> was due on <strong>${dueDate}</strong> and remains unpaid.</p>
  <p>If you have already arranged payment, please disregard this notice. Otherwise, we'd appreciate
     settlement at your earliest convenience.</p>
  <p>To pay or discuss your account, please contact us:</p>
  <ul>
    <li>Email: <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>Thank you for your continued business.</p>
  <p>Kind regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

function reminder14Html(name, invoiceNumber, amount, dueDate) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="SkipSync" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#C96B6B">Payment Follow-Up Required — Invoice ${invoiceNumber}</h2>
  <p>Dear ${name},</p>
  <p>We previously sent a payment reminder for invoice <strong>${invoiceNumber}</strong> ($${amount}),
     which was due on <strong>${dueDate}</strong>. This account remains unpaid.</p>
  <p>Please arrange payment within the next <strong>7 days</strong> to avoid disruption to your
     account with ${BUSINESS_NAME}.</p>
  <p>If you are experiencing difficulty, please contact us to discuss a payment arrangement:</p>
  <ul>
    <li>Email: <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>If you have already made payment, please forward your remittance advice so we can update our records.</p>
  <p>Regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

function reminder30Html(name, invoiceNumber, amount, dueDate) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="SkipSync" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#C96B6B">FINAL NOTICE — Overdue Invoice ${invoiceNumber}</h2>
  <p>Dear ${name},</p>
  <p>Despite previous reminders, invoice <strong>${invoiceNumber}</strong> for
     <strong>$${amount}</strong>, due <strong>${dueDate}</strong>, remains unpaid and is now
     30+ days overdue.</p>
  <p><strong>Please arrange full payment within 7 days.</strong></p>
  <p>Failure to respond may result in:</p>
  <ul>
    <li>Referral to a debt collection agency</li>
    <li>Suspension of your account and credit terms</li>
    <li>Listing with a credit reporting agency</li>
  </ul>
  <p>To resolve this immediately, contact us:</p>
  <ul>
    <li>Email: <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>Regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendEmail(apiKey, to, subject, html) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Resend error ${res.status}`)
  return data.id
}

function daysBetween(dateStr) {
  const due  = new Date(dateStr)
  const now  = new Date()
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.floor((now - due) / 86400000)
}

function fmtAmount(n) {
  return parseFloat(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(dateStr) {
  if (!dateStr) return '(no due date)'
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 })
  }
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 })
  }

  const sbHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  }

  // 1. Fetch unpaid invoices with a due_date set
  const invoicesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?status=in.(sent,overdue)&due_date=not.is.null&select=*&order=due_date.asc`,
    { headers: sbHeaders }
  )
  if (!invoicesRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch invoices' }), { status: 502 })
  }
  const invoices = await invoicesRes.json()

  if (!invoices.length) {
    return new Response(JSON.stringify({ ok: true, message: 'No overdue invoices', processed: 0, sent: 0 }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  }

  const results = []

  for (const inv of invoices) {
    const daysOverdue = daysBetween(inv.due_date)

    // 2. Mark as overdue if past due date and not already
    if (daysOverdue > 0 && inv.status === 'sent') {
      await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ status: 'overdue' }),
      }).catch(() => {})
      inv.status = 'overdue'
    }

    // 3. Skip if no customer email or not overdue
    if (!inv.customer_email || daysOverdue <= 0) continue

    // Determine reminder tier
    let tier = null
    if (daysOverdue >= 30 && !inv.reminder_30_sent) tier = 30
    else if (daysOverdue >= 14 && !inv.reminder_14_sent) tier = 14
    else if (daysOverdue >= 7  && !inv.reminder_7_sent)  tier = 7

    if (!tier) continue

    const amount  = fmtAmount(inv.total)
    const dueDate = fmtDate(inv.due_date)
    const subject = tier === 30
      ? `FINAL NOTICE — Invoice ${inv.invoice_number} overdue`
      : tier === 14
        ? `Payment Follow-Up — Invoice ${inv.invoice_number}`
        : `Friendly Reminder — Invoice ${inv.invoice_number}`
    const html = tier === 30
      ? reminder30Html(inv.customer_name, inv.invoice_number, amount, dueDate)
      : tier === 14
        ? reminder14Html(inv.customer_name, inv.invoice_number, amount, dueDate)
        : reminder7Html(inv.customer_name, inv.invoice_number, amount, dueDate)

    try {
      await sendEmail(resendApiKey, inv.customer_email, subject, html)

      // Flag reminder as sent
      const reminderField = tier === 30 ? 'reminder_30_sent'
        : tier === 14 ? 'reminder_14_sent'
        : 'reminder_7_sent'
      await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ [reminderField]: true }),
      })

      results.push({ invoice: inv.invoice_number, customer: inv.customer_name, tier, daysOverdue, status: 'sent' })
    } catch (err) {
      results.push({ invoice: inv.invoice_number, customer: inv.customer_name, tier, daysOverdue, status: 'failed', error: err.message })
    }
  }

  const sent = results.filter(r => r.status === 'sent').length

  return new Response(
    JSON.stringify({ ok: true, processed: invoices.length, sent, results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
