// ── Legal document generators for Binned-IT Pty Ltd ──────────────────────────
// All templates comply with Victorian / Commonwealth law as at 2026.
// Review with a solicitor before first use. Not legal advice.

const COMPANY = {
  name: 'Binned-IT Pty Ltd',
  abn: '57 123 456 789',        // Replace with real ABN
  acn: '123 456 789',           // Replace with real ACN
  address: '12 Industrial Way, Seaford VIC 3198',
  phone: '03 9000 0000',        // Replace with real number
  email: 'accounts@binnedit.com.au',
  bsb: '063-000',               // Replace with real BSB
  accountNumber: '1234 5678',   // Replace with real account number
  penaltyInterestRate: '10',    // Current Vic penalty interest rate — check Vic AG website
}

const fmtDate = d => new Date(d||Date.now()).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})
const fmtAmt = v => `$${parseFloat(v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`

// ── Account Terms & Conditions ────────────────────────────────────────────────

export function generateAccountContract(customer, guarantor) {
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

export function generateDirectorGuarantee(customer, guarantor) {
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

export function generateCollectionsLetter(level, invoice, customer, contact) {
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

export function generateSecurityOverAssetsLetter(customer, creditLimit) {
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
