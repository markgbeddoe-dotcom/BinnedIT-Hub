/**
 * @file useMonthData.js
 * TanStack Query hooks for all Supabase report data.
 *
 * All query hooks use a staleTime of 5 minutes and retry 2× on failure.
 * Mutation hooks invalidate related query caches on success so UI updates immediately.
 *
 * Sprint 17 #17D — every read hook now accepts an optional `basis` argument
 * ('cash' | 'accrual') as its LAST parameter. The basis is included in the
 * query key so the cache is partitioned per-basis (no stale rows leak across
 * the toggle), and forwarded to the corresponding `src/api/reports.js` call so
 * the backend (sibling 17C) returns the right slice. When omitted the API
 * defaults to cash, matching the prior behaviour.
 *
 * Query hooks (read):
 * - useAvailableMonths()                              — list of months with data in monthly_reports
 * - useFinancials(reportMonth, basis)                 — financials_monthly row
 * - useYTDFinancials(toMonth, basis)                  — financials_monthly Jul → toMonth
 * - useBalanceSheet(reportMonth, basis)               — balance_sheet row
 * - useDebtors(reportMonth, basis)                    — debtor_aging rows
 * - useBinPerformance(reportMonth, basis)             — bin_type_performance rows
 * - useCompliance(reportMonth, basis)                 — compliance row
 * - useAcquisitions(reportMonth, basis)               — customer_acquisitions rows
 * - useReport(reportMonth, basis)                     — monthly_reports row
 * - useChurnSignals(reportMonth, basis)               — churn signals
 *
 * Mutation hooks (write — wizard and settings):
 * - useCreateReport()              — create a new monthly_reports row
 * - useUpsertFinancials()          — write financials_monthly (wizard step)
 * - useUpsertBalanceSheet()        — write balance_sheet (wizard step)
 * - useUpsertDebtors()             — write debtor_aging rows (wizard step)
 * - useUpsertBinPerformance()      — write bin_type_performance rows (wizard step)
 * - useUpsertCompliance()          — write compliance row (wizard step)
 *
 * All hooks require: reportMonth in 'YYYY-MM-DD' format (first day of month).
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getAvailableMonths,
  getReportForMonth,
  getFinancialsForMonth,
  getFinancialsRange,
  getBalanceSheetForMonth,
  getDebtorsForMonth,
  getBinPerformanceForMonth,
  getComplianceForMonth,
  getCustomerAcquisitionsForMonth,
  getChurnSignals,
  createReport,
  upsertFinancials,
  upsertBalanceSheet,
  upsertDebtors,
  upsertBinPerformance,
  upsertCompliance,
} from '../api/reports'
import { queryClient } from './queryClient'

export function useAvailableMonths() {
  return useQuery({
    queryKey: ['available-months'],
    queryFn: getAvailableMonths,
  })
}

export function useFinancials(reportMonth, basis) {
  return useQuery({
    queryKey: ['financials', reportMonth, basis],
    queryFn: () => getFinancialsForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useYTDFinancials(toMonth, basis) {
  return useQuery({
    queryKey: ['financials-ytd', toMonth, basis],
    queryFn: () => getFinancialsRange('2025-07-01', toMonth, basis),
    enabled: !!toMonth,
  })
}

export function useBalanceSheet(reportMonth, basis) {
  return useQuery({
    queryKey: ['balance-sheet', reportMonth, basis],
    queryFn: () => getBalanceSheetForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useDebtors(reportMonth, basis) {
  return useQuery({
    queryKey: ['debtors', reportMonth, basis],
    queryFn: () => getDebtorsForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useBinPerformance(reportMonth, basis) {
  return useQuery({
    queryKey: ['bin-performance', reportMonth, basis],
    queryFn: () => getBinPerformanceForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useCompliance(reportMonth, basis) {
  return useQuery({
    queryKey: ['compliance', reportMonth, basis],
    queryFn: () => getComplianceForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useAcquisitions(reportMonth, basis) {
  return useQuery({
    queryKey: ['acquisitions', reportMonth, basis],
    queryFn: () => getCustomerAcquisitionsForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useReport(reportMonth, basis) {
  return useQuery({
    queryKey: ['report', reportMonth, basis],
    queryFn: () => getReportForMonth(reportMonth, basis),
    enabled: !!reportMonth,
  })
}

export function useChurnSignals(reportMonth, basis) {
  return useQuery({
    queryKey: ['churn-signals', reportMonth, basis],
    queryFn: () => getChurnSignals(reportMonth, basis),
    enabled: !!reportMonth,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateReport() {
  return useMutation({
    mutationFn: (reportMonth) => createReport(reportMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-months'] })
    },
  })
}

export function useUpsertFinancials() {
  return useMutation({
    mutationFn: ({ reportId, reportMonth, data }) => upsertFinancials(reportId, reportMonth, data),
    onSuccess: (_, { reportMonth }) => {
      queryClient.invalidateQueries({ queryKey: ['available-months'] })
      queryClient.invalidateQueries({ queryKey: ['financials', reportMonth] })
      queryClient.invalidateQueries({ queryKey: ['financials-ytd'] })
    },
  })
}

export function useUpsertBalanceSheet() {
  return useMutation({
    mutationFn: ({ reportId, reportMonth, data }) => upsertBalanceSheet(reportId, reportMonth, data),
    onSuccess: (_, { reportMonth }) => {
      queryClient.invalidateQueries({ queryKey: ['available-months'] })
      queryClient.invalidateQueries({ queryKey: ['balance-sheet', reportMonth] })
    },
  })
}

export function useUpsertDebtors() {
  return useMutation({
    mutationFn: ({ reportId, reportMonth, rows }) => upsertDebtors(reportId, reportMonth, rows),
    onSuccess: (_, { reportMonth }) => {
      queryClient.invalidateQueries({ queryKey: ['debtors', reportMonth] })
    },
  })
}

export function useUpsertBinPerformance() {
  return useMutation({
    mutationFn: ({ reportId, reportMonth, rows }) => upsertBinPerformance(reportId, reportMonth, rows),
    onSuccess: (_, { reportMonth }) => {
      queryClient.invalidateQueries({ queryKey: ['bin-performance', reportMonth] })
    },
  })
}

export function useUpsertCompliance() {
  return useMutation({
    mutationFn: ({ reportId, reportMonth, data }) => upsertCompliance(reportId, reportMonth, data),
    onSuccess: (_, { reportMonth }) => {
      queryClient.invalidateQueries({ queryKey: ['compliance', reportMonth] })
    },
  })
}
