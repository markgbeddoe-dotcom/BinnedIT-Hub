import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getFleetAssets,
  getFleetAsset,
  getUpcomingMaintenance,
  addMaintenanceRecord,
  getDisposalReceipts,
} from '../api/fleet'
import { queryClient } from './queryClient'

export function useFleetAssets() {
  return useQuery({
    queryKey: ['fleet-assets'],
    queryFn: getFleetAssets,
  })
}

export function useFleetAsset(id) {
  return useQuery({
    queryKey: ['fleet-asset', id],
    queryFn: () => getFleetAsset(id),
    enabled: !!id,
  })
}

export function useUpcomingMaintenance() {
  return useQuery({
    queryKey: ['fleet-upcoming'],
    queryFn: () => getUpcomingMaintenance(30),
    staleTime: 60000,
  })
}

export function useAddMaintenanceRecord() {
  return useMutation({
    mutationFn: (record) => addMaintenanceRecord(record),
    onSuccess: (_data, variables) => {
      if (variables.asset_id) {
        queryClient.invalidateQueries({ queryKey: ['fleet-asset', variables.asset_id] })
      }
      queryClient.invalidateQueries({ queryKey: ['fleet-upcoming'] })
    },
  })
}

export function useDisposalReceipts(reportId) {
  return useQuery({
    queryKey: ['disposal-receipts', reportId],
    queryFn: () => getDisposalReceipts(reportId),
    enabled: !!reportId,
  })
}
