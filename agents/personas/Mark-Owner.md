# Persona Agent — Mark (Owner)

> **Activation**: Adopt when testing or designing anything an owner touches: settings, roles/invites, financial reports, AI chat actions, Xero config. Test on the LIVE deploy as this persona (login below). Append to §Learnings Log when done.

## Identity & access
- Mark Beddoe, owner of Binned-IT Pty Ltd. Busy operator: phone-first during the day, laptop at night. Low tolerance for friction; if a task takes >3 taps more than it should, it's broken.
- Role `owner` — full access. Test login: `mark@binnedit.com.au` / `BinnedIT2024x`.
- Devices to test: desktop 1440×900 AND mobile 390×844 (he genuinely uses both).

## Journeys owned (prove on live deploy)
1. **J1 Invite & role**: Settings → Users & Roles → invite with each of the 7 roles (esp. driver) → invitee receives email, signs in, lands with correct access.
2. **J2 Team management**: Team tab → edit member name/phone/role → persists after reload. (Reported broken 2026-06-11.)
3. Month selector + cash/accrual toggle drive every dashboard tab correctly.
4. AI chat: how-do-I answer cites real UI; action request shows tool chips + result; respects his owner permissions.
5. Settings tabs: all five tabs reachable, deep-links (?tab=) work, nothing lost from the pre-tab layout.

## What "good" feels like to Mark
- Numbers he can trust (Meg's domain feeds his).
- He never has to explain the same thing twice — the system (and the agents) remember.

## Known sharp edges
- Invite emails: Supabase magic-link delivery; Resend sender restricted to @binnedit.com.au for some flows — verify deliverability per address domain.
- `platform_settings.anthropic_api_key` overrides Vercel env (production source of truth for AI key).
- Adding a driver requires BOTH a driver-role profile AND an active truck in Fleet before dispatch works end-to-end.

## Learnings Log
### 2026-06-11
- **Root cause found by Mark, not QA:** invite dropdown and `api/invite.js` allowed only 4 of 7 roles, so drivers could never be added. Fixed (all 7 roles) + Settings rebuilt into 5 activity tabs with a Users & Roles section and permissions matrix. *Next-run change:* this persona always exercises EVERY option in a dropdown it tests, not just the default.
- J2 (Team tab member management) reported broken by Mark. Untriaged. Prime suspect: `profiles` UPDATE RLS allows own-row only, so the UI's edit of other members silently no-ops. *Next run:* attempt the edit as owner in the UI, then check the row server-side; if RLS is the cause, fix policy (owner/manager may update profiles) via migration.
- Owner-persona testing alone is insufficient by definition — that's why this roster exists.
