# SkipSync Agent Registry

> **Activation**: Every working session reads this file (CLAUDE.md points here). It indexes every agent used on this project, their memory locations, and the Journey Board — the single scoreboard for whether the product actually works for its users. The Product Lead (agents/PM.md) owns keeping this current via the closing protocol.

## How agents work on this project

- Each agent is a markdown file: persona + activation contract + domain knowledge + **Learnings Log** (the growing part). Instructions are stable; logs compound.
- **Invoke** an agent by reading its file at the start of the relevant work (or passing its contents as a subagent system prompt). **Close** by appending dated learnings to its log.
- Learning rule: a log entry must state *root cause* and *what changes next run* — not narrative. Consolidate logs >150 lines (PM.md §6.4).

## Index — project agents (agents/)

| Agent | File | Domain | Status |
|---|---|---|---|
| Alex Voss — Product Lead (MAIN) | PM.md | Direction, quality gates, learning loop, this registry | Active |
| Meg Whitfield — Virtual CFO | Accountant.md | Reconciliation, period close, Xero truth | Active (learnings in file §10) |
| Mark — Owner persona | personas/Mark-Owner.md | Settings, roles, reports, AI actions | Active |
| Tracey — Dispatcher persona | personas/Tracey-Dispatcher.md | Dispatch journeys | Active |
| Dave — Driver persona | personas/Dave-Driver.md | Driver app journeys | Active |
| Sarah — Bookkeeper persona | personas/Sarah-Bookkeeper.md | Finance journeys | Active |
| Jake — Fleet manager persona | personas/Jake-FleetManager.md | Fleet/compliance journeys | Active |
| Andrew — Investor persona | personas/Andrew-Investor.md | Investor sandbox | Active |

## Index — BMAD agents & workflows used historically

BMAD module skills were used during the planning/build phases. Their outputs are the contracts later work must honour:

| BMAD agent/skill | Used for | Artefacts |
|---|---|---|
| PM (John) / create-prd | PRD v5 → v7 | PRD-v7.md (current contract) |
| Architect (Winston) / create-architecture | v7 architecture | _bmad-output/uat-2026-06-10/architecture-v7.md |
| UX (Sally) / create-ux-design | v7 UX spec; earlier collections letter | _bmad-output/uat-2026-06-10/ux-spec-v7.md; branch sally-collections-letter |
| Dev (Amelia) / dev-story, quick-dev | Sprint implementation | Sprint commits (see git log "Sprint N") |
| UAT swarm (8 discovery + 6 persona walkthroughs) | UAT Round 1 | _bmad-output/uat-2026-06-10/{uat-round1-report,gap-register,persona-journeys}.md |

When a BMAD skill is invoked, record it here with date + artefact so its outputs stay discoverable.

## Journey Board

P0 journeys. Updated by the Product Lead every session. ✅ pass (date) · ❌ fail (date, cause) · ⬜ untested on current deploy.

| # | Journey | Persona | Status |
|---|---|---|---|
| J1 | Invite a new user with role *driver* → they can sign in | Mark | ✅ 2026-06-12 — invited mark@binned-it.com.au as driver via UI (after domain-allowlist fix), profile role=driver, driver signed in to /driver |
| J2 | Edit a team member's role/details in Team tab and it persists | Mark | ✅ 2026-06-11 — root cause was profiles UPDATE RLS (self-row only); migration 028 fixed; proven live (Andrew viewer→investor persisted through reload) |
| J3 | Create job → assign driver/truck/date → job born/moves to Scheduled | Tracey | ✅ 2026-06-12 — assigned live job to Test Driver (Mark) via panel; pending→scheduled rule fired; driver saw it |
| J4 | Driver day: login → checklist gate → depart/arrive/start/complete with photos | Dave | ✅ 2026-06-12 — FULL chain live, after fixing 3 never-worked P0s: missing vehicle_checklists.passed (029), bookings CHECK lacked en_route/arrived (030), job-photos bucket had no storage policies (031) |
| J5 | Tip-or-Return decision after pickup records a load | Dave | ⬜ engine unit-tested; live blocked on J4 |
| J6 | Invoice → reminder → collections letter chain | Sarah | ⬜ read views verified earlier sprints; not re-proven on current deploy |
| J7 | Waste audit photo → AI verdict → approve adjustment → Sarah actions manually | Jake/Sarah | ⬜ panel empty-state verified 2026-06-11; full chain needs a real photo |
| J8 | Month-end: Xero sync → dashboards reconcile (Meg sign-off) | Meg | ✅ 2026-05-08 live recon tied to Xero; re-run after next sync |
| J9 | Investor opens /investor: cash-only, no operational access via URL-hacking | Andrew | ✅ 2026-06-12 — assessment found investor JWT could WRITE bookings + READ PII at the DB layer (route guard alone was insufficient); migration 032 closed it, verified live: investor PATCH booking + customer read both denied (0 rows) |
| J10 | AI chat: "how do I…" answer + live tool action with visible audit chips | Mark | ✅ 2026-06-16 deep-link/screenshot extension LIVE-VERIFIED both viewports (Mark): links SPA-navigate, panel closes on mobile, screenshots render — after fixing broken screenshots (see below). Prior: ✅ 2026-06-11 SSE fix |
| J11 | Public booking → confirmation SMS/email → appears in CRM/dispatch | Customer→Tracey | ⬜ verified in earlier sprint; not re-proven on current deploy |

**Pass-rate: 7/11 proven on current deploy** (J9 added 2026-06-12 via full-system assessment + security lockdown). J2 hardened (route guards + DB self-escalation block). Remaining unproven: J5 tip-or-return, J6 collections chain, J7 waste-audit chain, J11 public booking — all need a live data-bearing run.

## Assessment 2026-06-12 (7-agent fleet) — see _bmad-output/assessment-2026-06-12/triage.md
Fixed & deployed this session: migration 032 (RLS lockdown — investor/viewer write+PII-read denied, fleet_manager added to office policies, notifications/audit_log/certs/insurance get real policies), 033 (seed fleet_assets — trucks SS-01/02/03), route guards on /settings*, Rules Engine fleet_manager content gate, Collections fake-debtor honesty, notification writer payload fixes. Mobile: PWA install-ready + TWA APK recipe in android-apk/.
Carried to next sessions (triage.md Wave 3): notify-booking not wired to status change, no cancel-booking UI, cash/accrual toggle cosmetic (no accrual data), dashboard 5/12 tabs show demo data (banner deferred), R7 efficiency UI unreachable, bin_types empty, Compare==Prices, About stale metadata. Process: make the DB-contract sweep a recurring gate. That number is the honest baseline Mark called "~25% effective". It rises only via persona-run proof.

## Session 2026-06-16 (live persona verification of the 06-13 handover + screenshot fix)
New device, fresh pull (only package-lock changed). Live-verified the handover work as the Mark persona, both viewports.
- **J10 deep links/screenshots — now PASS (both viewports).** Found a P1 at verification: every `/help/*.png` chat screenshot was a broken image on prod — the 5 PNGs in `public/help/` were never committed because `.gitignore` line 41 is a blanket `*.png` that silently swallowed them; on prod they fell through the SPA catch-all rewrite to index.html (200 text/html). **Fixed:** added `!public/help/*.png` negation + committed the 5 assets (commit 6113699), confirmed live (`/help/team.png` → image/png), re-verified screenshots render and links SPA-navigate (desktop) + close the panel on mobile.
- **Map stacking fix — PASS (both viewports).** Side menu and chat panel both render above Leaflet's z-1000 controls over the LiveMapPanel; no bleed-through on desktop or mobile.
- **Team Add/Remove — PARTIAL.** Add Member form is correctly wired (renders, format-validates, domain-gates to binnedit/binned-it, owner-gated, surfaces errors honestly). Did NOT get a successful create: GoTrue rejects `+`/`.` email aliases as "Email address … is invalid" (UX finding — confusing message for valid-format addresses), and a plain alias hit Supabase's hourly email rate limit (exhausted by the QA attempts — Mark's invite quota is spent for ~1h). **Remove is code-verified only** (owner-gated, blocks self-removal, deletes profile then auth) — not behaviorally proven; deferred rather than delete a live persona account. Note: remove-user.js deletes the profile row BEFORE the auth user, so an auth-delete failure leaves the exact orphan (live auth user, no profile) the feature was meant to prevent.
- Board: 7/11 holds; J10 hardened to fully-verified. Team add/remove still needs one clean live round-trip (after the email rate limit resets) before "done".

## Session 2026-06-13 (device handover close)
Shipped: LiveMapPanel stacking-context fix (Leaflet controls no longer bleed over menu/chat), Team page Add Member + Remove (owner-only, `api/remove-user.js` deletes auth user + profile), AI chat deep links + inline help screenshots (prompt + ChatPanel renderer + the missing "Help screenshots" manual section, caught at close). Board unchanged at 7/11 — chat-link extension and Team add/remove need live persona runs next session (Mark, both viewports). Then resume triage.md Wave 3.

## Update protocol (per session)

1. Product Lead opens session: reads PM.md + this file + relevant agent logs.
2. Work happens; persona agents prove journeys they own.
3. Closing: Journey Board updated, agent logs appended, BMAD usage recorded, registry committed with the session's changes.
