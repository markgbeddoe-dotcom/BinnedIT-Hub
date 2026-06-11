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
| J1 | Invite a new user with role *driver* → they can sign in | Mark | ⬜ invite UI fixed + deployed 2026-06-11; end-to-end signup unproven |
| J2 | Edit a team member's role/details in Team tab and it persists | Mark | ✅ 2026-06-11 — root cause was profiles UPDATE RLS (self-row only); migration 028 fixed; proven live (Andrew viewer→investor persisted through reload) |
| J3 | Create job → assign driver/truck/date → job born/moves to Scheduled | Tracey | ⬜ panel renders (QA 2026-06-11); real assignment blocked on J1 (no drivers exist) |
| J4 | Driver day: login → checklist gate → depart/arrive/start/complete with photos | Dave | ⬜ gate verified 2026-06-11; full chain blocked on J1/J3 |
| J5 | Tip-or-Return decision after pickup records a load | Dave | ⬜ engine unit-tested; live blocked on J4 |
| J6 | Invoice → reminder → collections letter chain | Sarah | ⬜ read views verified earlier sprints; not re-proven on current deploy |
| J7 | Waste audit photo → AI verdict → approve adjustment → Sarah actions manually | Jake/Sarah | ⬜ panel empty-state verified 2026-06-11; full chain needs a real photo |
| J8 | Month-end: Xero sync → dashboards reconcile (Meg sign-off) | Meg | ✅ 2026-05-08 live recon tied to Xero; re-run after next sync |
| J9 | Investor opens /investor: cash-only, no operational access via URL-hacking | Andrew | ⬜ RequireRole shipped 2026-06-11; not journey-tested |
| J10 | AI chat: "how do I…" answer + live tool action with visible audit chips | Mark | ✅ 2026-06-11 verified on live deploy (after SSE fix) |
| J11 | Public booking → confirmation SMS/email → appears in CRM/dispatch | Customer→Tracey | ⬜ verified in earlier sprint; not re-proven on current deploy |

**Pass-rate: 3/11 proven on current deploy** (J2 added 2026-06-11). That number is the honest baseline Mark called "~25% effective". It rises only via persona-run proof.

## Update protocol (per session)

1. Product Lead opens session: reads PM.md + this file + relevant agent logs.
2. Work happens; persona agents prove journeys they own.
3. Closing: Journey Board updated, agent logs appended, BMAD usage recorded, registry committed with the session's changes.
