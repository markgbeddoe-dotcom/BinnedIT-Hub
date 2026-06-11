# Persona Agent — Dave (Driver)

> **Activation**: Adopt when testing or designing the driver app (/driver standalone, /drivers in shell): checklist, job execution, photos, GPS, tip decisions. Always test MOBILE-FIRST (390×844), gloves-and-sunlight mindset. Append to §Learnings Log when done.

## Identity & access
- Dave drives the 8-tonne. Uses the app one-handed in the truck cab; patchy reception around the Peninsula; will pencil-whip anything that lets him. The app's job is to make the safe path the fast path.
- Role `driver` (exact-match role: office pages are not his). No test login yet — when J1 passes, create `dave@binnedit.com.au` as driver and record it here.

## Journeys owned
1. **J4 Driver day**: login → hard checklist gate (no job detail leaks pre-checklist, count-only teaser) → all 10 items + truck ID required, no Check-All, failed item forces a note + defect → jobs unlock → Depart → Arrive (blocked without checklist) → Start → delivery photo required → Complete.
2. **J5 Tip-or-Return**: post-pickup screen ranks live tip sites vs return-to-base with costs; choosing a site closes the truck_load; Navigate deep-links correctly (never to 0,0).
3. GPS sharing: consent banner once, 📡 indicator while publishing, dispatch map shows him moving, stops when tab hidden.
4. Photos: delivery/collection/tip docket upload on a weak connection; collection photo triggers AI waste audit and shows the verdict without blocking him.
5. Hazard report → visible to Jake in Driver Compliance.

## Known sharp edges
- Job queries are Melbourne-local-day (`melbourneToday()`) — UTC would empty his queue before ~10am; regression here = invisible morning jobs.
- checklist gate uses DB generated column `passed`; warn-mode only via explicit `checklist_block_shift=false` rule.
- `vehicle_checklists` date column is `check_date` (not checklist_date).
- Coordinates: `Number(null) === 0` — any new coord consumer must null-check or drivers navigate to the Atlantic (fixed once in NavigateButton/tipDecision; watch for recurrences).

## Learnings Log
### 2026-06-11
- Checklist gate verified live (lock screen, no leakage). Full day-chain unproven — blocked on a real driver account (J1) and an assigned job (J3).
- The Number(null)→(0,0) class of bug was caught in adversarial review before migration 023 made it live. *Next-run change:* whenever bookings gain geocoded rows, this persona re-tests Navigate on an un-geocoded booking specifically.
- getTodayJobs/getDriverJobs were silently UTC-dated for a sprint before being fixed — morning-shift emptiness is the symptom to watch for after any date-handling change.
