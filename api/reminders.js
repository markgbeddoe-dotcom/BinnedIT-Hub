// Vercel Cron Function — Overdue Payment Reminders
// Schedule: 0 8 * * *  (daily at 8am UTC = 6pm AEST)
// Checks debtors_monthly for overdue amounts and sends escalating email reminders.
//
// Reminder schedule:
//   7-day bucket  (debtors_monthly.bucket_30 > 0 and days ~7)  → friendly reminder
//   14-day bucket (debtors_monthly.bucket_30 > 0 and days ~14) → firmer follow-up
//   30-day bucket (debtors_monthly.bucket_60 > 0)              → final notice
//
// Since Supabase stores AR in aging buckets (not per-invoice due dates), we:
//   1. Fetch the latest month's debtors data
//   2. For each debtor with overdue amounts, check email_reminders_log to
//      see if we've already sent a reminder this cycle
//   3. Send appropriate tier email via Resend API
//   4. Log in email_reminders_log to prevent duplicates
//
// DOMAIN RESTRICTION: Emails may only be sent to @binnedit.com.au addresses.
// All other recipients are skipped and logged as a warning. This restriction
// is in place until further notice from the project owner.

export const config = { runtime: 'edge' }

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'Binned-IT Accounts <accounts@binnedit.com.au>'
const OWNER_EMAIL = 'mark@binnedit.com.au'
const BUSINESS_NAME = 'Binned-IT Pty Ltd'
const ALLOWED_DOMAIN = 'binnedit.com.au'

function isAllowedDomain(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
}

async function sendEmail(apiKey, to, subject, html) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `Resend error ${res.status}`)
  return data.id
}

function reminder7DayHtml(customerName, amount, ownerEmail) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="Binned-IT" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#2D2640">Friendly Payment Reminder</h2>
  <p>Dear ${customerName},</p>
  <p>We hope you're well. This is a friendly reminder that you have an outstanding invoice balance of
     <strong>$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong> with ${BUSINESS_NAME}.</p>
  <p>If you've already arranged payment, please disregard this notice. Otherwise, we'd appreciate
     settlement at your earliest convenience.</p>
  <p>To pay or discuss your account, please contact us:</p>
  <ul>
    <li>Email: <a href="mailto:${ownerEmail}">${ownerEmail}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>Thank you for your business.</p>
  <p>Kind regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

function reminder14DayHtml(customerName, amount, ownerEmail) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="Binned-IT" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#C96B6B">Payment Follow-Up — Action Required</h2>
  <p>Dear ${customerName},</p>
  <p>We previously sent a payment reminder and note that your account balance of
     <strong>$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong> remains outstanding.</p>
  <p>We kindly ask that you arrange payment within the next <strong>7 days</strong> to avoid
     any disruption to your account with ${BUSINESS_NAME}.</p>
  <p>If you are experiencing difficulty, please contact us to discuss a payment arrangement:</p>
  <ul>
    <li>Email: <a href="mailto:${ownerEmail}">${ownerEmail}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>If you have already made payment, please forward your remittance advice so we can update our records.</p>
  <p>Regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

function reminder30DayHtml(customerName, amount, ownerEmail) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <img src="https://binnedit-hub.vercel.app/logo.jpg" alt="Binned-IT" style="height:50px;margin-bottom:20px" />
  <h2 style="color:#C96B6B">FINAL NOTICE — Overdue Account</h2>
  <p>Dear ${customerName},</p>
  <p>Despite previous reminders, your account balance of
     <strong>$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</strong>
     with ${BUSINESS_NAME} remains unpaid and is now 30+ days overdue.</p>
  <p><strong>Please arrange full payment within 7 days.</strong></p>
  <p>Failure to respond may result in your account being referred to a debt collection agency and
     suspension of credit terms.</p>
  <p>To resolve this immediately, contact us:</p>
  <ul>
    <li>Email: <a href="mailto:${ownerEmail}">${ownerEmail}</a></li>
    <li>Phone: (03) xxxx xxxx</li>
  </ul>
  <p>If you are disputing any invoices, please contact us urgently to discuss.</p>
  <p>Regards,<br/>Accounts Team<br/>${BUSINESS_NAME}</p>
</body>
</html>`
}

export default async function handler(req) {
  // Allow manual trigger via POST as well as scheduled GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), { status: 500 })
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 })
  }

  const sbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }

  // Fetch latest debtors data (most recent month with data)
  const debtorsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/debtors_monthly?select=*&order=report_month.desc&limit=50`,
    { headers: sbHeaders }
  )
  if (!debtorsRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch debtors' }), { status: 502 })
  }
  const debtors = await debtorsRes.json()
  if (!debtors.length) {
    return new Response(JSON.stringify({ ok: true, message: 'No debtors data found', sent: 0 }), { status: 200 })
  }

  // Find the latest report month
  const latestMonth = debtors[0].report_month?.slice(0, 7)

  // Only process debtors from latest month
  const currentDebtors = debtors.filter(d => d.report_month?.startsWith(latestMonth))

  // Fetch existing reminders sent this month to avoid duplicates
  const remindersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_reminders_log?report_month=eq.${latestMonth}-01&select=customer_name,reminder_type`,
    { headers: sbHeaders }
  )
  const existingReminders = remindersRes.ok ? await remindersRes.json() : []
  const alreadySent = new Set(existingReminders.map(r => `${r.customer_name}::${r.reminder_type}`))

  const results = []

  for (const debtor of currentDebtors) {
    const { customer_name, customer_email, bucket_30, bucket_60, bucket_90 } = debtor

    // Skip if no email address
    if (!customer_email) continue

    // Domain restriction: only send to @binnedit.com.au addresses
    if (!isAllowedDomain(customer_email)) {
      console.warn(`[reminders] Skipping ${customer_name} — recipient ${customer_email} is not @${ALLOWED_DOMAIN}`)
      continue
    }

    // Determine which reminder tier applies
    // bucket_30 = 30-60 day overdue, bucket_60 = 60-90 days, bucket_90 = 90+ days
    const overdue30 = parseFloat(bucket_30 || 0)
    const overdue60 = parseFloat(bucket_60 || 0)
    const overdue90 = parseFloat(bucket_90 || 0)

    let reminderType = null
    let overdueAmount = 0

    if (overdue90 > 0 && !alreadySent.has(`${customer_name}::30day`)) {
      reminderType = '30day'
      overdueAmount = overdue30 + overdue60 + overdue90
    } else if (overdue60 > 0 && !alreadySent.has(`${customer_name}::14day`)) {
      reminderType = '14day'
      overdueAmount = overdue30 + overdue60
    } else if (overdue30 > 50 && !alreadySent.has(`${customer_name}::7day`)) {
      // Only send 7-day if amount is meaningful (>$50)
      reminderType = '7day'
      overdueAmount = overdue30
    }

    if (!reminderType) continue

    const subject = reminderType === '30day'
      ? `FINAL NOTICE — Overdue Account: ${customer_name}`
      : reminderType === '14day'
        ? `Payment Follow-Up Required — ${customer_name}`
        : `Friendly Reminder — Outstanding Balance`

    const html = reminderType === '30day'
      ? reminder30DayHtml(customer_name, overdueAmount, OWNER_EMAIL)
      : reminderType === '14day'
        ? reminder14DayHtml(customer_name, overdueAmount, OWNER_EMAIL)
        : reminder7DayHtml(customer_name, overdueAmount, OWNER_EMAIL)

    try {
      const resendId = await sendEmail(RESEND_API_KEY, customer_email, subject, html)

      // Log the sent reminder
      await fetch(`${SUPABASE_URL}/rest/v1/email_reminders_log`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          customer_name,
          customer_email,
          reminder_type: reminderType,
          amount_overdue: overdueAmount,
          report_month: `${latestMonth}-01`,
          resend_id: resendId,
          status: 'sent',
        }),
      })

      results.push({ customer: customer_name, type: reminderType, amount: overdueAmount, status: 'sent' })
    } catch (err) {
      // Log failure
      await fetch(`${SUPABASE_URL}/rest/v1/email_reminders_log`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({
          customer_name,
          customer_email,
          reminder_type: reminderType,
          amount_overdue: overdueAmount,
          report_month: `${latestMonth}-01`,
          status: 'failed',
        }),
      }).catch(() => {})
      results.push({ customer: customer_name, type: reminderType, status: 'failed', error: err.message })
    }
  }

  return new Response(
    JSON.stringify({ ok: true, month: latestMonth, processed: currentDebtors.length, sent: results.filter(r => r.status === 'sent').length, results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
