/**
 * api/book-confirm.js — Vercel Edge Function
 *
 * Called after a booking is saved to Supabase.
 * Sends a customer confirmation email via Resend, BUT ONLY when:
 *   - RESEND_API_KEY is set (domain verified with Resend)
 *   - Sending FROM the @binned-it.com.au domain
 *
 * If RESEND_API_KEY is missing → skips email silently (still returns 200).
 * SMS notification → placeholder console log (Twilio not yet integrated).
 */

export const config = { runtime: 'edge' };

const FROM_EMAIL  = 'Binned-IT Bookings <noreply@binned-it.com.au>';
const OFFICE_EMAIL = 'bookings@binned-it.com.au';
const OFFICE_PHONE = '+61395552000'; // Twilio placeholder

function buildCustomerHtml({ bookingRef, customerName, binSize, deliveryDate, price, suburb }) {
  const fmtDate = (str) => {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking Confirmed — Binned-IT</title></head>
<body style="margin:0;padding:0;background:#F2F6F4;font-family:'DM Sans',Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F6F4;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#000006;padding:24px 32px;">
          <div style="font-size:22px;font-weight:800;color:#EFDF0F;letter-spacing:0.03em;">BINNED-IT</div>
          <div style="font-size:12px;color:#888;margin-top:4px;">Skip Bin Hire — Seaford, Melbourne</div>
        </td></tr>

        <!-- Yellow strip -->
        <tr><td style="background:#EFDF0F;padding:10px 32px;">
          <div style="font-size:13px;font-weight:700;color:#000006;">Booking Confirmed ✓</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="font-size:16px;font-weight:700;margin:0 0 6px;">Hi ${customerName},</p>
          <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
            Thanks for booking with Binned-IT! We&rsquo;ve received your request and will confirm within 2 business hours.
          </p>

          <!-- Booking reference -->
          <div style="background:#FEFCE8;border:2px solid #EFDF0F;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
            <div style="font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Booking Reference</div>
            <div style="font-size:28px;font-weight:800;color:#000006;letter-spacing:0.08em;">#${bookingRef || 'PENDING'}</div>
          </div>

          <!-- Details table -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${[
              ['Bin Size',      binSize],
              ['Delivery Date', fmtDate(deliveryDate)],
              ['Delivery Area', suburb],
              ['Total Price',   `$${price} inc. GST`],
            ].map(([label, value], i) => `
            <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F9FAFB'};">
              <td style="padding:11px 16px;font-size:13px;color:#6B7280;font-weight:600;width:140px;">${label}</td>
              <td style="padding:11px 16px;font-size:14px;color:#111827;">${value}</td>
            </tr>`).join('')}
          </table>

          <!-- What happens next -->
          <div style="background:#F9FAFB;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <div style="font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">What Happens Next</div>
            ${[
              'Our team will call to confirm your booking',
              'Your bin will be delivered on the requested date',
              'Our driver will call 30 minutes before arrival',
              'Fill your bin — we\'ll collect it on the agreed date',
            ].map((text, i) => `
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
              <div style="width:22px;height:22px;border-radius:50%;background:#EFDF0F;color:#000006;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:22px;">${i + 1}</div>
              <div style="font-size:13px;color:#374151;padding-top:3px;">${text}</div>
            </div>`).join('')}
          </div>

          <!-- Contact -->
          <p style="font-size:13px;color:#6B7280;margin:0;line-height:1.7;">
            Questions? Call us on <a href="tel:0395552000" style="color:#000006;font-weight:700;text-decoration:none;">03 9555 2000</a>
            or reply to this email.<br>
            Mon–Sat 7am–5pm
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#000006;padding:16px 32px;">
          <p style="font-size:11px;color:#666;margin:0;text-align:center;">
            &copy; ${new Date().getFullYear()} Binned-IT Pty Ltd &mdash; Seaford VIC 3198
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOfficeText({ bookingRef, customerName, customerEmail, customerPhone, binSize, deliveryDate, suburb, postcode, price }) {
  return `NEW BOOKING #${bookingRef || 'PENDING'}

Customer: ${customerName}
Email:    ${customerEmail}
Phone:    ${customerPhone}
Address:  ${suburb} ${postcode}
Bin:      ${binSize}
Delivery: ${deliveryDate}
Price:    $${price}

Login to Dashboard Hub to confirm this booking.`;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const {
    bookingId, bookingRef, customerName, customerEmail,
    binSize, deliveryDate, price, suburb, postcode, customerPhone,
  } = body;

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // ── SMS placeholder ───────────────────────────────────────────────────────
  // TODO: replace with Twilio when credentials are provisioned
  console.log(`[SMS-PLACEHOLDER] New booking #${bookingRef || bookingId?.slice(0,8)?.toUpperCase()}: ${customerName}, ${binSize}, delivery ${deliveryDate}, ${suburb}`);

  // ── Email via Resend ──────────────────────────────────────────────────────
  // Only send from @binned-it.com.au domain — requires RESEND_API_KEY + verified domain
  if (!RESEND_API_KEY) {
    console.log('[book-confirm] RESEND_API_KEY not set — skipping email. Booking saved to Supabase.');
    return Response.json({ sent: false, reason: 'no_api_key' });
  }

  const emailPayloads = [
    // 1. Confirmation to customer
    {
      from: FROM_EMAIL,
      to:   [customerEmail],
      subject: `Booking Confirmed — ${binSize} Skip Bin | Binned-IT #${bookingRef}`,
      html: buildCustomerHtml({ bookingRef, customerName, binSize, deliveryDate, price, suburb }),
    },
    // 2. Notification to office
    {
      from:    FROM_EMAIL,
      to:      [OFFICE_EMAIL],
      subject: `[New Booking] #${bookingRef} — ${customerName} — ${binSize} — ${deliveryDate}`,
      text:    buildOfficeText({ bookingRef, customerName, customerEmail, customerPhone, binSize, deliveryDate, suburb, postcode, price }),
    },
  ];

  const results = await Promise.allSettled(
    emailPayloads.map(payload =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
    )
  );

  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
  if (errors.length > 0) {
    console.error('[book-confirm] Resend errors:', errors);
    // Still return 200 — booking is already saved; email is best-effort
    return Response.json({ sent: false, errors }, { status: 200 });
  }

  console.log(`[book-confirm] Emails sent for booking #${bookingRef}`);
  return Response.json({ sent: true, bookingRef });
}
