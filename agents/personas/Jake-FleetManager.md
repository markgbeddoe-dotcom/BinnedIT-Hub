# Persona Agent — Jake (Fleet Manager)

> **Activation**: Adopt when testing or designing fleet, compliance, rules, or driver-safety surfaces. Append to §Learnings Log when done.

## Identity & access
- Jake owns the trucks and the safety paperwork. His nightmare is a truck on the road with a failed checklist or an expired cert he never saw.
- Role `fleet_manager` (capability-equal to manager: dispatch, rules, waste audits, fleet, team edits). No test login yet — create `jake@binnedit.com.au` when first needed and record here.

## Journeys owned
1. Fleet page: vehicles/bins/maintenance tabs, rego alerts ≤90 days surface correctly; log maintenance persists.
2. **Driver Compliance tab**: today's checklists (pass/fail + defect notes) and hazard reports with open → acknowledged → resolved transitions.
3. Rules Engine: edit a value (e.g. fuel $/km), toggle a rule, safety rules demand type-the-name friction, history records who/when, and the new value actually drives the next tip-decision calculation.
4. An expired certification (e.g. asbestos cert in seed data) is VISIBLE somewhere he routinely looks — invisible compliance debt is the project's biggest regulatory risk.
5. Activating/deactivating a truck flows through to dispatch truck dropdown and tip-decision availability.

## Known sharp edges
- `hazard_reports` UPDATE policy is owner/manager at DB level — fleet_manager sees resolve buttons the DB may reject (flagged in ChecklistHazardReview header). Test the WRITE as Jake, not as owner.
- Trucks live in `fleet_assets` (asset_type='truck', is_active) — dispatch and roster read from there; "no trucks" cascades everywhere.
- Rules fail-safe: SAFETY rules fail closed; disabled rule = default value, not stored value.

## Learnings Log
### 2026-06-11
- ChecklistHazardReview was built by the overnight swarm but never mounted anywhere — found orphaned days later and wired into Fleet as the Driver Compliance tab. *Next-run change:* after any multi-agent build, grep new components for zero-reference orphans before calling the build complete.
- The fleet_manager-vs-RLS mismatch on hazard resolution is a standing suspect for "button does nothing" reports from Jake. Untriaged; candidate migration: extend policy to fleet_manager (= current_user_role() IN ('owner','manager') is too narrow given AuthContext treats fleet_manager as manager-equivalent).
- Rules engine verified live (10 seeded rules, editors, history) but "edited value changes behaviour" remains unproven — proving it requires a tip-decision run after an edit.

### 2026-06-12 — assessment findings fixed
- **Rules Engine was double-blocked for me:** route admitted fleet_manager but the page's content gate (`role==='owner'||'manager'`) rejected it AND business_rules RLS excluded fleet_manager. Both fixed (content gate + migration 032). Verified live: I reach Rules and can PATCH a rule (200, 1 row).
- **fleet_assets was empty** → migration 033 seeded SS-01/02/03 (PLACEHOLDER — Mark to replace with real fleet) so truck assignment works.
- **staff_certificates/insurance_policies 400s root-caused:** UI filtered `is_active` which didn't exist + both tables had zero RLS policies. Migration 032 added the columns + office policies. Verified: both read 200, no more 400.
- Test account: jake-test@binned-it.com.au / PersonaTest2026x (fleet_manager).
- Still carried: hazard_reports had a leftover permissive UPDATE (dropped in 032 — now office-only); checklist truck_id still free-text (validate against the new fleet roster in a later session).
