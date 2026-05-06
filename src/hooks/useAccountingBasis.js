/**
 * @file useAccountingBasis.js
 *
 * Persisted accounting-basis selector for the reporting dashboard.
 *
 * Returns { basis, setBasis, locked }
 *  - basis  : 'cash' (default) | 'accrual'
 *  - setBasis(next) : persists choice to localStorage AND invalidates every
 *                    month-data query so the dashboards refetch on the new basis.
 *  - locked : true when the active profile.role is a viewer/investor — those
 *             roles are forced to cash basis per CFO recommendation
 *             (sibling 17C wires the API contract; this hook owns the UX gate).
 *
 * Storage key: 'skipsync.accounting_basis'
 *
 * Sprint 17 #17D — frontend toggle. The Supabase data-access layer accepts an
 * optional `basis` argument (sibling 17C); the value flows from this hook
 * through useMonthData hooks into the query keys so the cache is partitioned
 * per-basis (no stale cash data leaking into accrual view, or vice-versa).
 */

import { useCallback, useEffect, useState } from 'react'
import { queryClient } from './queryClient'
import { useAuth } from '../context/AuthContext'

const STORAGE_KEY = 'skipsync.accounting_basis'
const VALID = ['cash', 'accrual']

// Query keys that are partitioned by basis — invalidated on every basis change
// so the dashboards refetch with the new basis. Mirrors the read hooks in
// src/hooks/useMonthData.js.
const BASIS_QUERY_KEYS = [
  'financials',
  'financials-ytd',
  'balance-sheet',
  'debtors',
  'bin-performance',
  'compliance',
  'acquisitions',
  'report',
  'churn-signals',
]

function readPersisted() {
  if (typeof window === 'undefined') return 'cash'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v) ? v : 'cash'
  } catch {
    return 'cash'
  }
}

export function useAccountingBasis() {
  const { profile } = useAuth()
  const role = profile?.role
  const locked = role === 'viewer' || role === 'investor'

  // Investor/viewer is forced to cash and ignores localStorage.
  const [basis, setBasisState] = useState(() => (locked ? 'cash' : readPersisted()))

  // Re-sync if the role flips (e.g. login finishes after first render, or an
  // owner switches into viewer mode for a demo).
  useEffect(() => {
    if (locked) {
      if (basis !== 'cash') setBasisState('cash')
    } else {
      const persisted = readPersisted()
      if (persisted !== basis) setBasisState(persisted)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  const setBasis = useCallback(
    (next) => {
      if (locked) return
      if (!VALID.includes(next)) return
      if (next === basis) return

      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Storage may be unavailable (private browsing) — that's fine, the
        // in-memory state still drives the current session.
      }
      setBasisState(next)

      // Invalidate every basis-partitioned query so tabs refetch.
      BASIS_QUERY_KEYS.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
    },
    [basis, locked]
  )

  return { basis, setBasis, locked }
}
