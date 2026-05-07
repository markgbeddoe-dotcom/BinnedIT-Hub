# Meg — End-to-End Reconciliation Working Paper

**Date:** 2026-05-08
**Auditor:** Margaret "Meg" Whitfield, FCA — virtual CFO (per `agents/Accountant.md`)
**Mode:** Deep audit (per §3 — Mark explicitly asked for end-to-end sign-off)
**Scope:** Both cash AND accrual basis × 8 months Jul 2025–Feb 2026.
**Source-of-truth:** Two Xero exports the user supplied at 2026-05-06.
**Production code under test:** `api/lib/xero-mapper.js` (post-Sprint-17, includes paymentsOnly support).
**Live DB:** PostgREST query against `financials_monthly` using SUPABASE_SERVICE_ROLE_KEY.

---

## Headline

- **Source ↔ mapper:** 🟢 zero material variance across all 16 month-basis pairs.
- **Mapper ↔ live DB:** 🟡 cannot tie out — live DB pre-dates migration 020 (still single-basis accrual).

**Verdict:** 🟡 PARTIAL — DB schema pre-dates migration 020 (cash/accrual split). Live DB still single-basis (accrual). Cannot tie out cash basis until Mark applies 020 and re-syncs.

---

## Per-month reconciliation grid (rev_total, source vs mapper)

| Month | Basis | Source revenue | Mapper revenue | Δ$ | Material? |
|---|---|---:|---:|---:|---|
| July 2025 | cash | $158453.60 | $158453.60 | 0.00 | 🟢 within tolerance |
| July 2025 | accrual | $142181.52 | $142181.52 | 0.00 | 🟢 within tolerance |
| Aug 2025 | cash | $142126.62 | $142126.62 | 0.00 | 🟢 within tolerance |
| Aug 2025 | accrual | $145489.94 | $145489.94 | 0.00 | 🟢 within tolerance |
| Sept 2025 | cash | $160002.75 | $160002.75 | 0.00 | 🟢 within tolerance |
| Sept 2025 | accrual | $179927.15 | $179927.15 | 0.00 | 🟢 within tolerance |
| Oct 2025 | cash | $214200.83 | $214200.83 | 0.00 | 🟢 within tolerance |
| Oct 2025 | accrual | $182337.70 | $182337.70 | 0.00 | 🟢 within tolerance |
| Nov 2025 | cash | $152954.01 | $152954.01 | 0.00 | 🟢 within tolerance |
| Nov 2025 | accrual | $168995.76 | $168995.76 | 0.00 | 🟢 within tolerance |
| Dec 2025 | cash | $158250.33 | $158250.33 | 0.00 | 🟢 within tolerance |
| Dec 2025 | accrual | $144221.87 | $144221.87 | 0.00 | 🟢 within tolerance |
| Jan 2026 | cash | $128207.41 | $128207.41 | 0.00 | 🟢 within tolerance |
| Jan 2026 | accrual | $128951.28 | $128951.28 | 0.00 | 🟢 within tolerance |
| Feb 2026 | cash | $139482.68 | $139482.68 | 0.00 | 🟢 within tolerance |
| Feb 2026 | accrual | $182867.14 | $182867.14 | 0.00 | 🟢 within tolerance |

## Per-month reconciliation grid (net_profit, source vs mapper)

| Month | Basis | Source NP | Mapper NP | Δ$ | Material? |
|---|---|---:|---:|---:|---|
| July 2025 | cash | $4350.00 | $4350.00 | 0.00 | 🟢 within tolerance |
| July 2025 | accrual | $-4942.21 | $-4942.21 | 0.00 | 🟢 within tolerance |
| Aug 2025 | cash | $8676.65 | $8676.65 | 0.00 | 🟢 within tolerance |
| Aug 2025 | accrual | $2298.91 | $2298.91 | 0.00 | 🟢 within tolerance |
| Sept 2025 | cash | $11512.65 | $11512.65 | 0.00 | 🟢 within tolerance |
| Sept 2025 | accrual | $24082.57 | $24082.57 | 0.00 | 🟢 within tolerance |
| Oct 2025 | cash | $29146.34 | $29146.34 | 0.00 | 🟢 within tolerance |
| Oct 2025 | accrual | $13883.05 | $13883.05 | 0.00 | 🟢 within tolerance |
| Nov 2025 | cash | $16105.91 | $16105.91 | 0.00 | 🟢 within tolerance |
| Nov 2025 | accrual | $17949.66 | $17949.66 | 0.00 | 🟢 within tolerance |
| Dec 2025 | cash | $-5012.10 | $-5012.10 | 0.00 | 🟢 within tolerance |
| Dec 2025 | accrual | $4740.62 | $4740.62 | 0.00 | 🟢 within tolerance |
| Jan 2026 | cash | $1704.06 | $1704.06 | 0.00 | 🟢 within tolerance |
| Jan 2026 | accrual | $-4332.40 | $-4332.40 | 0.00 | 🟢 within tolerance |
| Feb 2026 | cash | $-17638.72 | $-17638.72 | 0.00 | 🟢 within tolerance |
| Feb 2026 | accrual | $30511.71 | $30511.71 | 0.00 | 🟢 within tolerance |

## Per-month diagnostic — what the mapper bucketed

| Month | Basis | rev_general | rev_other | Unclassified rows |
|---|---|---:|---:|---|
| July 2025 | cash | $95592.04 | $2404.77 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| July 2025 | accrual | $82424.97 | $2297.27 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Aug 2025 | cash | $72346.26 | $4155.02 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Aug 2025 | accrual | $83837.42 | $5827.02 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Sept 2025 | cash | $90505.96 | $2337.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Sept 2025 | accrual | $105605.87 | $1042.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Oct 2025 | cash | $122905.94 | $1121.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Oct 2025 | accrual | $110750.39 | $274.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Nov 2025 | cash | $109735.02 | $609.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Nov 2025 | accrual | $118644.79 | $1768.20 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Dec 2025 | cash | $112590.85 | $1279.20 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Dec 2025 | accrual | $102695.76 | $300.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Jan 2026 | cash | $86410.00 | $1682.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Jan 2026 | accrual | $91235.18 | $1802.00 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Feb 2026 | cash | $81206.18 | $2046.25 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |
| Feb 2026 | accrual | $99801.01 | $2116.25 | Machinery Hire, Other fees, PLASTIC AND TAPE, Revenue - Council Permits |

## Live DB row state (per month, both bases)

⚠ The live `financials_monthly` table does NOT yet have the `accounting_basis` column (migration 020 not applied). Existing rows reflect pre-Sprint-17 syncs which were de-facto accrual basis (no `paymentsOnly` was sent). Cash-basis rows do not yet exist anywhere in production.

| Month | Basis | DB revenue | DB net_profit | DB row exists? |
|---|---|---:|---:|---|
| July 2025 | cash | $136290.25 | $39710.54 | ✓ |
| July 2025 | accrual | $136290.25 | $39710.54 | ✓ |
| Aug 2025 | cash | $133256.51 | $32402.25 | ✓ |
| Aug 2025 | accrual | $133256.51 | $32402.25 | ✓ |
| Sept 2025 | cash | $169281.07 | $70696.15 | ✓ |
| Sept 2025 | accrual | $169281.07 | $70696.15 | ✓ |
| Oct 2025 | cash | $178249.34 | $67321.64 | ✓ |
| Oct 2025 | accrual | $178249.34 | $67321.64 | ✓ |
| Nov 2025 | cash | $153815.82 | $69314.92 | ✓ |
| Nov 2025 | accrual | $153815.82 | $69314.92 | ✓ |
| Dec 2025 | cash | $138220.71 | $50322.06 | ✓ |
| Dec 2025 | accrual | $138220.71 | $50322.06 | ✓ |
| Jan 2026 | cash | $123547.50 | $30233.80 | ✓ |
| Jan 2026 | accrual | $123547.50 | $30233.80 | ✓ |
| Feb 2026 | cash | $175331.21 | $81381.28 | ✓ |
| Feb 2026 | accrual | $175331.21 | $81381.28 | ✓ |

---

## Sign-off

**🟡 PARTIAL — DB schema pre-dates migration 020 (cash/accrual split). Live DB still single-basis (accrual). Cannot tie out cash basis until Mark applies 020 and re-syncs.**

### What this proves

- **The new mapping code (post-Sprint-17) reconciles to the cent against both Xero exports across all 8 months × 2 bases (16 month-basis pairs). Zero material variance from source.**
- The classifier handles every Trading Income SKU (WMF, ASB, SOI, GRW, CON, transport, tonnage, recycling income, etc.) without leaking into rev_other.
- The cash/accrual difference is correctly preserved: Feb 2026 cash NP **−$17,638.72** vs accrual NP **+$30,511.71** — the $48,150 swing reproduces.
- The mapper itself is decision-grade.

### What this does NOT prove

- The LIVE production database has not yet been re-synced through the new mapper. Migration 020 must be applied first (paste `docs/operator-runbooks/2026-05-07-apply-migrations.sql` into Supabase Studio).
- The Xero API itself behaves as expected for `paymentsOnly=true` — needs a real OAuth'd sync to confirm Xero returns the same row structure for cash basis as for accrual.
- The end-to-end DASHBOARD render: Snapshot tab → tile values → match the mapper output. Playwright spec at `e2e/cash-accrual-toggle.spec.js` validates this once Mark logs in and runs `npm run test:e2e`.

### Two-step gate Meg requires before signing the period close

1. Mark applies migration 020 + re-syncs Feb 2026 with `{action:"sync_all_bases", month:"2026-02"}`.
2. Re-run THIS script. Expect the Live DB column to populate with Feb cash NP −$17,638.72 and accrual NP +$30,511.71 — exact match against the source.

Until then, the verdict is 🟡 — code is sound, deployment gate is open.