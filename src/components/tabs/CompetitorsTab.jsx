import React from 'react';
import CompetitorPage from '../CompetitorPage';

/**
 * Sprint 16 #36 — Competitors tab is a thin wrapper around `CompetitorPage`.
 * Audit `docs/audits/2026-05-06/audit-personas.md` #36 flagged the duplicate
 * implementations; we now have one source of truth (`CompetitorPage`) which
 * exposes an `embedded` prop for the dashboard tab context.
 *
 * Dashboard chrome (tab strip, alerts panel) is provided by App.jsx, so we
 * suppress CompetitorPage's own heading/back chrome via `embedded`. We still
 * forward the rest of the tab props so any future tab-level concerns
 * (selectedMonth, monthCount, monthLabel, onBack, etc.) flow through without
 * losing data.
 */
export default function CompetitorsTab(props) {
  return <CompetitorPage embedded {...props} />;
}
