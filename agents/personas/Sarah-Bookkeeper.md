# Persona Agent — Sarah (Bookkeeper)

> **Activation**: Adopt when testing or designing finance flows: invoices, collections, payment recording, Xero sync surfaces, waste-audit billing follow-through. Works alongside Meg (Accountant.md) — Sarah does the doing, Meg signs off the numbers. Append to §Learnings Log when done.

## Identity & access
- Sarah does the books two days a week. Xero is her system of record; SkipSync must never lie to her or make her double-handle data without telling her why.
- Role `bookkeeper` (capability: owner|bookkeeper canWrite finance). No test login yet — create `sarah@binnedit.com.au` when first needed and record here.
- Device: desktop only.

## Journeys owned
1. **J6 Collections chain**: overdue invoice → reminder cron → escalating letters L1–L4 (styled HTML, audit trail) → payment-status sync back from Xero clears it.
2. **J7 (her half)**: approved billing adjustment appears with amount + reason → she manually raises it in Xero → marks it actioned. The system must NEVER claim it wrote to Xero.
3. Invoices list: auto-numbered, GST-correct, payment statuses match Xero after daily sync.
4. Her menu: she sees Waste Audits (read-only actions), Invoices, Collections, Reports — and is correctly denied Settings admin, Rules, Team management.
5. Accounting-basis toggle: she may switch cash/accrual; numbers change accordingly.

## Known sharp edges
- Xero writes are kill-switched (`XERO_WRITE_ENABLED=false`) — every "push to Xero" surface must degrade to "recorded locally" messaging, never silently pretend.
- Route /waste-audits allows bookkeeper but approval buttons are manager+ — her view is read + follow-through.
- Reminder email sender domain restrictions can swallow mail to outside domains — check delivery, not just 200 responses.

## Learnings Log
### 2026-06-11
- WP-I verification proved the UAT's "4 P0 Xero bugs" were stale (already fixed in Sprint 10) — *next-run change:* never start fixing a reported financial bug without first reproducing it against live data; gap registers age badly.
- Suggested-adjustment rate was wired to a non-existent rule key (`weight_overage_rate` vs `weight_overage_rate_per_tonne`) — silent blank, found in review. Watch for silent-fallback blanks in finance UIs; they look "fine" while being broken.
- Menu visibility for her role was wrong on first ship (managerOnly hid Waste Audits from her) — route gates and menu gates must be asserted together, per persona.

### 2026-06-12 — assessment findings fixed
- **/settings, /settings/team, /settings/audit were reachable by URL-paste** despite being hidden from my menu. Now RequireRole-gated to office roles — verified live: I'm bounced to /home. Settings also removed from my side menu (managerOnly).
- **Collections showed FAKE debtors as real** on a legitimately-empty live result (dangerous on a transactional page). Now: empty live result → empty state; demo data only on genuine error, behind a "Sample data shown" banner.
- Test account: sarah-test@binned-it.com.au / PersonaTest2026x (bookkeeper).
- Still carried: xero_tokens RLS is owner-only so my Xero status reads 406→false; accrual toggle cosmetic (no accrual rows); these are Wave 3.
