// Vercel Serverless Function — daily overdue invoice reminder emails
// Triggered by Vercel cron at 22:00 UTC (08:00 AEST)
// Sends escalating reminder emails at 7, 14, and 30 days overdue via Resend API
//
// Required env vars:
//   SUPABASE_SERVICE_ROLE_KEY — Supabase admin access
//   RESEND_API_KEY            — Resend email service API key
//   CRON_SECRET               — Vercel cron authorization secret (auto-set by Vercel)
//   REMINDER_FROM_EMAIL       — From address (default: reminders@binnedit.com.au)
//   REMINDER_REPLY_TO         — Reply-to address (default: mark@binnedit.com.au)

const SUPABASE_URL = 'https://dkjwyzjzdcgrepbgiuei.supabase.co';
const FROM_EMAIL = process.env.REMINDER_FROM_EMAIL || 'reminders@binnedit.com.au';
const REPLY_TO   = process.env.REMINDER_REPLY_TO   || 'mark@binnedit.com.au';

// ── Email templates ─────────────────────────────────────────────────────────

function buildEmail(invoice, daysOverdue) {
  const amountFormatted = `$${Number(invoice.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
  const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  if (daysOverdue <= 7) {
    return {
      subject: `Friendly reminder — Invoice ${invoice.invoice_number} overdue`,
      html: `
<p>Hi ${invoice.customer_name},</p>
<p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> for <strong>${amountFormatted}</strong>
was due on <strong>${dueDateFormatted}</strong> and remains outstanding.</p>
<p>If you've already sent payment, please disregard this email — it may have crossed in transit.</p>
<p>If you have any questions, please reply to this email or call us directly.</p>
<p>Thanks for your business,<br>
<strong>Mark Beddoe</strong><br>
Binned-IT Pty Ltd<br>
<a href="mailto:mark@binnedit.com.au">mark@binnedit.com.au</a></p>
`,
    };
  }

  if (daysOverdue <= 14) {
    return {
      subject: `Second reminder — Invoice ${invoice.invoice_number} now ${daysOverdue} days overdue`,
      html: `
<p>Hi ${invoice.customer_name},</p>
<p>We're writing again regarding invoice <strong>${invoice.invoice_number}</strong> for <strong>${amountFormatted}</strong>,
which was due on <strong>${dueDateFormatted}</strong> and is now <strong>${daysOverdue} days overdue</strong>.</p>
<p>Please arrange payment at your earliest convenience to keep your account in good standing.</p>
<p>If there is an issue with this invoice or you need to discuss payment arrangements, please contact us immediately.</p>
<p>Regards,<br>
<strong>Mark Beddoe</strong><br>
Binned-IT Pty Ltd<br>
<a href="mailto:mark@binnedit.com.au">mark@binnedit.com.au</a></p>
`,
    };
  }

  // 30+ days — final notice
  return {
    subject: `FINAL NOTICE — Invoice ${invoice.invoice_number} — ${daysOverdue} days overdue`,
    html: `
<p>Hi ${invoice.customer_name},</p>
<p>Despite previous reminders, invoice <strong>${invoice.invoice_number}</strong> for <strong>${amountFormatted}</strong>
(due <strong>${dueDateFormatted}</strong>) remains unpaid after <strong>${daysOverdue} days</strong>.</p>
<p><strong>Please note:</strong> If payment or contact is not received within 7 days, we may refer this matter
to our debt recovery process and your account may be placed on hold.</p>
<p>To avoid further action, please pay immediately or contact us to discuss this matter urgently.</p>
<p>Yours sincerely,<br>
<strong>Mark Beddoe</strong><br>
Binned-IT Pty Ltd<br>
<a href="mailto:mark@binnedit.com.au">mark@binnedit.com.au</a></p>
`,
  };
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchOverdueInvoices(serviceKey) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ar_invoices?status=eq.outstanding&due_date=lt.${today}&select=*`,
    {
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function markReminderSent(serviceKey, invoiceId, field) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ar_invoices?id=eq.${invoiceId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ [field]: new Date().toISOString(), updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed (${res.status}): ${text}`);
  }
}

// ── Resend email helper ──────────────────────────────────────────────────────

async function sendEmail(resendKey, to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      reply_to: REPLY_TO,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend error (${res.status}): ${data.message || JSON.stringify(data)}`);
  return data.id;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  // Verify cron secret (Vercel sets this automatically; also allow manual POST with secret header)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey  = process.env.RESEND_API_KEY;

  if (!serviceKey || !resendKey) {
    return new Response(
      JSON.stringify({ error: 'Missing env vars: SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY' }),
      { status: 500 }
    );
  }

  const results = { sent: [], skipped: [], errors: [] };
  const today = new Date();

  let invoices;
  try {
    invoices = await fetchOverdueInvoices(serviceKey);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  for (const invoice of invoices) {
    const daysOverdue = Math.floor((today - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));

    // Determine which reminder tier applies (check most urgent first)
    let reminderField = null;
    let targetDays = null;

    if (daysOverdue >= 30 && !invoice.reminder_30_sent) {
      reminderField = 'reminder_30_sent';
      targetDays = daysOverdue;
    } else if (daysOverdue >= 14 && !invoice.reminder_14_sent) {
      reminderField = 'reminder_14_sent';
      targetDays = daysOverdue;
    } else if (daysOverdue >= 7 && !invoice.reminder_7_sent) {
      reminderField = 'reminder_7_sent';
      targetDays = daysOverdue;
    }

    if (!reminderField) {
      results.skipped.push({ invoice: invoice.invoice_number, reason: 'no reminder due' });
      continue;
    }

    if (!invoice.customer_email) {
      results.skipped.push({ invoice: invoice.invoice_number, reason: 'no email address' });
      continue;
    }

    try {
      const { subject, html } = buildEmail(invoice, targetDays);
      const emailId = await sendEmail(resendKey, invoice.customer_email, subject, html);
      await markReminderSent(serviceKey, invoice.id, reminderField);
      results.sent.push({ invoice: invoice.invoice_number, tier: reminderField, emailId });
    } catch (err) {
      results.errors.push({ invoice: invoice.invoice_number, error: err.message });
    }
  }

  return new Response(JSON.stringify({
    processed: invoices.length,
    ...results,
    timestamp: today.toISOString(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { runtime: 'edge' };
