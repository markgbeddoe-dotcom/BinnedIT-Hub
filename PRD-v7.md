# SkipSync — Product Requirements Document v7.0

## PRD v7: Operations Intelligence Release

**Version:** 7.0
**Date:** 10 June 2026
**Status:** ACTIVE — drives the overnight build of 10–11 June 2026 and the sprint that follows
**Author:** John (BMAD PM) + Mark Beddoe
**Supersedes:** PRD v6.0 (27 April 2026)
**Source requirements:** Owner requirements R1–R7 (Mark, 10 Jun 2026 22:28) as triaged in `_bmad-output/uat-2026-06-10/implementation-plan.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Grounding — What Verifiably Exists Today](#2-grounding--what-verifiably-exists-today)
3. [Personas (delta from v6)](#3-personas-delta-from-v6)
4. [R1 — Driver & Truck Assignment in Dispatch](#4-r1--driver--truck-assignment-in-dispatch)
5. [R2 — Mandatory Pre-Shift Vehicle Checklist](#5-r2--mandatory-pre-shift-vehicle-checklist)
6. [R3 — Live GPS Map & Route Guidance](#6-r3--live-gps-map--route-guidance)
7. [R4 — Load Tracking & Tip-or-Return Decision Engine](#7-r4--load-tracking--tip-or-return-decision-engine)
8. [R5 — AI Bin-Photo Waste Audit & Billing Adjustment](#8-r5--ai-bin-photo-waste-audit--billing-adjustment)
9. [R6 — Management-Editable Business Rules Engine](#9-r6--management-editable-business-rules-engine)
10. [R7 — AI Cost-Efficiency Analyst](#10-r7--ai-cost-efficiency-analyst)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Out of Scope for This Release](#12-out-of-scope-for-this-release)
13. [Phased Rollout](#13-phased-rollout)
14. [Success Metrics](#14-success-metrics)
15. [Risk Register (v7 additions)](#15-risk-register-v7-additions)

---

## 1. Executive Summary

PRD v6 delivered the operations spine: bookings, dispatch board, driver mobile app v1, Xero read sync, collections engine, SMS/email confirmations, and the reporting dashboard. v7 is the **Operations Intelligence Release**: it closes the gap between "jobs exist in a list" and "the business runs itself in real time".

Seven owner requirements, captured verbatim from Mark on 10 June 2026:

| ID | Requirement | Work Package |
|----|-------------|--------------|
| R1 | Dispatch can assign a driver (and truck) to a booking/job | WP-A |
| R2 | ALL driver pre-shift checklist fields required before a shift can start | WP-B |
| R3 | Embedded live map: real-time driver GPS + best-route guidance to next job | WP-C |
| R4 | Post-pickup logistics: track load per truck; tip-nearby-and-redeploy vs return-to-base decision | WP-E |
| R5 | Driver photographs bin contents; AI classifies waste, detects misdeclaration, triggers billing adjustment | WP-D |
| R6 | Management-editable rules engine governing routing/tipping/billing/safety rules | WP-F |
| R7 | Embedded AI continuously mining data for cost efficiencies | WP-G |

This PRD is deliberately conservative about what ships **tonight** (the MVP cut, §13.1) versus what follows in the next sprint (§13.2). Every functional requirement below is grounded in the codebase as verified on 10 June 2026 (§2). Where v6 said "Phase 4/5 roadmap" for AI photo checking and route intelligence, v7 ships the first working version of both — within hard boundaries: **no in-app routing engine** (we deep-link to Google Maps), **no Xero write-back** (billing adjustments are internal records only; Xero remains read-only until the POC validates writes), and **no offline-first sync** in this release.

---

## 2. Grounding — What Verifiably Exists Today

Every requirement in this document builds on these verified codebase facts (audited in code on the night of 10 June 2026). Dev agents and reviewers should treat this table as authoritative.

| # | Fact | Implication for v7 |
|---|------|--------------------|
| G1 | `bookings.driver_id uuid → auth.users` and `driver_name_assigned` already exist (migration 009), but the dispatch UI never writes them — it only displays legacy free-text `driver_name` | R1 is UI + role plumbing, not new schema for assignment itself |
| G2 | `profiles.role` CHECK constraint is `owner\|manager\|bookkeeper\|viewer` (001_initial_schema.sql:13) — **no `driver` role exists** | Migration 022 must extend the role CHECK before any driver picker can be populated |
| G3 | `job_events` already records lat/lng per start/complete event; `recordJobEvent()` exists in `src/api/driver.js` | Point-in-time GPS exists; R3 adds *continuous* tracking |
| G4 | `VehicleChecklist.jsx` allows submit with unchecked items, has a "Check All" pencil-whip button, truck ID is optional, and the close-X skips the checklist entirely. `vehicle_checklists.passed` is a generated DB column the UI ignores. `DriverApp.jsx` sets `checklistDone=true` even when not passed (lines 95–98); JobQueue gating is soft | R2 is enforcement of an existing checklist, not a new checklist |
| G5 | `fleet_assets` (migration 005) has `asset_type IN ('truck','bin',…)` — a usable truck roster | Truck picker in R1 reads from `fleet_assets`, no new table |
| G6 | `job_photos` table + Supabase Storage bucket `job-photos` exist; `PhotoCapture.jsx` uploads photos; **no AI analysis** | R5 adds analysis on top of working capture |
| G7 | `api/chat.js` is the established Anthropic proxy pattern (Supabase JWT auth, `ANTHROPIC_API_KEY` env with `platform_settings` override); Vercel crons already run 4 endpoints | R5 and R7 follow this exact pattern — no new auth architecture |
| G8 | No map library installed. No geocoding anywhere. Bookings carry address **text only** — no lat/lng columns | R3 introduces Leaflet + Nominatim from zero; every map feature depends on geocoding succeeding |
| G9 | Xero integration is READ-ONLY, enforced by the `XERO_WRITE_ENABLED` kill-switch (defaults false) | R5 billing adjustments are internal records. Nothing in v7 may touch the Xero write path |

New migrations are pre-assigned: **022** (driver role), **023** (driver_locations + booking lat/lng), **024** (waste_audits + billing_adjustments), **025** (tip_sites + truck_loads), **026** (business_rules + history), **027** (ai_insights). All idempotent, all with RLS.

---

## 3. Personas (delta from v6)

v6 personas (§4 of PRD v6) carry over unchanged. v7 stories reference six active personas:

- **Dispatcher** — the person running the dispatch board on the day. In practice this is Sarah (mornings) or Jake (field reshuffles); "dispatcher" is the role, not a new hire.
- **Driver** — Tom, Dave, and others. v7 gives drivers a real `driver` role in `profiles` for the first time (G2). Drivers use the `/driver` PWA on their phones.
- **Mark — Owner.** Approves billing adjustments, edits business rules, consumes efficiency insights. 60% mobile.
- **Sarah — Bookkeeper / Office Manager.** Reviews and applies approved billing adjustments to internal records; reconciles against Xero (read-only).
- **Jake — Fleet Manager.** Owns checklist defects, truck roster (`fleet_assets`), tip site data, and load tracking accuracy.
- **Customer** — books a bin, declares a waste type, receives (and occasionally disputes) a billing adjustment notice.

---

## 4. R1 — Driver & Truck Assignment in Dispatch

### 4.1 Problem Statement

Dispatch today is a polite fiction. The dispatch board displays a legacy free-text `driver_name` string, while the real foreign keys (`bookings.driver_id`, `driver_name_assigned`, added in migration 009) are never written by any UI (G1). There is no `driver` role in `profiles` (G2), so there is literally no list of drivers to assign from. Consequences: the driver app cannot reliably filter "my jobs", no per-driver accountability, no truck-to-job linkage for load tracking (R4), and no way to put a driver dot next to a job pin on a map (R3). R1 is the keystone — R2 through R5 all assume a job knows its driver and its truck.

### 4.2 User Stories

- **As a dispatcher**, I want to assign a driver and a truck to any booking from the dispatch board, so that the run sheet each driver sees on their phone is exactly the jobs I gave them.
- **As a dispatcher**, I want an "unassigned" warning chip on scheduled jobs with no driver, so nothing slips to the morning of the job.
- **As a driver**, I want my job queue to show only jobs assigned to me, so I'm not scrolling through the whole company's day.
- **As Mark (owner)**, I want every job permanently linked to a driver and truck, so job costing, checklist compliance, and waste audits attribute to the right person and vehicle.
- **As Sarah (bookkeeper)**, I want driver/truck recorded on the booking row, so when a customer queries a job I can see who did it without ringing Jake.
- **As Jake (fleet manager)**, I want truck assignment drawn from the live `fleet_assets` roster (active trucks only), so a truck in the workshop can't be dispatched.
- **As a customer**, I want my booking confirmed with a real scheduled date and crew behind it, so "we'll be there Thursday" is backed by an actual assignment, not a hope.

### 4.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.1.1 | Migration 022 extends the `profiles.role` CHECK constraint to include `'driver'` (drop + re-add constraint, idempotent) and adds an index on `bookings(driver_id, scheduled_date)`. |
| FR7.1.2 | New hook `src/hooks/useDrivers.js` returns drivers (`profiles` where `role='driver'`) and trucks (`fleet_assets` where `asset_type='truck'` and `is_active`). |
| FR7.1.3 | The expanded JobCard on `DispatchBoard.jsx` provides driver select, truck select, and scheduled-date input. Saving writes `driver_id`, `driver_name_assigned`, `driver_name` (legacy display field, kept in sync for backward compatibility), and `truck_id`. |
| FR7.1.4 | NewJobModal includes the same driver/truck/date fields so a job can be born assigned. |
| FR7.1.5 | Scheduled jobs with no `driver_id` show an "unassigned" warning chip on the dispatch card. |
| FR7.1.6 | `useBookings.js` gains a `useAssignDriver` mutation; assignment is a single atomic update on the booking row. |
| FR7.1.7 | Assignment is editable until the job is completed; reassignment overwrites driver/truck and is reflected in the driver apps on next query refresh (TanStack Query). |

### 4.4 Acceptance Criteria

- **AC7.1.1** — Given a booking with no driver, When the dispatcher expands its card and selects driver "Tom" and truck "Hino 1" and saves, Then `bookings.driver_id`, `driver_name_assigned`, `driver_name`, and `truck_id` are persisted, and the card shows Tom + Hino 1 with no "unassigned" chip.
- **AC7.1.2** — Given Tom is logged into the driver app, When dispatch assigns him a job, Then the job appears in Tom's queue on next refresh and does not appear in Dave's.
- **AC7.1.3** — Given migration 022 has run, When an admin sets a profile's role to `driver`, Then the insert succeeds (no CHECK violation) and that person appears in the dispatch driver picker.
- **AC7.1.4** — Given a truck has `is_active = false` in `fleet_assets`, When the dispatcher opens the truck picker, Then that truck is not listed.
- **AC7.1.5** — Given a scheduled job for tomorrow with no driver, When the dispatch board renders, Then the card displays the "unassigned" warning chip.

### 4.5 Edge Cases

- **Two trucks, one driver:** Drivers can legitimately swap trucks mid-day (hook-lift in the morning, tilt-tray after lunch). Assignment is **per job**, not per shift: each booking carries its own `truck_id`. The same driver may hold jobs on two different trucks on the same date; the UI must not block this. Load tracking (R4) keys `truck_loads` by `truck_id`, so a swap mid-day still attributes the load to the truck that actually carried it. What we do **not** support tonight: one driver assigned to two *overlapping in-progress* jobs — JobQueue only allows one job in `in_progress` at a time per driver (existing state machine behaviour, retained).
- **Job cancelled mid-route:** If dispatch cancels a booking whose status is already in progress, the driver app shows the job as cancelled on next poll, the driver's active-job screen returns to the queue, and any `truck_loads` row for that booking remains (the bin may already be on the truck — Jake resolves physically; the record is kept for cost truth). The dispatcher sees a confirmation dialog warning that the driver may already be en route, and the driver assignment is preserved on the cancelled row for audit.
- **Legacy free-text driver names:** Hundreds of historical bookings carry only `driver_name` text. These are display-only; v7 does not attempt backfill matching of names to UUIDs. New assignments always write both fields.
- **Driver deactivated with future jobs assigned:** Picker hides non-driver/disabled profiles, but existing assignments stand and surface via the normal dispatch view; the unassigned chip logic only checks `driver_id IS NULL`, so a follow-up "assigned to inactive driver" warning is next-sprint scope.

---

## 5. R2 — Mandatory Pre-Shift Vehicle Checklist

### 5.1 Problem Statement

The pre-shift checklist exists but enforces nothing. Verified tonight (G4): a driver can submit with zero items checked, can "Check All" with one tap (institutionalised pencil-whipping), can leave the truck ID blank, or can dismiss the whole screen with the close-X. The database knows better — `vehicle_checklists.passed` is a generated column — but the UI ignores it, and `DriverApp.jsx` sets `checklistDone = true` even on a failed checklist (lines 95–98). For a fleet operator under Victorian OHS and Chain of Responsibility obligations, a checklist that can be skipped is arguably worse than no checklist: it manufactures false compliance evidence. Mark's requirement is unambiguous: **ALL fields required before a shift can start.**

### 5.2 User Stories

- **As a driver**, I want the checklist to clearly require every item and tell me exactly what's missing, so I can complete it correctly in under two minutes and get on the road.
- **As a driver**, when an item genuinely fails (e.g. a blown tail light), I want to record a defect with a note and still be handled fairly — not be silently blocked with no path forward.
- **As Jake (fleet manager)**, I want every failed checklist item to create a defect record with the driver's note, so I have a maintenance queue instead of verbal reports in the yard.
- **As Mark (owner)**, I want it impossible for a job to start before a passed checklist exists for that driver today, so our compliance evidence is real, not theatre.
- **As a dispatcher**, I want to see at a glance whether a driver's checklist has passed this morning, so I don't waste calls chasing a driver who is blocked in the yard.
- **As Sarah (bookkeeper)**, I want checklist records tied to driver and truck IDs, so insurance and incident paperwork can be assembled from the system.
- **As a customer**, I benefit indirectly: the truck arriving at my site has been checked roadworthy this morning. (No customer-facing UI for R2.)

### 5.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.2.1 | `VehicleChecklist.jsx`: remove the "Check All" button entirely. |
| FR7.2.2 | Submit is disabled until **all 10 items** are answered AND a truck ID is entered. |
| FR7.2.3 | A failed item requires a non-empty note and creates a defect record on submit. |
| FR7.2.4 | The close-X escape is removed during pre-shift; the checklist is a hard gate, not a dismissable modal. |
| FR7.2.5 | `DriverApp.jsx` sets `checklistDone` **only** when today's checklist row has `passed === true` (the DB generated column is the single source of truth). |
| FR7.2.6 | `JobQueue.jsx` hard-blocks all job start actions until the checklist has passed — button disabled with explanatory text, not a soft banner. |
| FR7.2.7 | `src/api/driver.js` `submitChecklist` throws server-side-of-the-client unless all checks are answered and `truckId` is present (defence in depth against UI bypass); `getTodayChecklist` returns the row including `passed`. |
| FR7.2.8 | Whether a failed checklist blocks the shift is governed by rules-engine key `checklist_block_shift` (default `true`, R6) — Mark can relax to "warn" mode without a deploy if a failed-but-roadworthy edge (e.g. cracked mirror, truck still legal) is strangling operations. |

### 5.4 Acceptance Criteria

- **AC7.2.1** — Given a driver opens the checklist with 9 of 10 items answered, When they look at the submit button, Then it is disabled and indicates what remains.
- **AC7.2.2** — Given all 10 items pass and a truck ID is entered, When the driver submits, Then the row persists with `passed = true` and the jobs screen unlocks.
- **AC7.2.3** — Given the driver marks "brakes" as failed, When they attempt to submit without a note, Then submission is blocked until a note is entered; on submit, a defect record is created and visible to Jake.
- **AC7.2.4** — Given today's checklist has `passed = false` and rule `checklist_block_shift = true`, When the driver opens the job queue, Then every start-job action is disabled with the message that the shift is blocked pending the checklist/defect.
- **AC7.2.5** — Given a crafted direct call to `submitChecklist` with an unchecked item, When it executes, Then it throws and no checklist row is written.
- **AC7.2.6** — Given yesterday's checklist passed but today's does not exist, When the driver opens the app today, Then the checklist gate is active (pass state is per-day, never carried over).

### 5.5 Edge Cases

- **Driver disputes a checklist defect:** Tom fails "tyres" on Truck 2; Jake inspects and finds them legal. The defect record is **not deletable** — Jake (manager role) resolves it with a resolution note ("inspected, tread 4.2mm, within limits"), and the resolution is appended, preserving the original report. The driver is never penalised in-app for reporting; the system must not create an incentive to pass everything. If the shift is blocked by the disputed defect, Jake's resolution (or Mark toggling `checklist_block_shift`) unblocks it — the driver cannot self-unblock. MVP scope: defect row + resolution note field; a full defect workflow UI is next sprint.
- **Two trucks, one driver (checklist dimension):** The checklist is completed **per driver per day against the truck they start on**. If the driver swaps trucks mid-day, tonight's MVP does not force a second checklist for truck #2 — this is a known, accepted gap, logged for next sprint ("checklist per truck-swap"), because mid-day enforcement requires truck-change detection we don't have yet. The checklist row records the truck ID it was completed against, so the audit trail is honest about which truck was inspected.
- **Checklist done, then job cancelled / no jobs assigned:** A passed checklist with zero jobs is valid; the shift simply has nothing in queue. No error states.
- **Clock-skew / late-night shifts:** "Today" is the device's local calendar date (Australia/Melbourne in practice). A shift starting at 23:50 will trip the gate again at midnight only when the app refetches `getTodayChecklist` — acceptable for a business that runs 06:00–18:00; documented, not engineered around.

---

## 6. R3 — Live GPS Map & Route Guidance

### 6.1 Problem Statement

Dispatch is blind between "job started" and "job completed". `job_events` captures a lat/lng snapshot at start and complete (G3), but there is no continuous position, no map anywhere in the product, no map library installed, no geocoding, and bookings store address **text only** (G8). When a customer rings asking "where's my bin?", Sarah rings Jake, Jake rings the driver, the driver pulls over to answer. Mark asked for an Uber-style embedded live map plus best-route guidance to the next job. v7 delivers live tracking and job pins on an embedded map, with route guidance via deep-link to Google Maps navigation (the same handoff pattern real driver apps use) — **not** an in-app turn-by-turn engine (§12).

### 6.2 User Stories

- **As a dispatcher**, I want a live map on the dispatch board showing every active driver and today's job pins, so I can answer "where's my bin?" in five seconds without a phone call.
- **As a dispatcher**, I want to see which driver is nearest an urgent new job, so same-day insert jobs go to the right truck.
- **As a driver**, I want a Navigate button on each job that opens Google Maps with the destination pre-filled, so I get real turn-by-turn without learning a new nav app.
- **As a driver**, I want tracking to start and stop with my shift automatically, so I'm not fiddling with toggles — and not tracked outside work hours.
- **As Mark (owner)**, I want to glance at the map from my phone and see the whole fleet moving, so I know the day is on track without interrupting anyone.
- **As Jake (fleet manager)**, I want last-known position and timestamp per truck, so a truck silent for 45 minutes prompts a welfare/breakdown call.
- **As a customer**, I want a tighter delivery window ("the truck is 3 suburbs away") when I call the office, because dispatch can actually see the truck.

### 6.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.3.1 | Migration 023 creates `driver_locations` (driver_id, truck_id, lat, lng, heading, speed_kmh, accuracy_m, booking_id, recorded_at) with RLS (driver inserts own rows; authenticated users read) and a `latest_driver_locations` view; adds `lat`, `lng`, `geocoded_at` columns to `bookings`. |
| FR7.3.2 | Map stack: `leaflet` + `react-leaflet@^4` (React 18 compatible) with OpenStreetMap tiles — no API key, no per-load billing. These are the **only** new npm dependencies in the entire release. |
| FR7.3.3 | New `src/hooks/useLocationPublisher.js`: wraps `navigator.geolocation.watchPosition`, publishing throttled inserts to `driver_locations` at a **minimum 15-second interval**, only while a shift is active (checklist passed and within work session). |
| FR7.3.4 | New `src/lib/geocode.js`: Nominatim forward geocoding, throttled to 1 request/second, result cached on the booking row (`lat`, `lng`, `geocoded_at`) so each address is geocoded once, ever. |
| FR7.3.5 | New `src/components/LiveMapPanel.jsx`: Leaflet map with live driver markers (10-second poll via TanStack Query), today's job pins, auto-fit bounds. Built standalone; the integrator wires it into `DispatchBoard.jsx` behind a toggle. |
| FR7.3.6 | New `src/components/driver/NavigateButton.jsx`: deep link to `https://www.google.com/maps/dir/?api=1&destination=<lat,lng or encoded address>` — opens the Google Maps app on the driver's phone for turn-by-turn. |
| FR7.3.7 | Driver markers show driver name, truck, and data age; markers older than a staleness threshold render visually distinct (greyed) rather than disappearing. |
| FR7.3.8 | Tracking publishes nothing outside an active shift. No background tracking when the PWA is not foregrounded is *promised* — browser limits apply (see NFR and edge cases). |

### 6.4 Acceptance Criteria

- **AC7.3.1** — Given Tom's shift is active and he granted location permission, When he drives, Then `driver_locations` receives rows at ≥15-second spacing, and within ~10 seconds of each insert the dispatch map marker moves.
- **AC7.3.2** — Given two active drivers and six geocoded jobs today, When the dispatcher opens the map panel, Then both driver markers and all six pins render and the map auto-fits to contain them.
- **AC7.3.3** — Given a job with cached `lat`/`lng`, When the driver taps Navigate, Then Google Maps opens with that destination preloaded (app on mobile, web fallback otherwise).
- **AC7.3.4** — Given a booking address not yet geocoded, When it is scheduled for today, Then geocoding runs (≤1 req/s), persists `lat`/`lng`/`geocoded_at` on the booking, and never repeats for that booking.
- **AC7.3.5** — Given Tom ends his shift, When he keeps driving home, Then zero further rows are written to `driver_locations`.
- **AC7.3.6** — Given a driver's last fix is older than the staleness threshold, When the map renders, Then the marker shows greyed with "last seen X min ago" rather than displaying as live.

### 6.5 Edge Cases

- **GPS permission denied / offline driver:** If `watchPosition` errors with permission denied, the driver app shows a one-time, non-blocking explanation of why tracking is on during shifts (see NFR7.3 privacy) and how to enable it; **jobs are never blocked by missing GPS** — the business continues, the map just goes blind for that driver. The dispatcher sees the driver as "no signal" (greyed, last-seen timestamp or "never"). If the driver goes offline (Hampton Park's mobile black spots are real), inserts fail silently and the publisher resumes when connectivity returns; this release does **not** queue missed location points for replay (offline-first sync is out of scope, §12) — gaps in the trail are accepted and visible as data-age on the marker.
- **Address fails geocoding:** Nominatim returns no result, an ambiguous result, or a result outside greater Melbourne (sanity bounding box). The booking keeps `lat = NULL`, the job appears on the dispatch board with a "no map pin — check address" badge instead of a pin, and the Navigate button falls back to passing the **raw address text** to the Google Maps deep link (Google's geocoder is better; the driver still gets navigation). Dispatcher can correct the address, which clears `geocoded_at` and re-queues geocoding. Geocoding failure must never block booking creation, assignment, or job start.
- **Job cancelled mid-route (map dimension):** The pin is removed from the map on next poll; the driver's published positions remain in `driver_locations` (with the now-cancelled `booking_id`) for cost reconstruction.
- **Phone locked / PWA backgrounded:** Mobile browsers throttle or suspend `watchPosition` for backgrounded PWAs. Expected behaviour: position gaps while the phone is pocketed, burst on resume. Markers display data age so dispatch never mistakes a stale fix for a live one. A native wrapper with true background location is explicitly **not** in this release.
- **Two trucks, one driver:** the location row carries the `truck_id` from the driver's current job context; during a swap the marker may briefly show the previous truck label until the next job starts — cosmetic, documented.

---

## 7. R4 — Load Tracking & Tip-or-Return Decision Engine

### 7.1 Problem Statement

After a pickup, the highest-leverage cost decision of the day happens in the driver's head with zero data: *tip this load nearby and run the next job, or haul it back to Seaford?* Wrong calls bleed money three ways — deadhead kilometres, driver hours, and missed recycling credits — and nobody can even quantify the bleed because the system doesn't know what's on which truck. There is no load tracking, no tip site data, and no cost model in the codebase today. v7 introduces `truck_loads` (what's on each truck right now), `tip_sites` (where it can go, at what rate, for which waste types), and a transparent ranking function that prices each option in dollars.

### 7.2 User Stories

- **As a driver**, after marking a pickup complete I want a ranked list — "Tip at Frankston RRRC then go to job 4: ~$96" vs "Return to base: ~$143" — so the best call is obvious and I'm not guessing.
- **As a driver**, I want to record where I actually tipped and whether the load was recycled, in two taps, so the data trail matches reality.
- **As Jake (fleet manager)**, I want to see current load per truck (bin size, waste type, est. weight, loaded since when), so redeployment decisions and EPA waste-stream reporting come from data.
- **As Mark (owner)**, I want the decision costed from **my** numbers — fuel rate, driver rate, tip rates, recycling credits — editable in the rules engine, so the engine reflects this business, not a textbook.
- **As a dispatcher**, I want to know a truck is loaded with asbestos before I assign it the next pickup, so sequencing respects what's physically on the tray.
- **As Sarah (bookkeeper)**, I want tip events (site, waste type, recycled flag) recorded per load, so tip invoices arriving from sites can be verified against what we actually tipped.
- **As a customer**, I get indirect benefit: trucks that tip nearby get to my job sooner, and recycling credits flow into pricing that stays competitive.

### 7.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.4.1 | Migration 025 creates `tip_sites` (name, lat, lng, address, `rates_per_tonne` jsonb keyed by waste_type, `recycling_credit_per_tonne` jsonb, `accepted_waste_types text[]`, opening_hours, is_active), seeded with 4 Melbourne SE sites — Frankston RRRC, Hampton Park, Clayton, Mornington — with **placeholder rates explicitly flagged for Mark to correct** before decisions are trusted. |
| FR7.4.2 | Migration 025 creates `truck_loads` (truck_id, driver_id, booking_id, bin_size, waste_type, est_weight_t, loaded_at, tipped_at, tip_site_id, recycled boolean). A load row is created at pickup completion; `tipped_at`/`tip_site_id`/`recycled` close it out. |
| FR7.4.3 | New `src/lib/tipDecision.js` — a **pure function** with unit tests (`tipDecision.test.js`). Options generated: {tip at site S, then proceed to next job J} for each eligible site, vs {return to base}. Cost model: `km × fuel_rate + hours × driver_rate + tip_fee − recycling_credit + delay_penalty` for queued jobs. Distances are Haversine (straight-line) — a documented approximation, not road distance. |
| FR7.4.4 | All rates and thresholds (fuel_cost_per_km, driver_cost_per_hour, tip_search_radius_km, redeploy_bin_savings_min) come from the rules engine (R6), with hardcoded fallbacks so the screen never breaks on empty tables. |
| FR7.4.5 | New `src/components/driver/TipDecisionScreen.jsx`: post-pickup ranked options with dollar figures and the cost breakdown per option (the driver must be able to see *why*, or trust dies on day one). Built standalone; integrator wires the entry point into `driver/JobCard.jsx`. |
| FR7.4.6 | New `src/api/tipSites.js`: tip site CRUD and current-load helpers. |
| FR7.4.7 | The recommendation is **advisory**: the driver can pick any option (or "other"), and the actual choice is what gets recorded. Variance between recommended and actual feeds R7's efficiency mining. |
| FR7.4.8 | Sites whose `accepted_waste_types` excludes the load's waste type, or `is_active = false`, are excluded from options for that load. |

### 7.4 Acceptance Criteria

- **AC7.4.1** — Given Tom completes a pickup of 6m³ general waste with three queued jobs, When the tip decision screen opens, Then it shows ranked options with dollar costs, each expandable to its km / hours / fee / credit breakdown.
- **AC7.4.2** — Given the load's waste type is asbestos and only one seeded site accepts asbestos, When options are generated, Then non-accepting sites are absent from the list.
- **AC7.4.3** — Given Mark changes `fuel_cost_per_km` from 0.68 to 0.80 in the rules engine, When the next decision runs, Then costs reflect the new rate with no deploy.
- **AC7.4.4** — Given Tom selects "Tip at Hampton Park", When he confirms, Then the `truck_loads` row gets `tipped_at`, `tip_site_id`, and the recycled flag he set, and the truck's current-load view shows empty.
- **AC7.4.5** — Given `tipDecision.js` test suite, When `npx vitest` runs, Then the ranking function passes its unit tests (cost arithmetic, waste-type filtering, empty-sites fallback).

### 7.5 Edge Cases

- **No tip site accepts the waste type:** e.g. contaminated soil and none of the 4 seeded sites accept it. The decision screen shows only "Return to base" plus an explicit notice — "No tip site within radius accepts *contaminated soil*. Returning to base. Flag for Jake." — and writes nothing misleading. Jake gets the signal to add a site (or correct `accepted_waste_types` on an existing one) via tip site CRUD. The engine must never silently route a load to a site that won't take it; a rejected truck at a weighbridge is the most expensive outcome of all.
- **Empty/placeholder tip site data:** Rates are seeded placeholders (FR7.4.1). Until Mark corrects them, the screen carries a persistent "rates unverified" caution chip. Hardcoded fallback pattern applies: empty `tip_sites` table ⇒ "Return to base" is the only option, screen never crashes.
- **Job cancelled mid-route with a load on the truck:** The load row persists (the waste is physically on the tray regardless of booking status). The decision screen can be reopened from the truck's current load — the tip decision belongs to the *load*, not the cancelled job.
- **Two trucks, one driver:** loads key on `truck_id`, so a driver swapping trucks sees the correct per-truck load. A driver cannot close out a load on a truck they're not currently associated with via an active job (guard in current-load helpers).
- **Sites closed (opening_hours):** stored and displayed on the option card; tonight's MVP displays hours but does not hard-exclude by current time (time-window exclusion is next sprint — opening-hours data quality is unverified).
- **Haversine vs reality:** straight-line distance understates road distance, especially across the Peninsula. Documented in-code and on-screen ("distances approximate"). If two options are within ~10% of each other, the screen says "too close to call — driver's judgment" rather than implying false precision.

---

## 8. R5 — AI Bin-Photo Waste Audit & Billing Adjustment

### 8.1 Problem Statement

Customers book "general waste" and fill the bin with soil, rubble, or worse. Misdeclared loads cost Binned-IT twice: tip fees per tonne for heavy waste run far above the general-waste rate the customer paid, and a hazardous surprise (asbestos sheet under green waste) is a safety and EPA incident. Today the photo pipeline exists — `PhotoCapture.jsx` uploads to the `job-photos` bucket (G6) — but nobody and nothing looks at the photos. PRD v6 parked AI content checking in Phase 4. v7 ships it: Claude vision classifies the photographed contents, compares against the declared waste type, and when they don't match, drafts a billing adjustment for office approval. Critically, per the standing constraint (G9): **adjustments are internal records — nothing is pushed to Xero.**

### 8.2 User Stories

- **As a driver**, I want to photograph the bin at collection exactly as I do today and have the AI verdict appear in seconds, so flagging a dodgy load takes zero extra effort and the awkward conversation shifts from me to the office.
- **As a dispatcher**, I want mismatch flags visible on the job card, so I know a job has a billing question before the customer calls.
- **As Mark (owner)**, I want to approve or reject every AI-suggested adjustment myself (or via manager role), so a model never bills a customer unilaterally.
- **As Sarah (bookkeeper)**, I want an audit queue with the photo, the AI's reasoning, declared vs detected waste type, and a suggested dollar amount, so processing an adjustment takes one minute and the paper trail survives a dispute.
- **As Jake (fleet manager)**, I want hazardous detections (asbestos suspicion) flagged loudly and immediately, because that's a stop-work safety issue, not a billing issue.
- **As a customer**, if I'm billed an adjustment I want the evidence — photo, what was declared, what was found — so the charge is demonstrably fair and disputable through a human.

### 8.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.5.1 | New `api/analyze-bin-photo.js` Vercel function, auth via Supabase JWT following the `api/chat.js` proxy pattern (G7). Input: `booking_id` + image (base64). Calls Claude vision; returns strict JSON: `{detected_waste_types, dominant_type, est_density_class, matches_declared, confidence, rationale}`. |
| FR7.5.2 | Migration 024 creates `waste_audits` (the AI result per photo per booking) and `billing_adjustments` (booking_id, amount, reason, status `draft/approved/rejected/applied`, created_by, approved_by) with RLS: drivers insert audits; owner/manager approve adjustments. **No code path touches Xero.** |
| FR7.5.3 | `PhotoCapture.jsx` + `driver/JobCard.jsx`: the collection photo triggers analysis and shows the result inline. A mismatch creates a flag plus a *suggested* adjustment in `draft` for office review — never auto-applied. |
| FR7.5.4 | New `src/components/WasteAuditPanel.jsx`: the office review queue — photo, declared vs detected, confidence, rationale, suggested amount; Approve / Reject actions (owner/manager). Built standalone; integrator wires the route. |
| FR7.5.5 | New `src/api/wasteAudit.js` client data access. |
| FR7.5.6 | Adjustment lifecycle: `draft` → `approved`/`rejected` → `applied` (applied = Sarah has actioned it in the real invoicing process by hand; the status records that fact). The `adjustment_requires_approval` rule (R6, default `true`) governs whether drafts can ever skip review — shipped `true` and expected to stay `true`. |
| FR7.5.7 | The threshold at which a detected-vs-declared weight/density discrepancy generates a draft adjustment reads `weight_overage_threshold_pct` (default 15) from the rules engine. |
| FR7.5.8 | Analysis failure (API down, key missing, timeout) degrades gracefully: photo upload still succeeds exactly as today; audit row records the failure; job completion is never blocked by AI availability. |

### 8.4 Acceptance Criteria

- **AC7.5.1** — Given a booking declared "green waste" and a photo showing concrete rubble, When the driver captures the photo, Then a `waste_audits` row records the mismatch with confidence and rationale, the job card shows the flag, and a `draft` billing adjustment appears in the office queue.
- **AC7.5.2** — Given a declared "general waste" photo the model agrees with at high confidence, When analysis returns, Then the audit records `matches_declared = true` and **no** adjustment draft is created.
- **AC7.5.3** — Given a draft adjustment, When Mark approves it, Then status becomes `approved` with `approved_by` set — and no Xero API call occurs anywhere in the flow (verifiable: no Xero client import in any v7 file).
- **AC7.5.4** — Given a driver-role user, When they attempt to approve an adjustment, Then RLS rejects the write.
- **AC7.5.5** — Given the Anthropic API is unreachable, When the driver photographs the bin, Then the photo uploads, the UI shows "analysis unavailable — flagged for manual review", and the driver can complete the job.

### 8.5 Edge Cases

- **AI low-confidence classification:** Below a confidence floor, the system does **not** create an adjustment draft and does not assert a verdict to the driver. The audit row is stored with status "low confidence — manual review", surfaced in the WasteAuditPanel under a separate "needs human eyes" filter. Rationale: a wrong confident flag costs a customer relationship; a shy model costs one minute of Sarah's time. Tuning the floor is a rules-engine candidate for next sprint; tonight it ships as a sensible constant documented in `api/analyze-bin-photo.js`.
- **Customer disputes an adjustment:** The dispute is handled by humans, armed by the system: Sarah opens the audit record showing the timestamped photo, declared type, detected type, confidence, and rationale, and can share the photo with the customer. If the business concedes, the adjustment is set to `rejected` with a reason note — the history is never deleted (mirrors the immutable-trail convention of the collections engine, PRD v6 §15.1). Because nothing was pushed to Xero (G9), there is no credit-note unwind: a rejected internal adjustment simply never gets applied. This is a deliberate benefit of the read-only stance during POC.
- **Photo quality defeats the model** (night pickup, rain on lens, tarp half-on): expected outcome is the low-confidence path, never a forced guess. Driver can capture additional photos; each gets its own audit row against the booking.
- **Hazardous material suspected** (asbestos-like sheeting): `detected_waste_types` includes the hazard, the job card flag renders in the danger style, and Jake's review is expected before tipping. v7 does not block job actions on hazard detection (false-positive risk is unquantified on day one); hard-blocking is a next-sprint decision once precision is measured.
- **Job cancelled after photo taken:** audit rows and any draft adjustment persist against the cancelled booking; office can still pursue a charge if the bin was contaminated before cancellation.
- **Duplicate analysis** (driver retakes photo): each photo gets one audit row; the panel groups by booking so Sarah sees the set, and only one adjustment draft exists per booking at a time (subsequent mismatches update the open draft rather than stacking duplicates).

---

## 9. R6 — Management-Editable Business Rules Engine

### 9.1 Problem Statement

Every number that drives an operational decision tonight — fuel cost per km, driver hourly cost, tip search radius, overage thresholds — would otherwise be a constant in a JS file, changeable only by a deploy. Mark runs a business where diesel moved 18% in a quarter and tip rates change with a phone call. He needs to turn the knobs himself. Just as important: R2's blocking behaviour and R5's approval requirement are *policies*, and policies need an owner-editable switch with an audit trail, or the first operational emergency gets "fixed" by a hasty code change at 6am.

### 9.2 User Stories

- **As Mark (owner)**, I want to edit fuel rate, driver rate, thresholds, and policy toggles in a settings page grouped by category, so the system runs on today's numbers without waiting for a developer.
- **As Mark (owner)**, I want to see who changed which rule, when, from what to what, so a weird tip recommendation can be traced to "Jake halved the search radius on Tuesday".
- **As Jake (fleet manager)**, I want to adjust operational rules like `tip_search_radius_km` and `max_jobs_per_truck_day` (manager role), so day-to-day tuning doesn't require Mark.
- **As Sarah (bookkeeper)**, I want `adjustment_requires_approval` visibly **on**, so I can tell an auditor that no AI-generated charge reaches a customer without human sign-off.
- **As a dispatcher**, I want rule changes to take effect on the next calculation without anyone redeploying, so the board reflects reality immediately.
- **As a driver**, I want tip recommendations to reflect the rates management actually set — and if `checklist_block_shift` policy changes, the app behaviour follows it the same morning.
- **As a customer**, I benefit from `adjustment_requires_approval` being policy-enforced: no machine ever adjusts my bill on its own.

### 9.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.6.1 | Migration 026 creates `business_rules` (`rule_key` unique, category ∈ routing/tipping/billing/safety/pricing/dispatch, name, description, `value` jsonb, value_type, enabled, updated_by, updated_at) and `business_rule_history` (audit table populated by trigger on every change). |
| FR7.6.2 | Seed rules: `fuel_cost_per_km` 0.68, `driver_cost_per_hour` 45, `tip_search_radius_km` 25, `checklist_block_shift` true, `weight_overage_threshold_pct` 15, `adjustment_requires_approval` true, `max_jobs_per_truck_day` 8, `redeploy_bin_savings_min` 25. |
| FR7.6.3 | New `src/hooks/useRules.js` with a `getRule(key)` helper that falls back to hardcoded defaults when the table is empty/unavailable — consumers (tipDecision, checklist gate, waste audit) never crash on a missing rule. |
| FR7.6.4 | New `src/components/RulesEnginePage.jsx`: rules grouped by category; edit value, enable/disable toggle, per-rule change history. Owner/manager only. Integrator wires the `/rules` route and role-gated nav entry. |
| FR7.6.5 | New `src/api/rules.js` data access. |
| FR7.6.6 | Rule reads are live (TanStack Query): a change applies to the next computation that reads it; no caching beyond the standard query staleness, no deploy. |
| FR7.6.7 | Value editing validates against `value_type` (number/boolean/string/json) before save; numeric rules reject non-numeric input client-side. |

### 9.4 Acceptance Criteria

- **AC7.6.1** — Given Mark on `/rules`, When he changes `driver_cost_per_hour` from 45 to 52 and saves, Then the rule updates, a history row records old value, new value, who, and when, and the next tip decision uses 52.
- **AC7.6.2** — Given Sarah (bookkeeper) navigates to `/rules`, Then access is denied by role gate (owner/manager only).
- **AC7.6.3** — Given the `business_rules` table is empty (fresh environment), When the tip decision engine runs, Then it uses hardcoded defaults and renders without error.
- **AC7.6.4** — Given Mark toggles `checklist_block_shift` to false, When a driver with a failed checklist opens the job queue, Then start actions are warned-but-allowed rather than blocked, on next app query refresh.
- **AC7.6.5** — Given any rule edit, When the history view for that rule opens, Then every change ever made to it is listed newest-first.

### 9.5 Edge Cases

- **Nonsense values:** `fuel_cost_per_km = 0` or negative passes type validation but poisons every tip decision. MVP guards: numeric type-check plus per-rule sane-range hints displayed in the UI; full min/max hard validation per rule is next sprint. The audit history makes any poisoning traceable and reversible in seconds.
- **Rule disabled vs rule missing:** `enabled = false` means consumers treat it as absent and fall back to the hardcoded default — identical behaviour to an empty table, one code path, tested in `useRules`.
- **Concurrent edits:** last-write-wins on the row; both writes appear in history. Acceptable at a 2-editor company; optimistic locking is not warranted.
- **Driver disputes a checklist block traced to policy** (cross-ref R2 edge): the rules history shows exactly when `checklist_block_shift` was on, supporting any fair-work conversation about a blocked shift.

---

## 10. R7 — AI Cost-Efficiency Analyst

### 10.1 Problem Statement

The Hub now accumulates rich operational exhaust — job costs, tip fees by site, fuel estimates vs actuals, recycling rates, booking pipeline — but insight extraction is manual: Mark notices things, or he doesn't. v6's weekly digest cron exists but is financial-report-centric. R7 embeds a recurring AI analyst that mines the operational tables for concrete, dollar-quantified efficiency opportunities ("Hampton Park's green-waste rate has been 22% above Frankston for 3 weeks — est. $410/month") and persists them as actionable, dismissible insights rather than a wall of prose.

### 10.2 User Stories

- **As Mark (owner)**, I want a daily-refreshed list of efficiency findings with estimated dollar savings and confidence, so the highest-value action each week is obvious.
- **As Mark (owner)**, I want to mark insights actioned or dismissed, so the list stays a to-do queue, not a museum.
- **As Jake (fleet manager)**, I want fleet-flavoured findings (fuel variance by truck, tip-site rate drift, deadhead patterns), so maintenance and routing fixes are data-driven.
- **As Sarah (bookkeeper)**, I want cost-variance findings cross-referencing what I see in Xero reads, so month-end surprises shrink.
- **As a dispatcher**, I want dispatch-relevant insights (e.g. consistently under-filled truck days vs `max_jobs_per_truck_day`), so scheduling tightens over time.
- **As a driver**, my recorded decisions (actual tip choice vs recommended, R4) feed the analysis — no extra driver-facing UI in this release.
- **As a customer**, lower operating cost defends pricing — indirect benefit, no customer-facing surface.

### 10.3 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR7.7.1 | New `api/efficiency-insights.js`: service-role queries over cost variances, tip fees by site, fuel actual vs estimated, pipeline bookings, and recycling rates; sends the aggregate to Claude (proxy pattern per G7); parses structured insights; stores rows in `ai_insights`. |
| FR7.7.2 | Migration 027 creates `ai_insights` (category, title, detail, est_saving_aud, confidence, status `new/actioned/dismissed`, period, created_at) with RLS. |
| FR7.7.3 | `src/components/AIInsightsPanel.jsx` (existing component) gains an "Operational Efficiency" section listing insights with status controls, plus an on-demand refresh button that invokes the endpoint. |
| FR7.7.4 | Vercel cron triggers `/api/efficiency-insights` daily at 19:00 UTC (≈ 05:00 Melbourne — fresh before Mark's yard walk). The cron entry is added to `vercel.json` by the integrator (single owner of that file, alongside the 4 existing crons). |
| FR7.7.5 | Insights are advisory text + numbers only. The analyst **never** mutates operational data, rules, prices, or bookings — read-only analysis, write-only to `ai_insights`. |
| FR7.7.6 | Early-life behaviour: with thin data (the new tables are hours old at launch), the endpoint instructs the model to report "insufficient data" per category honestly rather than hallucinate savings; such runs store nothing or a single low-confidence note. |

### 10.4 Acceptance Criteria

- **AC7.7.1** — Given operational data exists for the period, When the cron (or refresh button) fires, Then new `ai_insights` rows appear with category, title, detail, `est_saving_aud`, and confidence, and render in the Operational Efficiency section.
- **AC7.7.2** — Given an insight Mark has dealt with, When he marks it actioned, Then it leaves the "new" list and persists with status `actioned`.
- **AC7.7.3** — Given near-empty operational tables, When the endpoint runs, Then it does not fabricate findings — zero or explicitly low-confidence "insufficient data" output.
- **AC7.7.4** — Given the panel loads while `ai_insights` is empty or Supabase is unavailable, Then the section renders an empty state (hardcoded-fallback convention), never an error screen.
- **AC7.7.5** — Given any insight run completes, Then no row in any table other than `ai_insights` was written by it.

### 10.5 Edge Cases

- **Model proposes nonsense or duplicate findings:** insights are versioned by period; the panel shows newest period by default. Dismissed insights stay dismissed (status survives re-runs for the same period; the prompt includes recent titles to discourage repeats — best-effort, with dedupe-by-similarity as a next-sprint refinement).
- **API key absent/exhausted:** the run logs and exits; yesterday's insights remain visible; the refresh button surfaces the error to Mark (who manages keys at runtime via `platform_settings`, PRD v6 §15.3).
- **Cost control:** one scheduled run/day plus manual refreshes; the endpoint aggregates server-side and sends summaries, not raw row dumps, to the model.

---

## 11. Non-Functional Requirements

### NFR7.1 — Battery use for full-shift GPS tracking (R3)

A driver's phone must end a 10-hour shift alive. Requirements:

- Location publishing is throttled to a **minimum 15-second interval** between inserts (FR7.3.3) regardless of how often `watchPosition` fires.
- `watchPosition` is requested with settings that favour the device's existing GPS duty cycle (the phone is already navigating via Google Maps most of the shift; we piggyback, not duplicate).
- Publishing runs **only during an active shift** — never evenings, weekends, or before the checklist gate opens.
- The driver app must not hold a wake lock; backgrounded throttling by the OS is accepted (gaps over dead batteries).
- Acceptance: on a representative mid-range Android phone, the SkipSync PWA's attributable battery share over an 8-hour shift with normal use is the target of the first week's field check with Tom and Dave; if drivers report battery pain, the publish interval is the first knob (rules-engine candidate next sprint).

### NFR7.2 — Photo upload on poor reception (R5)

Bin photos are taken in driveways, building sites, and the Peninsula's black spots.

- Upload to the `job-photos` bucket retries transient failures; the UI distinguishes "uploading…" from "failed — tap to retry" and never silently drops a photo.
- AI analysis is **decoupled** from upload: if upload succeeds but analysis can't run (no data for the API round-trip), the audit completes later from the office side or on driver retry; job completion is never held hostage to bandwidth (FR7.5.8).
- Photos are captured at a resolution adequate for classification, not full sensor resolution — uploads must be feasible on one bar of 4G.
- True offline capture-now-upload-later queueing is **not** in this release (offline-first sync is out of scope, §12; the Sprint 12 offline write-queue library exists but its wiring remains partial and is untouched tonight).

### NFR7.3 — Privacy & consent for driver location tracking (AU law)

Continuous GPS tracking of employees is lawful in Victoria but regulated. v7's stance:

- **Transparency and notice:** Drivers are informed in writing before tracking begins — what is collected (position, heading, speed, accuracy, timestamps), when (active shift only), why (dispatch, customer ETAs, job costing), who can see it (authenticated staff), and retention. Under the Surveillance Devices Act 1999 (Vic), tracking a vehicle/person requires express or implied consent — the written notice plus signed acknowledgment provides it. Mark to have the one-page notice reviewed alongside the existing legal-templates solicitor review (PRD v6 Appendix C).
- **Shift-bounded collection:** technically enforced (FR7.3.8/NFR7.1) — no off-shift collection, which is the bright line in every AU workplace-surveillance guidance.
- **Purpose limitation:** location data is used for operations and costing, not covert performance surveillance; speed data is stored for route/cost analysis and is not wired to any disciplinary alerting in this release.
- **Access control & retention:** `driver_locations` RLS restricts inserts to the driver's own rows; reads to authenticated staff. A retention/aggregation policy (e.g. thin raw points after 90 days) is a next-sprint migration once volumes are real.
- **APP alignment:** Binned-IT may sit under the small-business threshold of the Privacy Act 1988 (Cth), but the system is built to Australian Privacy Principles standards anyway (collection minimisation, purpose limitation, access control) — cheaper than retrofitting if the exemption ever falls away.

### NFR7.4 — Nominatim usage policy compliance (R3)

Geocoding uses the public OSM Nominatim service, which has a strict usage policy:

- **Max 1 request/second**, enforced in `src/lib/geocode.js` (FR7.3.4) — requests are queued, never parallel.
- **Cache aggressively:** results persist on the booking row (`lat`,`lng`,`geocoded_at`); an address is geocoded once per booking, ever. No bulk re-geocoding jobs.
- **Identify ourselves:** requests send a descriptive User-Agent/Referer identifying SkipSync per policy.
- **Attribution:** the Leaflet map displays OpenStreetMap attribution (default control, must not be removed).
- **Scale plan:** at ~80 bookings/week, volume is trivially within policy. If volume grows 10×, we move to a self-hosted Nominatim or a paid geocoder *before* hitting limits — noted in the risk register (§15).

### NFR7.5 — Release-wide engineering constraints (carried from the implementation plan)

- Inline CSS only with `B.*` theme tokens; no TypeScript; **no new npm deps** beyond `leaflet` + `react-leaflet@^4` (WP-C only).
- Hardcoded-fallback pattern everywhere: every new screen renders sanely on empty/missing tables.
- All 6 new migrations idempotent; RLS on every new table; the Xero write path is untouched by any v7 file.
- Each work package compiles standalone (`npm run build` 0 errors); vitest green; Playwright smoke at desktop (1440×900) and mobile (390×844) before push.

---

## 12. Out of Scope for This Release

Explicitly **not** being built in v7. These are decisions, not omissions — reviewers should reject any PR that smuggles them in.

| Item | Why out | What we do instead |
|------|---------|--------------------|
| **In-app turn-by-turn routing engine** | Building/licensing a routing engine (Mapbox/Google Directions/OSRM) is weeks of work and ongoing cost; drivers already trust Google Maps | `NavigateButton.jsx` deep-links to Google Maps directions (`?api=1&destination=…`) — the standard handoff used by production driver apps. The embedded map (Leaflet/OSM) is for *situational awareness*, not navigation. |
| **Xero write-back of billing adjustments** | Standing constraint: Xero is read-only until Mark validates writes in the POC; the `XERO_WRITE_ENABLED` kill-switch stays false (G9) | `billing_adjustments` are internal records with a full approval lifecycle. Sarah applies approved adjustments through the existing manual invoicing process; the `applied` status records that she did. |
| **Offline-first sync** | The Sprint 12 offline write-queue library exists but full wiring is a project of its own; doing it badly corrupts data | Online-required for live features; graceful degradation everywhere (GPS gaps accepted, photo retry UI, AI analysis deferred). The queue library is not extended tonight. |
| Per-truck-swap mid-day checklist enforcement | Needs truck-change detection that doesn't exist yet | Checklist recorded against starting truck; gap documented (§5.5), next sprint |
| Tip-site opening-hours hard exclusion | Hours data quality unverified | Hours displayed on option cards; driver judgment (§7.5) |
| Hazard-detection hard job blocking | False-positive rate unknown on day one | Loud advisory flag + Jake review (§8.5) |
| Customer-facing live tracking link ("watch your driver") | Privacy + scope | Dispatcher relays ETA from the live map |
| Native mobile app / true background GPS | PWA constraints accepted for MVP | Data-age shown on markers; gaps tolerated |

---

## 13. Phased Rollout

### 13.1 Tonight's MVP (overnight build, 10–11 June 2026)

Work packages WP-A through WP-G built in parallel with **exclusive file ownership** per package, then a single integration pass (routes `/rules` + waste audit, LiveMapPanel into DispatchBoard, NavigateButton + TipDecisionScreen into driver JobCard, useLocationPublisher into DriverApp, vercel.json cron). Migrations 022–027 applied in order.

Shipping tonight:

1. **R1 full** — driver role, driver/truck/date assignment in dispatch, unassigned chips, driver-filtered queues.
2. **R2 full** — hard checklist gate end-to-end (UI + DriverApp + JobQueue + API guard), defect-with-note on failure, `checklist_block_shift` rule hook.
3. **R3 core** — `driver_locations` + publisher (15s throttle, shift-bounded), Leaflet live map panel with driver markers + job pins, Nominatim geocoding with on-booking caching, Google Maps deep-link navigation.
4. **R5 core** — Claude vision analysis endpoint, waste_audits + billing_adjustments with RLS and approval lifecycle, driver-side result display, office WasteAuditPanel review queue. Internal-only adjustments (no Xero).
5. **R4 core** — tip_sites (4 seeded SE Melbourne sites, placeholder rates flagged), truck_loads, pure tested `tipDecision.js`, advisory TipDecisionScreen.
6. **R6 full** — business_rules + history + trigger, 8 seed rules, `/rules` management page (owner/manager), `useRules` with fallbacks.
7. **R7 core** — efficiency-insights endpoint + `ai_insights` + panel section + daily 19:00 UTC cron, honest empty-data behaviour.

Exit criteria: `npm run build` 0 errors; vitest green (incl. new `tipDecision.test.js`); Playwright smoke desktop + mobile; all migrations applied idempotently; manual UAT pass by Mark against AC7.1.1–AC7.7.5.

**Morning-after operator tasks (Mark/Jake, not code):** assign `driver` role to Tom/Dave's profiles; correct placeholder tip-site rates; sign driver tracking-consent notices before first tracked shift; sanity-check the 8 seeded rule values.

### 13.2 Next Sprint (Sprint 17)

Hardening and the deliberate gaps, in priority order:

1. **Driver tracking consent capture in-app** (acknowledgment screen + stored consent record) and `driver_locations` retention policy migration.
2. **Defect workflow UI** for Jake (open defects queue, resolution notes, link to fleet_assets) — completes the R2 dispute path.
3. **Adjustment → customer communication**: templated email (Resend, already integrated) attaching the audit photo and evidence when an adjustment is approved; dispute-handling notes field.
4. **Geocoding repair tooling**: dispatcher address-correction flow with re-geocode, bulk view of "no pin" bookings.
5. **Tip engine v1.1**: opening-hours exclusion, road-distance correction factor learned from actuals, confidence-floor and publish-interval moved into the rules engine, recommended-vs-actual variance report feeding R7.
6. **Rules engine validation**: per-rule min/max hard ranges; "assigned to inactive driver" dispatch warning.
7. **Checklist per truck-swap** once truck-change detection exists (driver selects truck at job start).
8. **AI insight dedupe-by-similarity** and weekly digest cross-link.
9. **Xero adjustment write-back POC** — only if Mark green-lights after validating internal adjustments for a full billing cycle, and only behind `XERO_WRITE_ENABLED`.

---

## 14. Success Metrics

Baselines captured in week 1 post-launch (the system itself now produces these numbers — most were unmeasurable before v7). Review cadence: weekly with Mark for the first month, then monthly.

| Metric | Definition / Source | Baseline | Target (90 days) |
|--------|---------------------|----------|------------------|
| **Cost per job** | (fuel est. from km × `fuel_cost_per_km` + driver hrs × `driver_cost_per_hour` + tip fees − recycling credits) / completed jobs; sourced from `truck_loads`, `driver_locations` trail, tip records, rules-engine rates | Establish week 1 (est. range from JobCostingWidget history) | −10% vs baseline |
| **Tip fee per tonne** | Σ tip fees / Σ `est_weight_t` across closed `truck_loads`, segmented by waste type and site | Establish week 1 (placeholder rates corrected first) | −8% via site selection driven by the tip engine |
| **% misdeclared loads caught** | Bookings with a confirmed (approved-adjustment or office-confirmed) mismatch ÷ total audited collections; from `waste_audits` + `billing_adjustments` | 0% (nothing is caught today) | ≥80% of misdeclared loads flagged at collection; adjustment revenue recovered ≥ $1,500/quarter |
| **Deadhead km reduction** | Non-revenue km (post-tip and return legs, reconstructed from `driver_locations` between job completion and next job start) ÷ total km | Establish weeks 1–2 from GPS trail | −15% vs baseline |
| *Supporting:* checklist completion integrity | % of shift-days with a genuine passed checklist before first job start | ~0% genuine (pencil-whip era) | 100% structurally enforced; <5% of mornings blocked >15 min |
| *Supporting:* dispatch assignment coverage | % of scheduled jobs with `driver_id` set by 17:00 the prior day | 0% (field never written) | ≥95% |
| *Supporting:* insight action rate | `ai_insights` marked actioned ÷ (actioned + dismissed) monthly | n/a | ≥30% actioned with at least one insight ≥$200/mo realised per month |

---

## 15. Risk Register (v7 additions)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Driver pushback on GPS tracking | Medium | High | Shift-bounded collection (technical, not policy), written consent + plain-English notice before first shift, no disciplinary wiring of speed data, Jake champions as he did the driver app |
| Pencil-whipping moves from "Check All" to fast-tapping items | Medium | Medium | Defects require notes; checklist timestamps allow spotting 8-second completions; culture + Jake spot checks — software can't fully solve this |
| Claude vision misclassifies → wrong adjustment drafted | Medium | Medium | Low-confidence floor (no draft below it), 100% human approval (`adjustment_requires_approval=true`), evidence trail for disputes, precision tracked before any hazard-blocking is enabled |
| Placeholder tip rates poison early tip decisions | High (until Mark corrects) | Medium | Persistent "rates unverified" chip on the decision screen; morning-after operator task; engine is advisory only |
| Haversine distance materially wrong on Peninsula routes | Medium | Low | Documented approximation, "too close to call" band, road-distance correction factor next sprint |
| Nominatim rate-limit/block at higher volume | Low | Medium | 1 req/s queue + per-booking caching + UA identification; self-host/paid geocoder trigger documented (NFR7.4) |
| PWA background throttling degrades track quality | High | Low | Accepted by design; data-age on markers prevents false confidence; native wrapper only if dispatch genuinely suffers |
| Battery drain causes drivers to disable location | Medium | Medium | 15s throttle, shift-bounded, week-1 field check with Tom/Dave, interval becomes a rule next sprint |
| Rules engine misconfiguration (e.g. fuel rate 0) | Low | Medium | Type validation + sane-range hints, full audit history, hardcoded fallbacks keep screens alive |
| Parallel overnight build merge conflicts | Medium | High | Exclusive file ownership per WP, pre-assigned migration numbers 022–027, single integrator owns `App.jsx`/`vercel.json`/cross-WP wiring |

---

*End of PRD v7.0*

**Status:** ACTIVE — drives the 10–11 June 2026 overnight build (WP-A–WP-G) and Sprint 17
**Companion document:** `_bmad-output/uat-2026-06-10/implementation-plan.md` (work packages, file ownership, conventions)
**Standing constraints reaffirmed:** Xero read-only until POC (`XERO_WRITE_ENABLED` stays false) · Google Maps deep-link, no in-app routing engine · no offline-first sync this release
**Last Updated:** 10 June 2026
