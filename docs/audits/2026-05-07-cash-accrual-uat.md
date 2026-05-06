# Cash vs Accrual Toggle — Persona UAT Plan

**Sprint:** 17 #17E
**Date:** 7 May 2026
**Author:** John (Product Manager) — `_bmad/config.toml::bmad-agent-pm`
**Reviewers expected:** Mark (owner sign-off), Meg (CFO assurance — see `agents/Accountant.md` §10 entry from sibling 17A)
**Status:** DRAFT — to be exercised once sibling 17C (mapper basis flag) and 17D (UI toggle) cherry-pick into `master`.

---

## 0. Why are we writing this? (John's framing)

A toggle on a dashboard is not a feature. It is a **claim about which number Mark trusts at 8am**. So:

- *Why a toggle at all?* Because Mark spends his cash, not his accrual. He pays GST out of cash. He prices bins out of cash. Meg files the BAS off accrual. Both numbers are right; they answer different questions.
- *Why default to cash?* See sibling 17A's update to `agents/Accountant.md` §10 — Meg's CFO recommendation is that Binned-IT operates as a small private Pty Ltd and the operator's daily decisions are cash-driven. Accrual is a reporting overlay, not the decision basis.
- *Why does this need persona UAT and not a smoke test?* Because four different humans use this dashboard and three of them should never even **notice** the toggle. If Sarah has to think about it, we've shipped wrong.
- *Why are the dollar values written down here?* Because if the assertion in the Playwright spec ever drifts from the assertion in this UAT plan, **one of them is lying**. Pin both to the same source of truth (Feb 2026 closed month).

The acceptance criteria below are written as testable assertions on purpose. Every "should" maps to a Playwright `expect()` in `e2e/cash-accrual-toggle.spec.js`.

---

## 1. Source-of-truth dollar values (Feb 2026)

These are the numbers that BOTH this UAT plan AND the Playwright specs assert against. They came out of the Sprint 17A Xero re-pull (cash + accrual P&L for the Feb 2026 closed month) and are documented in Meg's working paper appended to `agents/Accountant.md` §10.

| Metric                | Cash basis      | Accrual basis  | Δ (accrual − cash) |
|-----------------------|-----------------|----------------|--------------------|
| Net profit (Feb 2026) | **−$17,638.72** | **$30,511.71** | +$48,150.43        |

**John's sharp question:** is a $48k swing material? Yes — it's roughly 3.2% of TTM revenue and ~5x performance materiality ($10k per Meg §6.1). If we ship the toggle without making it impossible to confuse the two values, every operational decision Mark makes that morning is wrong by $48k. That is the entire point of this UAT.

The cash-basis figure (**−$17,638.72**) is the value the assertion harness pins on. If the dashboard shows $30,511.71 on first load, the test fails — by design. *That's the regression sibling 17C's mapper change is supposed to prevent.*

---

## 2. Persona UAT scenarios

Each persona section has the same shape:
- Default basis (what the toggle should show on first login).
- JTBD user story.
- Acceptance criteria as testable assertions.
- Expected dollar value the persona should see on the Snapshot/Net Profit tile for Feb 2026.

---

### 2.1 Mark — Owner / Director / Operator

**Default basis:** **Cash**.
**Toggle visible?** Yes — header chip on desktop, drawer item on mobile.
**Toggle interactive?** Yes.

#### JTBD

> When Mark opens the dashboard at 8am on his phone in the yard, he wants to see **cash-basis** net profit for the current month — because that's the number that funds his decisions about ATO payments, bin pricing, and whether he can afford to put diesel in the second truck this week. He does not want to be tricked into reading an accrual number that includes invoices the customer hasn't paid yet.

*John's follow-up:* "Why cash and not accrual for Mark?" — Because cash is what's in the Westpac account at 8am. Accrual includes ~$118k of AR, of which ~$30k is 60+ days overdue (per Meg's audit). If Mark prices on accrual he prices on debtor optimism.

#### Acceptance criteria (testable)

1. On first login (no `localStorage.skipsync.basis` value), the visible "Net Profit (Feb 2026)" tile reads **−$17,638.72** (rendered as `-$17,638.72` or `($17,638.72)` depending on the formatter — both are acceptable; the assertion uses a regex tolerant of either).
2. The header shows a basis chip with text matching `/cash basis/i`. The "(accrual basis)" pill is **absent**.
3. Clicking the toggle to "Accrual" updates the same tile to **$30,511.71** within 500ms (no full page reload).
4. After clicking accrual, the URL contains `?basis=accrual` OR `localStorage.skipsync.basis === 'accrual'` (implementation-dependent — both are acceptable; the spec asserts on either).
5. Refreshing the page preserves the chosen basis.

#### Expected Feb 2026 KPI value

- Net Profit tile (cash, default): **−$17,638.72**
- Net Profit tile (accrual, after toggle): **$30,511.71**

---

### 2.2 Sarah — Office Manager / Bookkeeper

**Default basis:** **Cash with active toggle to Accrual** when she's preparing the BAS or the accrual P&L pack for Meg.
**Toggle visible?** Yes — same affordance as Mark.
**Toggle interactive?** Yes.

#### JTBD

> When Sarah is doing month-end reconciliation, she **starts on cash** to tie the numbers back to the Westpac feed and Mark's daily view, then **flips to accrual** to match what she'll lodge with the ATO. She wants the toggle to be one click, not a settings page or a separate report — because she'll do the flip 20 times in a close cycle and the friction compounds.

*John's follow-up:* "Why not default Sarah to accrual since that's her end-state output?" — Because she reconciles outwards from the bank, not inwards from the GL. Cash first, accrual second. If we override her default on a per-role basis, we add an "is this the right view?" cognitive load to every other persona too. Default is uniform; she does the work.

#### Acceptance criteria (testable)

1. Default basis on first load is cash (same assertion as Mark §2.1 #1).
2. Clicking accrual updates the visible Net Profit tile from **−$17,638.72** to **$30,511.71**.
3. The "(accrual basis)" pill appears next to the tile (or in the header) when accrual is active. Pill text matches `/accrual basis/i`.
4. The pill **disappears** when she toggles back to cash.
5. Persistence holds across a page refresh (same assertion as Mark §2.1 #5).

#### Expected Feb 2026 KPI value

- Net Profit tile (cash): **−$17,638.72**
- Net Profit tile (accrual): **$30,511.71**

---

### 2.3 Jake — Fleet / Operations Manager

**Default basis:** **Cash**. He doesn't care which one — but if we're going to show him a number, it has to be the one that matches what Mark is talking about in the morning toolbox meeting.
**Toggle visible?** Yes — but he should never need to use it.
**Toggle interactive?** Yes (we don't role-gate Jake; gating is an investor-only concern).

#### JTBD

> When Jake glances at the Snapshot tab between dispatch tasks, he wants the headline net-profit number to be **the same number Mark is quoting in the morning meeting** — without him having to know what "cash basis" means. He shouldn't be able to confuse himself by accidentally clicking the toggle and seeing a different number five minutes later with no explanation.

*John's follow-up:* "Why is Jake getting a toggle at all if he doesn't care?" — Because role-gating the toggle for Jake is **more** complexity than just letting him have it. The default (cash) is the right answer 99% of the time. If he flips it accidentally, the persistence-across-refresh behaviour means he'll see the changed value next morning, which is the right teaching moment to ask Sarah what happened. Self-correcting.

*Sharper follow-up:* "If he toggles, do we audit it?" — No. Out of scope for 17E. If we see real usage data showing Jake flips it, we add an audit log in 18.

#### Acceptance criteria (testable)

1. Default basis on first load is cash. Tile reads **−$17,638.72**.
2. The toggle is present and clickable (not disabled, no tooltip blocker).
3. After Jake toggles to accrual and refreshes, the basis sticks (persistence assertion).
4. The "(accrual basis)" pill appears when accrual is active — same affordance as Sarah, no role-specific UI difference.

#### Expected Feb 2026 KPI value

- Net Profit tile (cash, default): **−$17,638.72**

---

### 2.4 Andrew — Investor / Silent Partner

**Default basis:** **Cash, locked**.
**Toggle visible?** Yes (so the basis label is visible — investor needs to know which lens they're reading).
**Toggle interactive?** **NO** — disabled, with a tooltip explaining why.

#### JTBD

> When Andrew opens the investor view at `/investor`, he wants to see a **single, consistent basis** that matches what was reported to him in the last quarterly update — so he can compare quarter-on-quarter without wondering whether the numbers shifted because the basis changed under him. He explicitly does **not** want the ability to flip between the two and re-interpret the business.

*John's follow-up:* "Why lock Andrew out instead of just defaulting?" — Because if Andrew toggles and remembers a different number from the one he saw last quarter, he'll call Mark with a wrong question. The lock is a **trust control**, not a permissions one. The tooltip should explain this in one sentence ("Investor view is fixed to cash basis for reporting consistency — contact the owner if you need an accrual reconciliation"), not be a generic "you don't have permission".

*Sharper follow-up:* "What if Andrew is also Mark's brother and gets a debug session where he wants to see accrual?" — He asks Mark. The lock is software, the override is conversational. We are not building an "investor admin" mode for one user.

#### Acceptance criteria (testable)

1. Default basis on `/investor` is cash. Tile reads **−$17,638.72**.
2. The basis chip renders, but with `aria-disabled="true"` (or the `disabled` attribute, depending on whether 17D uses a `<button>` or a `<div role="switch">`).
3. Clicking or tapping the chip does **not** change the basis. Tile value remains **−$17,638.72** after the click.
4. A tooltip / `title` attribute / `aria-describedby` element contains text matching `/investor|reporting consistency|contact the owner/i` so Andrew understands why.
5. The "(accrual basis)" pill is **never** rendered on this route.

#### Expected Feb 2026 KPI value

- Net Profit tile (cash, locked): **−$17,638.72** — and only this value, regardless of clicks.

---

## 3. Cross-persona regression scenarios

These are not persona-specific but must hold for every persona above.

### 3.1 First-load default

If `localStorage.skipsync.basis` is unset AND no `?basis=` query param is in the URL, the default is **cash** for every role. This is the contract that prevents the Sprint 10 reconciliation regression — see §4 below.

### 3.2 URL query param wins

If `?basis=accrual` appears in the URL (e.g. someone shares a deep link), the page renders accrual on first paint AND writes that value into `localStorage`. This is so Sarah can bookmark "the accrual close link" and not have to click the toggle.

*John's follow-up:* "Should we let `?basis=` override the investor lock?" — No. For Andrew, even with `?basis=accrual` in the URL, the page renders cash and the URL is silently rewritten. The lock is the lock.

### 3.3 Mobile / desktop parity

The toggle is reachable on both viewports. The selector differs (header chip on desktop, drawer item on mobile) but the user-observable behaviour is identical. The Playwright matrix runs every test at both 1440×900 and 390×844.

---

## 4. Sprint 10 reconciliation regression — the load-bearing test

**Background.** Sprint 10 (`agents/Accountant.md` §10 entry "2026-05-07 — Sprint 10 Unblock") rebuilt `mapPLToFinancials` to correctly classify revenue and COS from the actual Binned-IT chart of accounts. At that point the sync ran on **whichever Xero report endpoint was queried** — and historically the `/api/xero-sync` route was hitting the accrual P&L. Result: `financials_monthly.net_profit` for Feb 2026 was written as **$30,511.71** (the accrual figure) but Mark was looking at the Snapshot tile thinking it was cash.

**Sibling 17C** is updating `xero-sync.js` and `xero-mapper.js` so the sync defaults to **cash basis** and the basis is recorded in a new `basis` column on `financials_monthly`. The expected Feb 2026 row after re-sync should read:

| Column        | Value           |
|---------------|-----------------|
| `report_month`| `2026-02`       |
| `basis`       | `cash`          |
| `net_profit`  | **−17638.72**   |

If `basis = 'accrual'` is requested explicitly (Sarah's BAS workflow, or the toggle in the UI overriding the default), the row written should be:

| Column        | Value           |
|---------------|-----------------|
| `report_month`| `2026-02`       |
| `basis`       | `accrual`       |
| `net_profit`  | **30511.71**    |

**Test location.** A Vitest case has been added to `api/lib/xero-mapper.test.js` (`describe('mapPLToFinancials — basis flag flows through (Sprint 17E reconciliation)')`) that proves:
1. Calling `mapPLToFinancials(sections, '2026-02', { basis: 'cash' })` returns an object with `basis: 'cash'`.
2. Calling `mapPLToFinancials(sections, '2026-02', { basis: 'accrual' })` returns an object with `basis: 'accrual'`.
3. Calling `mapPLToFinancials(sections, '2026-02')` (no opts) defaults to `basis: 'cash'`.
4. The cash and accrual fixtures produce the documented net_profit deltas (−$17,638.72 vs $30,511.71) when their corresponding sections are passed in.

**TODO for sibling 17C.** The mapper currently does not accept the third argument. The Vitest case will fail until 17C adds `function mapPLToFinancials(sections, month, opts = {})` and persists `basis: opts.basis || 'cash'` on the output. The failing test is intentional — it's the contract.

---

## 5. Out of scope

- Audit logging of basis toggles (deferred to Sprint 18 per §2.3 follow-up).
- A "show both side by side" comparison view (deferred — not requested).
- A per-tab basis (every tab follows the same global basis; we are NOT going to let Sarah have Snapshot on cash and Margins on accrual in the same session).
- Historical re-statement of months synced before this change. The next Xero re-pull will overwrite in place via DELETE+INSERT (`agents/Accountant.md` §4 — "per-month partitioning ... DELETE+INSERT").

---

## 6. Sign-off checklist

Before this plan is considered exercised:

- [ ] Sibling 17C lands the basis flag on `mapPLToFinancials`. `npm test` for the new Vitest case in `api/lib/xero-mapper.test.js` goes green.
- [ ] Sibling 17D lands the toggle UI with the `data-testid` selectors documented in `e2e/cash-accrual-toggle.spec.js` (see TODO comments inline in that file).
- [ ] Re-pull Xero for Feb 2026 with `?basis=cash`. Confirm `SELECT net_profit FROM financials_monthly WHERE report_month = '2026-02' AND basis = 'cash'` returns **−17638.72**.
- [ ] `npm run test:e2e` passes at both desktop and mobile project matrix entries.
- [ ] Mark eyeballs the Snapshot tab on his phone at 8am next Monday. The cash chip is present, the value is −$17,638.72 for Feb 2026 (or whatever the closed month is by then). He doesn't ask "why is this number different?".

If Mark asks "why is this number different?" — the toggle has failed. We don't ship.
