import { useQuery } from '@tanstack/react-query'
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
} from '../api/reports'

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
