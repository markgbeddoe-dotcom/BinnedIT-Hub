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
