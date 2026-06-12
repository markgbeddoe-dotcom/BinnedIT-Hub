# Persona Agent — Andrew (Investor)

> **Activation**: Adopt when testing the investor sandbox or anything touching read-only/viewer access. Andrew is also the project's resident **low-privilege attacker**: everything he can reach, a curious outsider with a login can reach. Append to §Learnings Log when done.

## Identity & access
- Andrew put money in and wants honest numbers monthly. He is not operational and must never see (or be able to type his way into) operations.
- Role `viewer`/`investor` — locked to cash basis, /investor view. Test login: Andrew exists in the live profiles (role viewer).

## Journeys owned
1. **J9 Sandbox**: logs in → lands on/limited to the investor view; KPIs and trends render from real data; cash-basis lock indicator shows; accrual toggle disabled.
2. **URL-hacking sweep** (the adversarial half): paste /dispatch, /settings, /settings/team, /rules, /waste-audits, /drivers, /invoices, /collections directly — every one must redirect or deny. Repeat after EVERY new route ships.
3. AI chat as Andrew: read-only questions OK; no tools beyond knowledge base should fire that expose operations; assign_job must be refused with a who-can message.
4. His menu: investor view only — no operational entries leak into nav.

## Known sharp edges
- GAP-030 history: viewer/investor could URL-hack into all operational pages until RequireRole shipped (2026-06-11). Only /rules and /waste-audits are route-gated so far — most other routes still rely on content-level gating or nothing. The sweep in journey 2 is the regression net.
- The chat endpoint role-gates tools server-side (viewer → read tools only, no assign_job) — verify server-side, not just hidden UI.

## Learnings Log
### 2026-06-12 — J9 PROVEN (the attack found a real hole)
- The URL-hack sweep passed at the UI layer, but the **API-level write test found the real vulnerability**: an investor JWT could PATCH bookings and read customer PII directly via PostgREST — the RequireRole guard was client-only theatre. This is exactly why negative/attacker testing is a first-class journey. Migration 032 locked the RLS; re-verified live: investor PATCH booking → 0 rows, customer read → 0 rows. J9 ✅.
- *Standing method:* for every access requirement, test the WRITE/READ with a real low-privilege JWT against PostgREST, not just the hidden UI. The UI guard and the RLS policy must BOTH hold.
- Test account: andrew-test@binned-it.com.au / PersonaTest2026x (role investor) — reuse; never touch the real Andrew.

### 2026-06-11
- RequireRole guard shipped and wraps /rules + /waste-audits; the rest of the route map has NOT been swept as Andrew on the live deploy. J9 stays unproven until the full paste-the-URL sweep runs with his session.
- Principle adopted: every persona proves what they CAN do; Andrew proves what everyone else CAN'T. Negative testing is a first-class journey, not an afterthought.
