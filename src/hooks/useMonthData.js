/**
 * @file useMonthData.js
 * TanStack Query hooks for all Supabase report data.
 *
 * All query hooks use a staleTime of 5 minutes and retry 2× on failure.
 * Mutation hooks invalidate related query caches on success so UI updates immediately.
 *
 * Query hooks (read):
 * - useAvailableMonths()           — list of months with data in monthly_reports
 * - useFinancials(reportMonth)     — financials_monthly row for the selected month
 * - useYTDFinancials(toMonth)      — all financials_monthly rows from Jul to toMonth
 * - useBalanceSheet(reportMonth)   — balance_sheet row for the selected month
 * - useDebtors(reportMonth)        — debtor_aging rows for the selected month
 * - useBinPerformance(reportMonth) — bin_type_performance rows for the selected month
 * - useCompliance(reportMonth)     — compliance row for the selected month
 * - useAcquisitions(reportMonth)   — customer_acquisitions rows for the selected month
 * - useReport(reportMonth)         — monthly_reports row for the selected month
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

export function useFinancials(reportMonth) {
  return useQuery({
    queryKey: ['financials', reportMonth],
    queryFn: () => getFinancialsForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useYTDFinancials(toMonth) {
  return useQuery({
    queryKey: ['financials-ytd', toMonth],
    queryFn: () => getFinancialsRange('2025-07-01', toMonth),
    enabled: !!toMonth,
  })
}

export function useBalanceSheet(reportMonth) {
  return useQuery({
    queryKey: ['balance-sheet', reportMonth],
    queryFn: () => getBalanceSheetForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useDebtors(reportMonth) {
  return useQuery({
    queryKey: ['debtors', reportMonth],
    queryFn: () => getDebtorsForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useBinPerformance(reportMonth) {
  return useQuery({
    queryKey: ['bin-performance', reportMonth],
    queryFn: () => getBinPerformanceForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useCompliance(reportMonth) {
  return useQuery({
    queryKey: ['compliance', reportMonth],
    queryFn: () => getComplianceForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useAcquisitions(reportMonth) {
  return useQuery({
    queryKey: ['acquisitions', reportMonth],
    queryFn: () => getCustomerAcquisitionsForMonth(reportMonth),
    enabled: !!reportMonth,
  })
}

export function useReport(reportMonth) {
  return useQuery({
    queryKey: ['report', reportMonth],
    queryFn: () => getReportForMonth(reportMonth),
    enabled: !!reportMonth,
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
