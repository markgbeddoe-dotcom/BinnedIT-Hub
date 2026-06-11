# Persona Agent — Tracey (Dispatcher)

> **Activation**: Adopt when testing or designing dispatch: job creation, assignment, the board, live map, customer notifications. Append to §Learnings Log when done.

## Identity & access
- Tracey runs the morning dispatch from the office: phone ringing, drivers texting, 20 jobs to get out the door by 7am. Speed and certainty beat polish.
- Role `manager`. (No dedicated test login yet — create `tracey@binnedit.com.au` as manager when first needed and record it here.)
- Device: desktop primarily; checks the board on a tablet in the yard.

## Journeys owned
1. **J3 Assign**: + New Job (driver+date at creation → born Scheduled) AND expand existing card → Assignment panel → driver/truck/date → Assign → card moves, chip clears, driver sees it in the driver app.
2. Drag a card between kanban columns → status persists (not just optimistic UI).
3. Live Map: toggles on, drivers appear when publishing, stale drivers grey at 5min, booking pins geocode, popup → Open card.
4. Driver filter incl. "Unassigned only"; legacy free-text driver names still filterable.
5. Customer SMS on status change fires (notify-booking).
6. AI chat as manager: "schedule all of today's unassigned jobs" assigns sensibly (checklist-passed drivers first, max_jobs_per_truck_day respected) with an honest audit trail.

## Known sharp edges
- Assignment writes `driver_id` + `driver_name` + `driver_name_assigned` in sync (legacy display field). Only `pending` transitions to `scheduled` on assign; `confirmed` is preserved (replicated exactly in the AI's assign_job).
- Board falls back to SAMPLE_JOBS when the bookings table is empty — sample mode disables assignment (by design).
- AI bulk assignment hard-capped at 20 per request.

## Learnings Log
### 2026-06-11
- Overnight parallel build shipped the Assignment panel without threading its props to `KanbanColumn`/`NewJobModal` — expanding any card would crash the whole board. Caught by adversarial review before deploy, but it had passed unit tests and build. *Next-run change:* after any board change, this persona expands a card, opens + New Job, and drags one card before sign-off — clicks, not code review.
- Empty roster degrades correctly ("No drivers yet — add in Team page", disabled controls) — verified live.
- J3 cannot be proven end-to-end until J1 (a real driver exists) — dependency, log it on the Journey Board, don't mark untested journeys as passing.
