import { describe, it, expect } from 'vitest';
import {
  FALLBACK_MONTH_KEYS,
  monthKeyFromIndex,
  monthLabelFromKey,
  getMonthlySnapshot,
  binTypesData,
  arData,
  arTotal,
  arOverdue,
  topDebtors,
  newCustomersFeb,
  dormantCustomers,
  churnRiskCustomers,
} from './financials';

// GAP-021 / GAP-022 — month-keyed fallback snapshot helper.
// Contract: every dashboard tab that falls back to hardcoded data resolves it
// through getMonthlySnapshot() so (a) the fallback ALWAYS renders (never-break
// contract) and (b) months without real source data are flagged isProxy so
// the tab shows an explicit "as at <month>" guard and suppresses false alerts.

describe('monthKeyFromIndex', () => {
  it('maps fallback indices to YYYY-MM keys', () => {
    expect(monthKeyFromIndex(0)).toBe('2025-07');
    expect(monthKeyFromIndex(7)).toBe('2026-02');
  });

  it('returns null out of range (App.jsx can pass findIndex() === -1)', () => {
    expect(monthKeyFromIndex(-1)).toBe(null);
    expect(monthKeyFromIndex(8)).toBe(null);
    expect(monthKeyFromIndex(undefined)).toBe(null);
  });

  it('FALLBACK_MONTH_KEYS covers the 8 hardcoded months Jul 2025 – Feb 2026', () => {
    expect(FALLBACK_MONTH_KEYS).toHaveLength(8);
    expect(FALLBACK_MONTH_KEYS[0]).toBe('2025-07');
    expect(FALLBACK_MONTH_KEYS[7]).toBe('2026-02');
  });
});

describe('monthLabelFromKey', () => {
  it('formats YYYY-MM as Mon YYYY', () => {
    expect(monthLabelFromKey('2026-02')).toBe('Feb 2026');
    expect(monthLabelFromKey('2025-07')).toBe('Jul 2025');
  });

  it('accepts reportMonth (YYYY-MM-DD) and rejects garbage', () => {
    expect(monthLabelFromKey('2026-02-01')).toBe('Feb 2026');
    expect(monthLabelFromKey('not-a-month')).toBe('');
    expect(monthLabelFromKey(null)).toBe('');
  });
});

describe('getMonthlySnapshot', () => {
  it('returns real data (isProxy=false) for a month with a source export', () => {
    const snap = getMonthlySnapshot('binTypes', '2026-02');
    expect(snap.isProxy).toBe(false);
    expect(snap.asAtKey).toBe('2026-02');
    expect(snap.asAtLabel).toBe('Feb 2026');
    expect(snap.data).toBe(binTypesData);
  });

  it('accepts reportMonth format (YYYY-MM-DD)', () => {
    const snap = getMonthlySnapshot('binTypes', '2026-02-01');
    expect(snap.isProxy).toBe(false);
    expect(snap.asAtKey).toBe('2026-02');
  });

  it('flags proxy for months without source data, still returning data (never-break contract)', () => {
    const snap = getMonthlySnapshot('binTypes', '2025-09');
    expect(snap.isProxy).toBe(true);
    expect(snap.asAtKey).toBe('2026-02');
    expect(snap.asAtLabel).toBe('Feb 2026');
    expect(snap.data).toBe(binTypesData);
  });

  it('resolves months after the latest snapshot to the latest on-or-before month', () => {
    const snap = getMonthlySnapshot('ar', '2026-05');
    expect(snap.isProxy).toBe(true);
    expect(snap.asAtKey).toBe('2026-02');
  });

  it('still returns data for invalid month keys, flagged isProxy', () => {
    for (const bad of [null, undefined, '', 'garbage', 42]) {
      const snap = getMonthlySnapshot('newCustomers', bad);
      expect(snap.isProxy).toBe(true);
      expect(snap.data).toBe(newCustomersFeb);
    }
  });

  it('exposes the AR snapshot shape DebtorsTab/SnapshotTab consume', () => {
    const snap = getMonthlySnapshot('ar', '2026-02');
    expect(snap.data.buckets).toBe(arData);
    expect(snap.data.total).toBe(arTotal);
    expect(snap.data.overdue).toBe(arOverdue);
    expect(snap.data.topDebtors).toBe(topDebtors);
  });

  it('serves the BDM datasets', () => {
    expect(getMonthlySnapshot('dormantCustomers', '2026-02').data).toBe(dormantCustomers);
    expect(getMonthlySnapshot('churnRiskCustomers', '2025-12').data).toBe(churnRiskCustomers);
  });

  it('returns null data only for unknown dataset names', () => {
    const snap = getMonthlySnapshot('nope', '2026-02');
    expect(snap.data).toBe(null);
    expect(snap.isProxy).toBe(true);
    expect(snap.asAtKey).toBe(null);
  });
});
