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
### 2026-06-16 — live run of the 06-13 handover (desktop + mobile)
- **J10 chat deep links: PASS, after fixing broken screenshots.** Asked "How do I add a team member?" — reply rendered tap-to-navigate link buttons (Settings → Users & Roles, Team & Staff) and inline `/help/*.png` screenshots. The screenshots were BROKEN on first run (`naturalWidth 0`): the PNGs were never committed (blanket `*.png` in .gitignore swallowed them) so prod served index.html for `/help/*.png`. Fixed + redeployed; re-verified both link SPA-navigation (desktop → /settings/team) and mobile behaviour (tap closes the chat panel AND navigates — confirmed `chatVisible:false`). *Next-run change: when this persona tests any AI-chat reply that shows an image, assert the `<img>` actually loaded (naturalWidth>0) on the live deploy — a rendered markdown image tag is not proof the asset exists.*
- **Team Add Member: wired correctly, not fully proven.** Form renders, validates, domain-restricts, owner-gates, and surfaces errors honestly (the J2 "0-rows must show as error" lesson held). But I could not create a test user: GoTrue rejects `+` and `.` email aliases as "invalid", and the plain alias hit the **Supabase hourly email rate limit** — which my repeated QA invites exhausted (so real invites may fail for ~1h). *Next-run change: to test invites without burning the email quota, use ONE valid plain-alias address per hour, and don't retry into a rate limit.*
- **Team Remove: still unproven live.** Code is correct (owner-only, can't remove self, deletes auth+profile) but I declined to delete a real persona account to test it. Per the standing note, a real run must confirm the removed user can no longer sign in — deferred to a session where a throwaway account exists.
- **Map stacking fix confirmed** (Dispatch → Live Map): opened the side menu and the chat panel over the map on both desktop and mobile — neither showed Leaflet's zoom controls bleeding through. Matches the 06-13 fix intent.

### 2026-06-13
- **Team page completed:** Add Member (invite with name/email/role) + Remove, both owner-only. Removal goes through `api/remove-user.js`, which deletes the auth user AND the profile row in one call — previously there was no way to remove anyone, and a profiles-only delete would have left a live auth user who could still sign in. *Next-run change:* when this persona tests any "remove/delete person" flow, verify the auth user is gone (sign-in attempt fails), not just that the row left the UI.
- **AI chat deep links (J10 extension):** assistant replies now carry tap-to-navigate `[Page](/route)` buttons and inline `/help/*.png` screenshots. QA'd locally only — **needs a live run on the deploy** (ask "how do I add a team member", tap the link, confirm SPA navigation + screenshot renders + chat closes on mobile; also confirm it doesn't link a role somewhere they'd be bounced from). Root-cause note: the feature shipped with the prompt referencing a manual screenshot list that didn't exist — caught and fixed at session close before deploy.

### 2026-06-11
- **Root cause found by Mark, not QA:** invite dropdown and `api/invite.js` allowed only 4 of 7 roles, so drivers could never be added. Fixed (all 7 roles) + Settings rebuilt into 5 activity tabs with a Users & Roles section and permissions matrix. *Next-run change:* this persona always exercises EVERY option in a dropdown it tests, not just the default.
- J2 (Team tab member management) reported broken by Mark. Untriaged. Prime suspect: `profiles` UPDATE RLS allows own-row only, so the UI's edit of other members silently no-ops. *Next run:* attempt the edit as owner in the UI, then check the row server-side; if RLS is the cause, fix policy (owner/manager may update profiles) via migration.
- Owner-persona testing alone is insufficient by definition — that's why this roster exists.
- **J2 root cause confirmed and fixed same-day:** `profiles` UPDATE RLS was self-row only — every Team-tab edit of another member silently no-opped (PostgREST returns success with 0 rows; the UI showed no error). SELECT was owner+self only, so managers would have seen an empty team AND empty dispatch roster. Migration 028: office-role SELECT, owner/manager UPDATE, plus a trigger blocking self-service role escalation (any user could previously self-promote via the API). Proven live: Andrew viewer→investor persisted through reload. *Next-run change:* for any "button does nothing" report, check RLS as the acting role FIRST; and any UI write path must surface a 0-rows result as an error, not success.
