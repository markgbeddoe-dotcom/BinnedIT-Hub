// ── Legal document generators for SkipSync ───────────────────────────────────
// All templates comply with Victorian / Commonwealth law as at 2026.
// Review with a solicitor before first use. Not legal advice.
//
// Company identity (ABN, ACN, BSB, etc.) MUST be supplied by the caller via
// the `company` argument (sourced from platform_settings via useCompanyConfig).
// If the caller passes nothing, the placeholders below kick in — these will
// produce a LEGALLY DEFECTIVE document, so every consumer must gate any "send"
// action on hasPlaceholders === false (see useCompanyConfig.js).

const PLACEHOLDER_COMPANY = {
  name: 'Binned-IT Pty Ltd',
  abn: '57 123 456 789',        // PLACEHOLDER — must override via platform_settings
  acn: '123 456 789',           // PLACEHOLDER
  address: '12 Industrial Way, Seaford VIC 3198',
  phone: '03 9000 0000',        // PLACEHOLDER
  email: 'accounts@binnedit.com.au',
  bsb: '063-000',               // PLACEHOLDER
  account_number: '1234 5678',  // PLACEHOLDER
  penalty_interest_rate: '10',  // Current Vic penalty interest rate — check Vic AG website
}

// Resolve effective company config: caller-provided wins; placeholders fill gaps.
// Also accepts both `account_number` (snake_case, from platform_settings) and
// `accountNumber` (camelCase, legacy) for backward compatibility.
function resolveCompany(supplied) {
  const c = supplied || {}
  return {
    name: c.name || PLACEHOLDER_COMPANY.name,
    abn: c.abn || PLACEHOLDER_COMPANY.abn,
    acn: c.acn || PLACEHOLDER_COMPANY.acn,
    address: c.address || PLACEHOLDER_COMPANY.address,
    phone: c.phone || PLACEHOLDER_COMPANY.phone,
    email: c.email || PLACEHOLDER_COMPANY.email,
    bsb: c.bsb || PLACEHOLDER_COMPANY.bsb,
    accountNumber: c.account_number || c.accountNumber || PLACEHOLDER_COMPANY.account_number,
    penaltyInterestRate: c.penalty_interest_rate || c.penaltyInterestRate || PLACEHOLDER_COMPANY.penalty_interest_rate,
    // logo_url is optional. When set, the HTML letter renders it as the
    // letterhead mark; when absent, a "Insert your logo here" placeholder
    // appears instead. There is intentionally NO placeholder fallback for
    // logo_url — we want the placeholder UI to be visible to the bookkeeper
    // until a real logo has been uploaded via Settings → Company Identity.
    logoUrl: c.logo_url || c.logoUrl || '',
  }
}

const fmtDate = d => new Date(d||Date.now()).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})
const fmtAmt = v => `$${parseFloat(v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`

// ── Account Terms & Conditions ────────────────────────────────────────────────

export function generateAccountContract(customer, guarantor, company) {
  const COMPANY = resolveCompany(company)
  const date = fmtDate()
  const terms = customer?.payment_terms_days || 14
  const limit = customer?.credit_limit > 0 ? fmtAmt(customer.credit_limit) : 'As approved in writing'

  return `ACCOUNT TERMS AND CONDITIONS
CREDIT ACCOUNT AGREEMENT

${COMPANY.name} (ABN ${COMPANY.abn}) ("Binned-IT")
${COMPANY.address}

ACCOUNT HOLDER: ${customer?.name || '________________________'}
ABN: ${customer?.abn || '________________________'}
ACN: ${customer?.acn || '________________________'}
ADDRESS: ${customer?.address || '________________________'}, ${customer?.suburb || '________'} VIC ${customer?.postcode || '____'}
DATE: ${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CREDIT TERMS
   1.1 Approved Credit Limit: ${limit}
   1.2 Payment Terms: Net ${terms} days from invoice date
   1.3 All invoices are due and payable on or before the due date shown.
   1.4 Binned-IT reserves the right to vary payment terms or credit limits at any time by written notice.

2. PAYMENT
   2.1 Payment must be made by EFT to:
       Account Name: ${COMPANY.name}
       BSB: ${COMPANY.bsb}
       Account Number: ${COMPANY.accountNumber}
       Reference: Invoice Number
   2.2 GST at 10% applies to all supplies unless otherwise stated.
   2.3 Accounts outstanding beyond the agreed payment terms incur interest at ${COMPANY.penaltyInterestRate}% per annum, calculated daily, pursuant to the Penalty Interest Rates Act 1983 (Vic).

3. COLLECTION COSTS
   3.1 The Account Holder agrees to indemnify Binned-IT for all reasonable costs (including legal costs on a solicitor-client basis) incurred in recovering any outstanding amounts.
   3.2 Dishonoured payments incur a $45 fee.

4. SECURITY INTEREST — PERSONAL PROPERTY SECURITIES ACT 2009 (CTH)
   4.1 The Account Holder grants Binned-IT a security interest in all present and after-acquired property of the Account Holder in connection with any supply of goods or services.
   4.2 The Account Holder consents to Binned-IT registering any security interest on the Personal Property Securities Register (PPSR).
   4.3 The Account Holder must not grant any security over the collateral without Binned-IT's prior written consent.
   4.4 The Account Holder waives the right to receive a verification statement under section 157 of the Personal Property Securities Act 2009 (Cth).

5. TITLE AND RISK
   5.1 Title in any goods supplied by Binned-IT (including skip bins) does not pass to the Account Holder until payment is received in full.
   5.2 Risk passes to the Account Holder on delivery.

6. PRIVACY
   6.1 The Account Holder consents to Binned-IT collecting, using and disclosing personal and credit information for the purposes of:
       (a) assessing this credit application;
       (b) managing the account;
       (c) reporting to credit reporting agencies (including CreditorWatch) in the event of default;
       (d) enforcing any security interests.

7. DEFAULT
   7.1 An Account Holder is in default if they fail to pay any amount by the due date or breach any term of this Agreement.
   7.2 On default, all outstanding amounts become immediately due and payable.
   7.3 Binned-IT may suspend or cancel the account, recover possession of any goods, and enforce any security interest.

8. JURISDICTION
   8.1 This Agreement is governed by the laws of Victoria and the Commonwealth of Australia.
   8.2 The parties submit to the exclusive jurisdiction of the courts of Victoria.

9. ENTIRE AGREEMENT
   9.1 This Agreement constitutes the entire agreement between the parties in relation to the subject matter.
   9.2 No variation is effective unless in writing signed by an authorised representative of Binned-IT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION

Signed for and on behalf of ${customer?.name || '________________________'}:

Name:    _______________________________
Title:   _______________________________
Date:    _______________________________
Signature: _____________________________

Witnessed by:
Name:    _______________________________
Date:    _______________________________
Signature: _____________________________


For and on behalf of ${COMPANY.name}:

Name:    Mark Beddoe
Title:   Director
Date:    ${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTE: This document should be retained in a safe place. By accepting goods or services from Binned-IT on account after the date of this agreement, the Account Holder is deemed to have accepted these terms.

For enquiries: ${COMPANY.email} | ${COMPANY.phone}
`
}

// ── Director's Personal Guarantee ─────────────────────────────────────────────

export function generateDirectorGuarantee(customer, guarantor, company) {
  const COMPANY = resolveCompany(company)
  const date = fmtDate()
  const limit = customer?.credit_limit > 0 ? fmtAmt(customer.credit_limit) : 'all moneys now or in the future owed'

  return `DIRECTOR'S PERSONAL GUARANTEE AND INDEMNITY

THIS DEED OF GUARANTEE AND INDEMNITY is made on ${date}

BETWEEN:

CREDITOR:   ${COMPANY.name} (ABN ${COMPANY.abn})
            ${COMPANY.address} ("Binned-IT")

GUARANTOR:  ${guarantor?.name || '________________________'}
            ${guarantor?.address || '________________________'}, ${guarantor?.suburb || '________'} ${guarantor?.state || 'VIC'} ${guarantor?.postcode || '____'}
            Date of Birth: ${guarantor?.dob || '________________________'}

PRINCIPAL:  ${customer?.name || '________________________'} (ABN ${customer?.abn || '____'})
            ${customer?.address || '________________________'}, ${customer?.suburb || '________'} VIC ${customer?.postcode || '____'}
            ("the Company")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKGROUND

A. Binned-IT has agreed to supply goods and services to the Company on credit terms.
B. Binned-IT requires this guarantee as a condition of providing credit to the Company.
C. The Guarantor is a director and/or beneficial owner of the Company and will benefit from the credit extended.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IT IS AGREED as follows:

1. GUARANTEE
   1.1 In consideration of Binned-IT agreeing to supply goods and services to the Company, the Guarantor unconditionally and irrevocably guarantees to Binned-IT the due and punctual payment of ${limit} ("the Guaranteed Money") by the Company.
   1.2 The Guarantor's liability is as principal debtor and not merely as surety.
   1.3 If the Company fails to pay any amount when due, the Guarantor must pay that amount to Binned-IT on demand.

2. INDEMNITY
   2.1 The Guarantor indemnifies Binned-IT against any loss, damage, cost or expense (including legal costs on a solicitor-client basis) arising from or connected with any failure by the Company to perform its obligations to Binned-IT.

3. EXTENT OF LIABILITY
   3.1 This guarantee is a continuing guarantee and covers all present and future indebtedness of the Company to Binned-IT.
   3.2 The Guarantor's liability is not affected by:
       (a) any variation, waiver or amendment to the credit terms with the Company;
       (b) any failure by Binned-IT to enforce its rights against the Company;
       (c) the insolvency, liquidation or winding up of the Company;
       (d) any other guarantee or security held by Binned-IT;
       (e) the death, incapacity or bankruptcy of any other guarantor.

4. INDEPENDENT OBLIGATION
   4.1 This guarantee is independent of and in addition to any other security held by Binned-IT.
   4.2 Binned-IT may enforce this guarantee without first proceeding against the Company or exhausting any other remedy.

5. ASSIGNMENT
   5.1 Binned-IT may assign the benefit of this guarantee to any person who acquires the business of Binned-IT without the consent of the Guarantor.

6. COSTS
   6.1 The Guarantor agrees to pay all costs and disbursements (including legal costs on a solicitor-client basis) incurred by Binned-IT in enforcing this guarantee.

7. INTEREST
   7.1 Interest accrues on any amount unpaid under this guarantee at ${COMPANY.penaltyInterestRate}% per annum, calculated daily from the date of demand.

8. REVOCATION
   8.1 This guarantee may only be revoked by the Guarantor giving 30 days' prior written notice to Binned-IT. Revocation does not affect liability for amounts incurred before the effective date of revocation.

9. GOVERNING LAW
   9.1 This Deed is governed by the laws of Victoria, Australia.
   9.2 The Guarantor submits to the exclusive jurisdiction of the courts of Victoria.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION AS A DEED

SIGNED, SEALED AND DELIVERED by the Guarantor in the presence of a witness:

GUARANTOR

Full Name:   ${guarantor?.name || '________________________'}
Address:     ${guarantor?.address || '________________________'}
Signature:   _______________________________
Date:        _______________________________

WITNESS (must not be a party to this Deed)

Full Name:   _______________________________
Address:     _______________________________
Signature:   _______________________________
Date:        _______________________________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT NOTICE TO THE GUARANTOR:
You should seek independent legal advice before signing this guarantee.
This is a legally binding document. By signing, you accept personal liability for the debts of ${customer?.name || 'the Company'}.
`
}

// ── Collections Letters ───────────────────────────────────────────────────────

export function generateCollectionsLetter(level, invoice, customer, contact, company) {
  const COMPANY = resolveCompany(company)
  const today = fmtDate()
  const contactName = contact?.name || customer?.name || 'Sir/Madam'
  const invNum = invoice?.invoice_number || 'MULTIPLE'
  const amount = fmtAmt(invoice?.total || 0)
  const dueDate = invoice?.due_date ? fmtDate(invoice.due_date) : '—'
  const daysOverdue = invoice?.daysOverdue || 0
  const interestAmt = fmtAmt((parseFloat(invoice?.total||0) * (parseFloat(COMPANY.penaltyInterestRate)/100) * daysOverdue/365))
  const totalDue = fmtAmt(parseFloat(invoice?.total||0) + parseFloat((parseFloat(invoice?.total||0) * (parseFloat(COMPANY.penaltyInterestRate)/100) * daysOverdue/365)))
  const deadline7 = fmtDate(new Date(Date.now() + 7*86400000))
  const deadline5 = fmtDate(new Date(Date.now() + 5*86400000))

  if (level === 1) return `${today}

${customer?.name || '________________________'}
${customer?.address || '________________________'}, ${customer?.suburb || ''} VIC ${customer?.postcode || ''}

Dear ${contactName},

RE: OVERDUE ACCOUNT — Invoice ${invNum} — ${amount} — DUE ${dueDate}

We refer to the above invoice which was due for payment on ${dueDate} and remains outstanding.

We kindly request that you arrange payment of ${amount} (including GST) immediately.

If you have already arranged payment, please disregard this notice and accept our thanks.

Payment may be made by EFT to:
  Account Name: ${COMPANY.name}
  BSB: ${COMPANY.bsb}  |  Account Number: ${COMPANY.accountNumber}
  Reference: ${invNum}

Should you have any queries, please contact our accounts team on ${COMPANY.phone} or ${COMPANY.email}.

Yours sincerely,

Accounts Receivable
${COMPANY.name}  |  ABN ${COMPANY.abn}
${COMPANY.phone}  |  ${COMPANY.email}`

  if (level === 2) return `${today}

FORMAL NOTICE OF OVERDUE ACCOUNT

${customer?.name || '________________________'}
${customer?.address || '________________________'}, ${customer?.suburb || ''} VIC ${customer?.postcode || ''}

Dear ${contactName},

RE: FORMAL NOTICE — Invoice ${invNum} — ${amount} — ${daysOverdue} DAYS OVERDUE

We write to formally advise that the above-referenced invoice remains outstanding, now ${daysOverdue} days past the agreed payment terms.

OUTSTANDING AMOUNT:   ${amount}
ORIGINAL DUE DATE:    ${dueDate}
DAYS OVERDUE:         ${daysOverdue} days
INTEREST ACCRUING:    ${COMPANY.penaltyInterestRate}% per annum (Penalty Interest Rates Act 1983 (Vic))
INTEREST TO DATE:     ${interestAmt}
TOTAL NOW DUE:        ${totalDue}

Despite our earlier communications, we have not received payment. Please note the following:

1. Interest is accruing on the outstanding amount at ${COMPANY.penaltyInterestRate}% per annum, calculated daily, from the original due date of ${dueDate} pursuant to the Penalty Interest Rates Act 1983 (Vic).

2. If payment of ${totalDue} is not received by ${deadline5}, this matter will be referred to our collections and legal representatives WITHOUT FURTHER NOTICE.

3. Any costs associated with recovery of this debt, including debt collection agency fees and legal costs, will be added to the outstanding amount and claimed against you.

We urge you to contact our accounts team immediately on ${COMPANY.phone} or ${COMPANY.email} to make payment or discuss a payment arrangement.

Yours faithfully,

Accounts Receivable Manager
${COMPANY.name}  |  ABN ${COMPANY.abn}
${COMPANY.phone}  |  ${COMPANY.email}
${COMPANY.address}`

  if (level === 3) return `${today}

LETTER OF DEMAND

BY EMAIL AND REGISTERED POST

${customer?.name || '________________________'}
${customer?.address || '________________________'}, ${customer?.suburb || ''} VIC ${customer?.postcode || ''}
ABN: ${customer?.abn || '________________________'}

Dear ${contactName},

RE: DEMAND FOR PAYMENT — ${totalDue} OUTSTANDING — Invoice ${invNum}

We act on behalf of ${COMPANY.name} (ABN ${COMPANY.abn}) in relation to the recovery of monies owed.

AMOUNT ORIGINALLY OUTSTANDING:    ${amount}
INTEREST ACCRUED (${daysOverdue} DAYS):  ${interestAmt}
TOTAL AMOUNT NOW DEMANDED:        ${totalDue}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORMAL DEMAND FOR PAYMENT

We hereby DEMAND that you pay the sum of ${totalDue} to ${COMPANY.name} within SEVEN (7) DAYS of the date of this letter.

BASIS OF CLAIM

${COMPANY.name} provided skip bin hire and waste management services to ${customer?.name||'you'} pursuant to a commercial agreement. Invoice ${invNum} dated ${dueDate} for ${amount} was issued for those services and has not been paid despite the invoice falling due on ${dueDate} and repeated requests for payment.

CONSEQUENCES OF NON-PAYMENT

If payment of ${totalDue} is not received within 7 days, ${COMPANY.name} will, without further notice:

1. COMMENCE LEGAL PROCEEDINGS against you in the Magistrates' Court of Victoria (for amounts up to $100,000) or the County Court of Victoria (for amounts exceeding $100,000) to recover the outstanding debt, plus interest and legal costs on a solicitor-client basis;

2. REGISTER A SECURITY INTEREST over your assets and personal property on the Personal Property Securities Register (PPSR) under the Personal Property Securities Act 2009 (Cth);

3. REPORT THIS DEFAULT to CreditorWatch and other commercial credit reporting agencies, which will adversely affect your commercial credit rating and ability to obtain trade credit from other suppliers.

INTEREST

Interest continues to accrue at ${COMPANY.penaltyInterestRate}% per annum pursuant to the Penalty Interest Rates Act 1983 (Vic) until the date of payment in full.

COSTS

Should legal proceedings be commenced, ${COMPANY.name} will seek recovery of all legal costs on a solicitor-client basis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To avoid legal proceedings, payment of ${totalDue} must be received by ${deadline7}.

If you are experiencing financial difficulty, you must contact us IMMEDIATELY on ${COMPANY.phone} or ${COMPANY.email} to discuss a payment arrangement.

Yours faithfully,

Accounts & Legal
${COMPANY.name}  |  ABN ${COMPANY.abn}
${COMPANY.address}
${COMPANY.phone}  |  ${COMPANY.email}`

  // Level 4 — Statutory Demand / Wind-up Warning
  return `${today}

NOTICE OF INTENT TO SERVE STATUTORY DEMAND AND COMMENCE WINDING-UP PROCEEDINGS

⚠ URGENT — REQUIRES IMMEDIATE ATTENTION ⚠

${customer?.name || '________________________'}
${customer?.address || '________________________'}, ${customer?.suburb || ''} VIC ${customer?.postcode || ''}
ABN: ${customer?.abn || '________________________'}
ACN: ${customer?.acn || '________________________'}

Dear ${contactName},

RE: STATUTORY DEMAND — DEBT OWED TO ${COMPANY.name.toUpperCase()} — ${totalDue} — ${daysOverdue} DAYS OVERDUE

We write to formally notify you of ${COMPANY.name}'s intention to take the following actions in relation to the outstanding debt described below, unless full payment is received immediately.

OUTSTANDING DEBT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━
Invoice Number:           ${invNum}
Original Amount:          ${amount}
Interest Accrued:         ${interestAmt} (${COMPANY.penaltyInterestRate}% p.a. × ${daysOverdue} days)
TOTAL DEBT DEMANDED:      ${totalDue}
Original Due Date:        ${dueDate}
Days Overdue:             ${daysOverdue} days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. STATUTORY DEMAND — CORPORATIONS ACT 2001 (CTH) s.459E

Pursuant to section 459E of the Corporations Act 2001 (Cth), ${COMPANY.name} intends to serve a formal Statutory Demand on ${customer?.name||'your company'} within 5 business days of this notice, unless full payment is received.

Upon service of the Statutory Demand, you will have TWENTY-ONE (21) DAYS to:
   (a) Pay the full amount demanded; OR
   (b) Apply to the Court to set aside the Statutory Demand under s.459G of the Corporations Act 2001 (Cth).

WARNING: An application to set aside must be made within 21 days of service. This deadline is strictly enforced.

2. PRESUMPTION OF INSOLVENCY AND WINDING-UP APPLICATION

Failure to comply with a Statutory Demand within 21 days creates a statutory presumption of insolvency under section 459C(2)(a) of the Corporations Act 2001 (Cth).

${COMPANY.name} will then apply to the Federal Court or Supreme Court of Victoria under section 459P of the Corporations Act 2001 (Cth) for an order that ${customer?.name||'your company'} be WOUND UP IN INSOLVENCY.

A winding-up order will result in:
   • Appointment of a liquidator to take control of the company's assets;
   • Immediate cessation of all business operations;
   • Investigation of directors' conduct and transactions;
   • Potential personal liability for directors for insolvent trading under s.588G of the Corporations Act 2001 (Cth);
   • Adverse reporting to ASIC and all major commercial credit agencies.

3. PERSONAL LIABILITY OF DIRECTORS

We draw your attention to section 588G of the Corporations Act 2001 (Cth). Where a director knows, or ought to know, that the company is unable to pay its debts as and when they fall due, the director incurs personal liability for all debts incurred from that date.

If you or your company is experiencing financial difficulty, you should seek immediate legal and financial advice.

4. ADDITIONAL ACTIONS

${COMPANY.name} further reserves the right to:
   (a) Register security interests against the company's assets on the PPSR under the Personal Property Securities Act 2009 (Cth);
   (b) Enforce any Director's Personal Guarantee(s) executed in favour of ${COMPANY.name};
   (c) Report this default to CreditorWatch and all commercial credit reporting agencies;
   (d) Pursue any guarantors personally for the full amount outstanding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAYMENT REQUIRED WITHIN 7 DAYS

To avoid these consequences, payment of ${totalDue} must be received by ${deadline7}.

If you wish to dispute this debt, you must notify us in writing with full particulars of the dispute within 7 days of this notice.

If you wish to discuss a payment arrangement, you must contact us within 48 HOURS. Any arrangement must be agreed in writing.

PAYMENT DETAILS:
  ${COMPANY.name}  |  BSB: ${COMPANY.bsb}  |  Account: ${COMPANY.accountNumber}
  Reference: ${invNum}

Contact immediately: ${COMPANY.phone} | ${COMPANY.email}

Yours faithfully,

Accounts & Legal
${COMPANY.name}  |  ABN ${COMPANY.abn}
${COMPANY.address}
${COMPANY.phone}  |  ${COMPANY.email}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: You should seek independent legal advice immediately.
This notice is a formal legal document. The matters described will proceed as stated if payment is not received.`
}

// ── Security Over Assets Letter ───────────────────────────────────────────────

export function generateSecurityOverAssetsLetter(customer, creditLimit, company) {
  const COMPANY = resolveCompany(company)
  const date = fmtDate()
  const limit = fmtAmt(creditLimit || customer?.credit_limit || 0)

  return `${date}

NOTICE OF REQUIREMENT FOR SECURITY OVER ASSETS

${customer?.name || '________________________'}
${customer?.address || '________________________'}, ${customer?.suburb || ''} VIC ${customer?.postcode || ''}
ABN: ${customer?.abn || '________________________'}

Dear ${customer?.name || 'Sir/Madam'},

RE: CREDIT ACCOUNT — REQUIREMENT FOR SECURITY OVER ASSETS

We write to advise that, following a review of your account with ${COMPANY.name}, we require the provision of security over assets as a condition of continuing or extending your credit facility.

ACCOUNT DETAILS:
  Current Credit Limit: ${limit}
  Payment Terms: NET ${customer?.payment_terms_days || 14} days
  Outstanding Balance: ${fmtAmt(customer?.outstanding_balance || 0)}

WHY SECURITY IS REQUIRED

Based on our assessment, your account represents a significant credit exposure for ${COMPANY.name}. To protect our position and continue supplying on account, we require:

1. PPSR REGISTRATION
   ${COMPANY.name} will register a security interest over your present and after-acquired personal property on the Personal Property Securities Register (PPSR) under the Personal Property Securities Act 2009 (Cth). This registration protects our position in the event of insolvency.

2. DIRECTOR'S PERSONAL GUARANTEE
   We require a Director's Personal Guarantee in the form attached from all directors of ${customer?.name || 'your company'}.

3. [OPTIONAL] FIXED AND FLOATING CHARGE
   For accounts above $50,000, we may also require a fixed and floating charge over the assets of the business.

NEXT STEPS

Please arrange the following within 14 days:
   (a) Sign and return the enclosed Director's Personal Guarantee;
   (b) Provide a copy of a recent ASIC company extract;
   (c) Provide details of any existing charges or encumbrances over company assets;
   (d) Confirm your consent to PPSR registration.

Failure to provide the required security within 14 days may result in suspension of your credit account, with all future orders required on a cash-in-advance or COD basis.

If you have any questions or wish to discuss this requirement, please contact us immediately on ${COMPANY.phone} or ${COMPANY.email}.

Yours faithfully,

Mark Beddoe
Director
${COMPANY.name}  |  ABN ${COMPANY.abn}
${COMPANY.address}
${COMPANY.phone}  |  ${COMPANY.email}`
}

// ── HTML Collections Letter (Sprint 18 #L1) ───────────────────────────────────
// Returns a fully self-contained HTML document for a collections letter,
// styled with Montserrat (headings via Google Fonts) and Calibri (body) and
// laid out as a formal CFO-grade demand letter. Renders inside the
// LetterModal via dangerouslySetInnerHTML or an iframe srcDoc — both work
// because the <style> block is scoped inside a top-level wrapper class.
//
// Severity-aware visual treatment per level:
//   1 — Notice            light grey accents, friendly tone
//   2 — Formal Notice     amber accent strip down the left side
//   3 — Letter of Demand  red accent strip + "LEGAL DEMAND" header badge
//   4 — Statutory Demand  heavy black border + s459E caption + via-post badge
//
// Missing-data behaviour:
//   - logo_url empty            → dashed-border "Insert your logo here" placeholder
//   - customer.address empty    → "[Address withheld]"
//   - any field undefined       → falls back gracefully without throwing

// Tiny HTML escape — only handles the chars that can break out of attributes
// or open a tag. Good enough for invoice numbers / customer names; we are
// NOT building a sanitiser, just preventing accidental rendering glitches
// when a customer name happens to contain `<` or `&`.
function escHtml(v) {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Per-level visual config — single source of truth for the inline CSS.
// Each entry maps the abstract "severity" to concrete colours / labels
// that the template below interpolates into the markup.
const HTML_LEVEL_STYLE = {
  1: {
    label: 'OVERDUE NOTICE',
    salutation: 'Dear',
    closing: 'Yours sincerely,',
    accent: '#9CA3AF',           // neutral grey
    accentSoft: '#F3F4F6',
    badgeBg: '#F3F4F6',
    badgeFg: '#4B5563',
    headerCaption: '',
    pageBorder: '1px solid #E5E7EB',
    leftStripWidth: '4px',
    leftStripColor: '#9CA3AF',
    deliveryBadge: '',
  },
  2: {
    label: 'FORMAL NOTICE OF OVERDUE ACCOUNT',
    salutation: 'Dear',
    closing: 'Yours faithfully,',
    accent: '#D97706',           // amber
    accentSoft: '#FEF3C7',
    badgeBg: '#FEF3C7',
    badgeFg: '#92400E',
    headerCaption: '',
    pageBorder: '1px solid #FCD34D',
    leftStripWidth: '8px',
    leftStripColor: '#D97706',
    deliveryBadge: '',
  },
  3: {
    label: 'LETTER OF DEMAND',
    salutation: 'Dear',
    closing: 'Yours faithfully,',
    accent: '#B91C1C',           // red
    accentSoft: '#FEE2E2',
    badgeBg: '#B91C1C',
    badgeFg: '#FFFFFF',
    headerCaption: 'LEGAL DEMAND',
    pageBorder: '2px solid #B91C1C',
    leftStripWidth: '10px',
    leftStripColor: '#B91C1C',
    deliveryBadge: 'BY EMAIL AND REGISTERED POST',
  },
  4: {
    label: 'NOTICE OF INTENT TO SERVE STATUTORY DEMAND',
    salutation: 'Dear',
    closing: 'Yours faithfully,',
    accent: '#000000',           // heavy black
    accentSoft: '#F5F5F5',
    badgeBg: '#000000',
    badgeFg: '#FFFFFF',
    headerCaption: 'STATUTORY DEMAND UNDER s459E CORPORATIONS ACT 2001',
    pageBorder: '4px double #000000',
    leftStripWidth: '12px',
    leftStripColor: '#000000',
    deliveryBadge: 'VIA REGISTERED POST',
  },
}

// Build the body content unique to each level. Returns an HTML fragment
// (no <html>/<body>) that is interpolated into the page shell below.
function buildLevelBody(level, ctx) {
  const {
    COMPANY, customer, contactName, invNum, amount, dueDate, daysOverdue,
    interestAmt, totalDue, deadline7, deadline5,
  } = ctx

  if (level === 1) {
    return `
      <p>We refer to the above invoice which was due for payment on <strong>${escHtml(dueDate)}</strong> and remains outstanding.</p>
      <p>We kindly request that you arrange payment of <strong>${escHtml(amount)}</strong> (including GST) at your earliest convenience.</p>
      <p>If you have already arranged payment, please disregard this notice and accept our thanks.</p>
      <div class="ss-payment-box">
        <div class="ss-payment-title">Payment Details</div>
        <table class="ss-payment-table">
          <tbody>
            <tr><th>Account Name</th><td>${escHtml(COMPANY.name)}</td></tr>
            <tr><th>BSB</th><td>${escHtml(COMPANY.bsb)}</td></tr>
            <tr><th>Account Number</th><td>${escHtml(COMPANY.accountNumber)}</td></tr>
            <tr><th>Reference</th><td>${escHtml(invNum)}</td></tr>
          </tbody>
        </table>
      </div>
      <p>Should you have any queries, please contact our accounts team on
        <strong>${escHtml(COMPANY.phone)}</strong> or
        <strong>${escHtml(COMPANY.email)}</strong>.</p>
    `
  }

  if (level === 2) {
    return `
      <p>We write to formally advise that the above-referenced invoice remains outstanding,
        now <strong>${escHtml(daysOverdue)} days</strong> past the agreed payment terms.</p>
      <table class="ss-amount-table">
        <tbody>
          <tr><th>Outstanding Amount</th><td>${escHtml(amount)}</td></tr>
          <tr><th>Original Due Date</th><td>${escHtml(dueDate)}</td></tr>
          <tr><th>Days Overdue</th><td>${escHtml(daysOverdue)} days</td></tr>
          <tr><th>Interest Rate</th><td>${escHtml(COMPANY.penaltyInterestRate)}% per annum (Penalty Interest Rates Act 1983 (Vic))</td></tr>
          <tr><th>Interest Accrued</th><td>${escHtml(interestAmt)}</td></tr>
          <tr class="ss-row-total"><th>TOTAL NOW DUE</th><td>${escHtml(totalDue)}</td></tr>
        </tbody>
      </table>
      <p>Despite our earlier communications, we have not received payment. Please note the following:</p>
      <ol class="ss-clauses">
        <li>Interest is accruing on the outstanding amount at <strong>${escHtml(COMPANY.penaltyInterestRate)}% per annum</strong>, calculated daily, from the original due date of ${escHtml(dueDate)} pursuant to the Penalty Interest Rates Act 1983 (Vic).</li>
        <li>If payment of <strong>${escHtml(totalDue)}</strong> is not received by <strong>${escHtml(deadline5)}</strong>, this matter will be referred to our collections and legal representatives <strong>WITHOUT FURTHER NOTICE</strong>.</li>
        <li>Any costs associated with recovery of this debt, including debt collection agency fees and legal costs, will be added to the outstanding amount and claimed against you.</li>
      </ol>
      <p>We urge you to contact our accounts team immediately on
        <strong>${escHtml(COMPANY.phone)}</strong> or
        <strong>${escHtml(COMPANY.email)}</strong> to make payment or discuss a payment arrangement.</p>
    `
  }

  if (level === 3) {
    return `
      <p>We act on behalf of <strong>${escHtml(COMPANY.name)}</strong> (ABN ${escHtml(COMPANY.abn)}) in relation to the recovery of monies owed.</p>
      <table class="ss-amount-table">
        <tbody>
          <tr><th>Amount Originally Outstanding</th><td>${escHtml(amount)}</td></tr>
          <tr><th>Interest Accrued (${escHtml(daysOverdue)} days)</th><td>${escHtml(interestAmt)}</td></tr>
          <tr class="ss-row-total"><th>TOTAL AMOUNT NOW DEMANDED</th><td>${escHtml(totalDue)}</td></tr>
        </tbody>
      </table>
      <h2 class="ss-section-title">Formal Demand for Payment</h2>
      <p>We hereby <strong>DEMAND</strong> that you pay the sum of <strong>${escHtml(totalDue)}</strong>
        to ${escHtml(COMPANY.name)} within <strong>SEVEN (7) DAYS</strong> of the date of this letter.</p>
      <h2 class="ss-section-title">Basis of Claim</h2>
      <p>${escHtml(COMPANY.name)} provided skip bin hire and waste management services to ${escHtml(customer?.name || 'you')} pursuant to a commercial agreement.
        Invoice ${escHtml(invNum)} dated ${escHtml(dueDate)} for ${escHtml(amount)} was issued for those services and has not been paid despite the invoice falling due on ${escHtml(dueDate)} and repeated requests for payment.</p>
      <h2 class="ss-section-title">Consequences of Non-Payment</h2>
      <p>If payment of <strong>${escHtml(totalDue)}</strong> is not received within 7 days, ${escHtml(COMPANY.name)} will, without further notice:</p>
      <ol class="ss-clauses">
        <li><strong>Commence legal proceedings</strong> against you in the Magistrates' Court of Victoria (for amounts up to $100,000) or the County Court of Victoria (for amounts exceeding $100,000) to recover the outstanding debt, plus interest and legal costs on a solicitor-client basis;</li>
        <li><strong>Register a security interest</strong> over your assets and personal property on the Personal Property Securities Register (PPSR) under the Personal Property Securities Act 2009 (Cth);</li>
        <li><strong>Report this default</strong> to CreditorWatch and other commercial credit reporting agencies, which will adversely affect your commercial credit rating and ability to obtain trade credit from other suppliers.</li>
      </ol>
      <h2 class="ss-section-title">Interest &amp; Costs</h2>
      <p>Interest continues to accrue at <strong>${escHtml(COMPANY.penaltyInterestRate)}% per annum</strong> pursuant to the Penalty Interest Rates Act 1983 (Vic) until the date of payment in full. Should legal proceedings be commenced, ${escHtml(COMPANY.name)} will seek recovery of all legal costs on a solicitor-client basis.</p>
      <p>To avoid legal proceedings, payment of <strong>${escHtml(totalDue)}</strong> must be received by <strong>${escHtml(deadline7)}</strong>.</p>
      <p>If you are experiencing financial difficulty, you must contact us <strong>immediately</strong> on
        ${escHtml(COMPANY.phone)} or ${escHtml(COMPANY.email)} to discuss a payment arrangement.</p>
    `
  }

  // Level 4 — Statutory Demand / Wind-up Warning
  return `
    <p class="ss-urgent">URGENT — REQUIRES IMMEDIATE ATTENTION</p>
    <p>We write to formally notify you of <strong>${escHtml(COMPANY.name)}</strong>'s intention to take the following actions
      in relation to the outstanding debt described below, unless full payment is received immediately.</p>
    <h2 class="ss-section-title">Outstanding Debt Summary</h2>
    <table class="ss-amount-table">
      <tbody>
        <tr><th>Invoice Number</th><td>${escHtml(invNum)}</td></tr>
        <tr><th>Original Amount</th><td>${escHtml(amount)}</td></tr>
        <tr><th>Interest Accrued (${escHtml(COMPANY.penaltyInterestRate)}% p.a. × ${escHtml(daysOverdue)} days)</th><td>${escHtml(interestAmt)}</td></tr>
        <tr><th>Original Due Date</th><td>${escHtml(dueDate)}</td></tr>
        <tr><th>Days Overdue</th><td>${escHtml(daysOverdue)} days</td></tr>
        <tr class="ss-row-total"><th>TOTAL DEBT DEMANDED</th><td>${escHtml(totalDue)}</td></tr>
      </tbody>
    </table>
    <h2 class="ss-section-title">1. Statutory Demand — Corporations Act 2001 (Cth) s.459E</h2>
    <p>Pursuant to section 459E of the Corporations Act 2001 (Cth), ${escHtml(COMPANY.name)} intends to serve a formal Statutory Demand on ${escHtml(customer?.name || 'your company')} within 5 business days of this notice, unless full payment is received.</p>
    <p>Upon service of the Statutory Demand, you will have <strong>TWENTY-ONE (21) DAYS</strong> to:</p>
    <ol class="ss-clauses">
      <li>Pay the full amount demanded; <strong>OR</strong></li>
      <li>Apply to the Court to set aside the Statutory Demand under s.459G of the Corporations Act 2001 (Cth).</li>
    </ol>
    <p class="ss-warning"><strong>WARNING:</strong> An application to set aside must be made within 21 days of service. This deadline is strictly enforced.</p>
    <h2 class="ss-section-title">2. Presumption of Insolvency &amp; Winding-up Application</h2>
    <p>Failure to comply with a Statutory Demand within 21 days creates a statutory presumption of insolvency under section 459C(2)(a) of the Corporations Act 2001 (Cth).</p>
    <p>${escHtml(COMPANY.name)} will then apply to the Federal Court or Supreme Court of Victoria under section 459P of the Corporations Act 2001 (Cth) for an order that ${escHtml(customer?.name || 'your company')} be <strong>WOUND UP IN INSOLVENCY</strong>.</p>
    <p>A winding-up order will result in:</p>
    <ol class="ss-clauses">
      <li>Appointment of a liquidator to take control of the company's assets;</li>
      <li>Immediate cessation of all business operations;</li>
      <li>Investigation of directors' conduct and transactions;</li>
      <li>Potential personal liability for directors for insolvent trading under s.588G of the Corporations Act 2001 (Cth);</li>
      <li>Adverse reporting to ASIC and all major commercial credit agencies.</li>
    </ol>
    <h2 class="ss-section-title">3. Personal Liability of Directors</h2>
    <p>We draw your attention to section 588G of the Corporations Act 2001 (Cth). Where a director knows, or ought to know, that the company is unable to pay its debts as and when they fall due, the director incurs personal liability for all debts incurred from that date.</p>
    <p>If you or your company is experiencing financial difficulty, you should seek immediate legal and financial advice.</p>
    <h2 class="ss-section-title">4. Additional Actions</h2>
    <p>${escHtml(COMPANY.name)} further reserves the right to:</p>
    <ol class="ss-clauses">
      <li>Register security interests against the company's assets on the PPSR under the Personal Property Securities Act 2009 (Cth);</li>
      <li>Enforce any Director's Personal Guarantee(s) executed in favour of ${escHtml(COMPANY.name)};</li>
      <li>Report this default to CreditorWatch and all commercial credit reporting agencies;</li>
      <li>Pursue any guarantors personally for the full amount outstanding.</li>
    </ol>
    <h2 class="ss-section-title">Payment Required Within 7 Days</h2>
    <p>To avoid these consequences, payment of <strong>${escHtml(totalDue)}</strong> must be received by
      <strong>${escHtml(deadline7)}</strong>.</p>
    <p>If you wish to dispute this debt, you must notify us in writing with full particulars of the dispute within 7 days of this notice. If you wish to discuss a payment arrangement, you must contact us within <strong>48 hours</strong>. Any arrangement must be agreed in writing.</p>
    <div class="ss-payment-box">
      <div class="ss-payment-title">Payment Details</div>
      <table class="ss-payment-table">
        <tbody>
          <tr><th>Account Name</th><td>${escHtml(COMPANY.name)}</td></tr>
          <tr><th>BSB</th><td>${escHtml(COMPANY.bsb)}</td></tr>
          <tr><th>Account Number</th><td>${escHtml(COMPANY.accountNumber)}</td></tr>
          <tr><th>Reference</th><td>${escHtml(invNum)}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="ss-final-warning"><strong>IMPORTANT:</strong> You should seek independent legal advice immediately. This notice is a formal legal document. The matters described will proceed as stated if payment is not received.</p>
  `
}

export function generateCollectionsLetterHTML(level, invoice, customer, contact, company) {
  const COMPANY = resolveCompany(company)
  const today = fmtDate()
  const contactName = contact?.name || customer?.name || 'Sir/Madam'
  const invNum = invoice?.invoice_number || 'MULTIPLE'
  const amount = fmtAmt(invoice?.total || 0)
  const dueDate = invoice?.due_date ? fmtDate(invoice.due_date) : '—'
  const daysOverdue = invoice?.daysOverdue || 0
  const interestAmt = fmtAmt((parseFloat(invoice?.total || 0) * (parseFloat(COMPANY.penaltyInterestRate) / 100) * daysOverdue / 365))
  const totalDue = fmtAmt(parseFloat(invoice?.total || 0) + parseFloat((parseFloat(invoice?.total || 0) * (parseFloat(COMPANY.penaltyInterestRate) / 100) * daysOverdue / 365)))
  const deadline7 = fmtDate(new Date(Date.now() + 7 * 86400000))
  const deadline5 = fmtDate(new Date(Date.now() + 5 * 86400000))

  // Resolve severity styling — default to level 1 if an unexpected value
  // arrives. Letters are rarely level 0 in production but we shouldn't crash.
  const severityLevel = (level >= 1 && level <= 4) ? level : 1
  const sev = HTML_LEVEL_STYLE[severityLevel]

  // Customer address — gracefully handle the case where address fields are blank.
  const addressLine = (() => {
    const parts = [
      customer?.address,
      [customer?.suburb, 'VIC', customer?.postcode].filter(Boolean).join(' '),
    ].filter(Boolean)
    if (parts.length === 0 || (!customer?.address && !customer?.suburb && !customer?.postcode)) {
      return '[Address withheld]'
    }
    return parts.join(', ')
  })()

  // Logo — render either the supplied image or a dashed-border placeholder
  // that explicitly tells the bookkeeper how to fix it.
  const logoHtml = COMPANY.logoUrl
    ? `<img class="ss-logo" src="${escHtml(COMPANY.logoUrl)}" alt="${escHtml(COMPANY.name)} logo" />`
    : `<div class="ss-logo-placeholder" data-testid="logo-placeholder">
         <div class="ss-logo-placeholder-title">Insert your logo here</div>
         <div class="ss-logo-placeholder-sub">Upload via Settings → Company Identity</div>
       </div>`

  const headerCaption = sev.headerCaption
    ? `<div class="ss-header-badge">${escHtml(sev.headerCaption)}</div>`
    : ''
  const deliveryBadge = sev.deliveryBadge
    ? `<div class="ss-delivery-badge">${escHtml(sev.deliveryBadge)}</div>`
    : ''

  const bodyContent = buildLevelBody(severityLevel, {
    COMPANY, customer, contactName, invNum, amount, dueDate, daysOverdue,
    interestAmt, totalDue, deadline7, deadline5,
  })

  // Recipient ABN line — only emit if we actually have one (avoid "ABN: ___").
  const recipientAbn = customer?.abn
    ? `<div class="ss-recipient-line">ABN ${escHtml(customer.abn)}</div>`
    : ''
  const recipientAcn = (severityLevel === 4 && customer?.acn)
    ? `<div class="ss-recipient-line">ACN ${escHtml(customer.acn)}</div>`
    : ''

  // Subject line varies slightly by level — keep "RE:" prefix uniform.
  const subjectByLevel = {
    1: `OVERDUE ACCOUNT — Invoice ${invNum} — ${amount} — DUE ${dueDate}`,
    2: `FORMAL NOTICE — Invoice ${invNum} — ${amount} — ${daysOverdue} DAYS OVERDUE`,
    3: `DEMAND FOR PAYMENT — ${totalDue} OUTSTANDING — Invoice ${invNum}`,
    4: `STATUTORY DEMAND — ${totalDue} — ${daysOverdue} DAYS OVERDUE`,
  }
  const subject = subjectByLevel[severityLevel]

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escHtml(sev.label)} — ${escHtml(invNum)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* Reset just enough to look identical inside an iframe or innerHTML mount */
  .ss-letter * { box-sizing: border-box; }
  .ss-letter { font-family: Calibri, Helvetica, Arial, sans-serif; color: #111; line-height: 1.4; font-size: 11pt; }
  .ss-letter h1, .ss-letter h2, .ss-letter h3, .ss-letter .ss-head {
    font-family: 'Montserrat', Calibri, Helvetica, Arial, sans-serif;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  /* Page wrapper — A4-ish width, with severity-aware border */
  .ss-page {
    max-width: 780px;
    margin: 0 auto;
    background: #fff;
    padding: 36px 44px 44px;
    border: ${sev.pageBorder};
    border-left: ${sev.leftStripWidth} solid ${sev.leftStripColor};
    position: relative;
  }

  /* Letterhead — logo left, company block right */
  .ss-letterhead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 1px solid #E5E7EB;
    padding-bottom: 18px;
    margin-bottom: 22px;
  }
  .ss-logo { max-width: 180px; max-height: 80px; object-fit: contain; }
  .ss-logo-placeholder {
    width: 180px; height: 80px; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    border: 2px dashed #9CA3AF; border-radius: 8px;
    color: #6B7280; text-align: center;
    background: repeating-linear-gradient(45deg, transparent, transparent 6px, #F3F4F6 6px, #F3F4F6 12px);
  }
  .ss-logo-placeholder-title {
    font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 11pt;
    color: #4B5563;
  }
  .ss-logo-placeholder-sub { font-size: 8.5pt; margin-top: 4px; color: #6B7280; }
  .ss-company {
    text-align: right; font-size: 10pt; color: #374151; line-height: 1.45;
  }
  .ss-company-name {
    font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 13pt;
    color: ${sev.accent}; margin-bottom: 2px;
  }

  /* Severity badge ribbon — only rendered for level 3/4 */
  .ss-header-badge {
    background: ${sev.badgeBg}; color: ${sev.badgeFg};
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    font-size: 10pt; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 8px 14px; border-radius: 4px; display: inline-block;
    margin-bottom: 14px;
  }
  .ss-delivery-badge {
    border: 1.5px solid ${sev.accent}; color: ${sev.accent};
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    font-size: 9pt; letter-spacing: 0.10em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 3px; display: inline-block;
    margin-bottom: 14px; margin-left: 8px;
  }

  /* Recipient + date block */
  .ss-recipient {
    margin-bottom: 18px; font-size: 10.5pt; line-height: 1.5;
  }
  .ss-recipient-name { font-weight: 700; }
  .ss-recipient-line { color: #374151; }
  .ss-date { color: #4B5563; margin-top: 12px; font-style: italic; }

  /* Subject + heading */
  .ss-letter-title {
    font-family: 'Montserrat', sans-serif; font-weight: 800;
    font-size: 14pt; text-transform: uppercase; letter-spacing: 0.04em;
    color: ${sev.accent}; margin: 4px 0 16px; line-height: 1.25;
  }
  .ss-subject {
    background: ${sev.accentSoft}; border-left: 4px solid ${sev.accent};
    padding: 10px 14px; margin: 14px 0 22px;
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    font-size: 10.5pt; letter-spacing: 0.02em; color: #111;
  }
  .ss-subject-label { color: ${sev.accent}; margin-right: 6px; }

  /* Body */
  .ss-body p { margin: 0 0 12px; text-align: justify; }
  .ss-body strong { color: #111; }
  .ss-section-title {
    font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.05em;
    margin: 22px 0 10px; color: ${sev.accent};
  }
  .ss-clauses { margin: 0 0 14px 0; padding-left: 22px; }
  .ss-clauses li { margin-bottom: 8px; text-align: justify; }

  /* Tables */
  .ss-amount-table, .ss-payment-table {
    width: 100%; border-collapse: collapse; margin: 12px 0 18px;
    font-size: 10.5pt;
  }
  .ss-amount-table th, .ss-amount-table td,
  .ss-payment-table th, .ss-payment-table td {
    padding: 8px 12px; text-align: left;
    border-bottom: 1px solid #E5E7EB;
  }
  .ss-amount-table th { width: 48%; color: #4B5563; font-weight: 600; font-family: 'Montserrat', sans-serif; }
  .ss-amount-table td { font-family: 'Calibri', Helvetica, Arial, sans-serif; font-weight: 600; }
  .ss-row-total th, .ss-row-total td {
    background: ${sev.accentSoft}; color: ${sev.accent};
    font-weight: 700; font-size: 11.5pt; border-bottom: 2px solid ${sev.accent};
  }
  .ss-payment-box {
    background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 14px 18px; margin: 18px 0;
  }
  .ss-payment-title {
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    font-size: 10pt; text-transform: uppercase; letter-spacing: 0.05em;
    color: #4B5563; margin-bottom: 8px;
  }
  .ss-payment-table th { width: 40%; color: #6B7280; font-weight: 600; }

  /* Severity flair */
  .ss-urgent {
    color: #B91C1C; font-family: 'Montserrat', sans-serif; font-weight: 800;
    font-size: 12pt; letter-spacing: 0.1em; text-align: center;
    border: 2px solid #B91C1C; padding: 8px; margin-bottom: 18px;
  }
  .ss-warning {
    background: #FEF3C7; border-left: 4px solid #D97706; padding: 10px 14px;
    margin: 14px 0;
  }
  .ss-final-warning {
    background: #F5F5F5; border: 1px solid #000; padding: 12px 16px;
    margin-top: 22px; font-size: 10.5pt;
  }

  /* Signature + footer */
  .ss-signature { margin-top: 28px; font-size: 10.5pt; }
  .ss-sig-name {
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    margin-top: 32px;
  }
  .ss-sig-line {
    border-top: 1px solid #9CA3AF; width: 240px; margin: 28px 0 6px;
  }
  .ss-footer {
    margin-top: 26px; padding-top: 14px;
    border-top: 1px solid #E5E7EB;
    font-size: 9pt; color: #6B7280; line-height: 1.5;
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  }
  .ss-footer-block { flex: 1 1 200px; }
  .ss-footer-label {
    font-family: 'Montserrat', sans-serif; font-weight: 700;
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em;
    color: #4B5563; margin-bottom: 2px;
  }

  /* Print rules — strip screen chrome, keep sections together */
  @media print {
    body { background: #fff !important; }
    .ss-letter { font-size: 10.5pt; }
    .ss-page { border: none; box-shadow: none; padding: 0; max-width: 100%;
               border-left: ${sev.leftStripWidth} solid ${sev.leftStripColor}; }
    .ss-payment-box, .ss-amount-table, .ss-letterhead, .ss-signature,
    .ss-section-title, .ss-clauses li, .ss-warning, .ss-final-warning,
    .ss-footer { page-break-inside: avoid; }
    .ss-screen-only { display: none !important; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<div class="ss-letter" data-letter-level="${severityLevel}">
  <div class="ss-page">
    ${headerCaption}${deliveryBadge}
    <div class="ss-letterhead">
      ${logoHtml}
      <div class="ss-company">
        <div class="ss-company-name">${escHtml(COMPANY.name)}</div>
        <div>ABN ${escHtml(COMPANY.abn)}${COMPANY.acn ? ` · ACN ${escHtml(COMPANY.acn)}` : ''}</div>
        <div>${escHtml(COMPANY.address)}</div>
        <div>${escHtml(COMPANY.phone)} · ${escHtml(COMPANY.email)}</div>
      </div>
    </div>

    <div class="ss-recipient">
      <div class="ss-recipient-name">${escHtml(customer?.name || '____________________')}</div>
      ${recipientAbn}
      ${recipientAcn}
      <div class="ss-recipient-line">${escHtml(addressLine)}</div>
      <div class="ss-date">${escHtml(today)}</div>
    </div>

    <h1 class="ss-letter-title">${escHtml(sev.label)}</h1>

    <div class="ss-subject"><span class="ss-subject-label">RE:</span>${escHtml(subject)}</div>

    <div class="ss-body">
      <p>${escHtml(sev.salutation)} ${escHtml(contactName)},</p>
      ${bodyContent}
    </div>

    <div class="ss-signature">
      <p>${escHtml(sev.closing)}</p>
      <div class="ss-sig-line"></div>
      <div class="ss-sig-name">${escHtml(COMPANY.name)}</div>
      <div>Accounts &amp; Receivables</div>
    </div>

    <div class="ss-footer">
      <div class="ss-footer-block">
        <div class="ss-footer-label">Payment</div>
        <div>${escHtml(COMPANY.name)}</div>
        <div>BSB ${escHtml(COMPANY.bsb)} · Acc ${escHtml(COMPANY.accountNumber)}</div>
        <div>Reference: ${escHtml(invNum)}</div>
      </div>
      <div class="ss-footer-block">
        <div class="ss-footer-label">Contact</div>
        <div>${escHtml(COMPANY.phone)}</div>
        <div>${escHtml(COMPANY.email)}</div>
        <div>${escHtml(COMPANY.address)}</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
}
