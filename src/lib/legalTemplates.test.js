import { describe, it, expect } from 'vitest'
import {
  generateCollectionsLetter,
  generateCollectionsLetterHTML,
} from './legalTemplates'

// Sprint 18 #L1 — HTML letter generator
//
// These tests pin the pieces a legal/CFO reader cares about:
//   • Montserrat is loaded for headings (Google Fonts link)
//   • Calibri stack is referenced in the font CSS for body text
//   • Severity-aware visual treatment per level (caption, badge, accent)
//   • Logo placeholder/img logic when company.logo_url is absent/present
//   • Graceful handling of missing data (no throws, sensible substitutes)
//   • Plain-text generator still works (backward compat)

const baseInvoice = {
  invoice_number: 'INV-2099',
  total: 4400,
  due_date: '2026-04-01',
  daysOverdue: 14,
}
const baseCustomer = {
  name: 'Acme Demolition Pty Ltd',
  abn: '11 222 333 444',
  acn: '222 333 444',
  address: '99 Industrial Way',
  suburb: 'Frankston',
  postcode: '3199',
}
const baseCompany = {
  name: 'Binned-IT Pty Ltd',
  abn: '57 999 888 777',
  acn: '999 888 777',
  address: '12 Industrial Way, Seaford VIC 3198',
  phone: '03 9000 1234',
  email: 'accounts@binnedit.com.au',
  bsb: '063-001',
  account_number: '8888 9999',
  penalty_interest_rate: '10',
}

describe('generateCollectionsLetterHTML — fonts & shell', () => {
  it('loads Montserrat from Google Fonts in a <link> tag', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    // The exact href may evolve, so check for the key fragments.
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Montserrat/i)
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]*>/i)
  })

  it('declares Calibri (with sensible fallbacks) for body type in the inline CSS', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toMatch(/Calibri,\s*Helvetica,\s*Arial,\s*sans-serif/)
    // Headings target Montserrat via font-family
    expect(html).toMatch(/font-family:\s*'Montserrat'/)
  })

  it('returns a self-contained HTML document', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(html.startsWith('<!doctype html>') || html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toMatch(/<\/html>\s*$/)
    expect(html).toContain('<style>')
  })
})

describe('generateCollectionsLetterHTML — logo handling', () => {
  it('renders the "Insert your logo here" placeholder when company.logo_url is empty', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('Insert your logo here')
    expect(html).toContain('Settings → Company Identity')
    expect(html).toContain('data-testid="logo-placeholder"')
    expect(html).not.toMatch(/<img class="ss-logo"/)
  })

  it('renders an <img> when company.logo_url is set', () => {
    const html = generateCollectionsLetterHTML(
      1,
      baseInvoice,
      baseCustomer,
      null,
      { ...baseCompany, logo_url: 'https://example.com/binnedit-logo.png' },
    )
    expect(html).toMatch(/<img class="ss-logo"[^>]+src="https:\/\/example\.com\/binnedit-logo\.png"/)
    expect(html).not.toContain('Insert your logo here')
  })

  it('escapes a malicious logo URL — no raw quote/angle bracket break-out', () => {
    const html = generateCollectionsLetterHTML(
      1,
      baseInvoice,
      baseCustomer,
      null,
      { ...baseCompany, logo_url: 'x" onerror="alert(1)' },
    )
    // The raw attack string must NOT appear with an unescaped trailing quote
    // capable of closing the src attribute.
    expect(html).not.toContain('src="x" onerror="alert(1)"')
    // It should be properly escaped as &quot;.
    expect(html).toContain('src="x&quot; onerror=&quot;alert(1)"')
  })
})

describe('generateCollectionsLetterHTML — severity-aware treatment', () => {
  it('Level 1 — uses neutral grey accent, no header badge in markup', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('OVERDUE NOTICE')
    expect(html).toContain('data-letter-level="1"')
    // The .ss-header-badge CSS rule is in every shell, but no <div> using it
    // should be rendered for level 1 — extract the body markup and check.
    const body = html.split('<body>')[1] || ''
    expect(body).not.toMatch(/<div class="ss-header-badge"/)
    expect(body).not.toContain('LEGAL DEMAND')
    expect(body).not.toContain('STATUTORY DEMAND UNDER')
    // Light grey accent
    expect(html).toContain('#9CA3AF')
  })

  it('Level 2 — amber accent, no header badge but heavier left strip', () => {
    const html = generateCollectionsLetterHTML(2, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('FORMAL NOTICE OF OVERDUE ACCOUNT')
    expect(html).toContain('data-letter-level="2"')
    expect(html).toContain('#D97706') // amber accent
    expect(html).toContain('Penalty Interest Rates Act')
  })

  it('Level 3 — red accent + LEGAL DEMAND header badge', () => {
    const html = generateCollectionsLetterHTML(3, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('LETTER OF DEMAND')
    expect(html).toContain('LEGAL DEMAND')
    expect(html).toContain('data-letter-level="3"')
    expect(html).toContain('#B91C1C') // red accent
    expect(html).toContain('SEVEN (7) DAYS')
    // Body markup must include a <div class="ss-header-badge"> at level 3
    const body = html.split('<body>')[1] || ''
    expect(body).toMatch(/<div class="ss-header-badge"/)
    expect(html).toContain('BY EMAIL AND REGISTERED POST')
  })

  it('Level 4 — heavy black border + statutory caption + via-post badge', () => {
    const html = generateCollectionsLetterHTML(4, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('STATUTORY DEMAND UNDER s459E CORPORATIONS ACT 2001')
    expect(html).toContain('VIA REGISTERED POST')
    expect(html).toContain('data-letter-level="4"')
    expect(html).toContain('4px double #000000') // heavy black border style
    expect(html).toContain('s.459E')
    expect(html).toContain('TWENTY-ONE (21) DAYS')
  })

  it('clamps unexpected level values to the level-1 default rather than crashing', () => {
    const html = generateCollectionsLetterHTML(99, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('OVERDUE NOTICE')
    expect(html).toContain('data-letter-level="1"')
  })
})

describe('generateCollectionsLetterHTML — graceful missing data', () => {
  it('substitutes "[Address withheld]" when customer address fields are blank', () => {
    const html = generateCollectionsLetterHTML(
      2,
      baseInvoice,
      { name: 'Acme Demolition' }, // no address/suburb/postcode
      null,
      baseCompany,
    )
    expect(html).toContain('[Address withheld]')
  })

  it('does not render an ABN line when the customer has no ABN on file', () => {
    const html = generateCollectionsLetterHTML(
      1,
      baseInvoice,
      { name: 'Acme Demolition' }, // no abn
      null,
      baseCompany,
    )
    // We only suppress the recipient ABN line — company ABN at the top still renders.
    expect(html).not.toMatch(/<div class="ss-recipient-line">ABN /)
  })

  it('renders without throwing when invoice/customer/company are all undefined', () => {
    const html = generateCollectionsLetterHTML(3, undefined, undefined, undefined, undefined)
    expect(typeof html).toBe('string')
    expect(html).toContain('LETTER OF DEMAND')
    expect(html).toContain('Insert your logo here')
  })

  it('renders the customer ABN when provided (formal letter style)', () => {
    const html = generateCollectionsLetterHTML(3, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('ABN 11 222 333 444')
  })
})

describe('generateCollectionsLetterHTML — financial detail', () => {
  it('includes the invoice number, amount, and AU-formatted total due', () => {
    const html = generateCollectionsLetterHTML(2, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('INV-2099')
    // Original amount $4,400.00 (en-AU)
    expect(html).toContain('$4,400.00')
    // Total due is amount + accrued interest — at least the dollar prefix should be present.
    expect(html).toMatch(/\$4,4\d\d\.\d\d|\$4,5\d\d\.\d\d/)
  })

  it('uses the company-supplied BSB and account number in the payment box', () => {
    const html = generateCollectionsLetterHTML(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(html).toContain('063-001')
    expect(html).toContain('8888 9999')
  })
})

describe('generateCollectionsLetter (plain text) — backward compatibility', () => {
  it('still returns a plain-text string for level 1', () => {
    const text = generateCollectionsLetter(1, baseInvoice, baseCustomer, null, baseCompany)
    expect(typeof text).toBe('string')
    expect(text).not.toMatch(/<html/i)
    expect(text).toContain('OVERDUE ACCOUNT')
    expect(text).toContain('INV-2099')
  })

  it('still returns a plain-text string for level 4', () => {
    const text = generateCollectionsLetter(4, baseInvoice, baseCustomer, null, baseCompany)
    expect(typeof text).toBe('string')
    expect(text).not.toMatch(/<html/i)
    expect(text).toContain('STATUTORY DEMAND')
  })
})
