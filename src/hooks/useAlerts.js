import { useQuery, useMutation } from '@tanstack/react-query'
import { getAlertsForReport, acknowledgeAlert } from '../api/alerts'
import { queryClient } from './queryClient'

export function useAlerts(reportId) {
  return useQuery({
    queryKey: ['alerts', reportId],
    queryFn: () => getAlertsForReport(reportId),
    enabled: !!reportId,
  })
}

export function useAcknowledgeAlert() {
  return useMutation({
    mutationFn: ({ alertId, notes }) => acknowledgeAlert(alertId, notes),
    onSuccess: (_data, { alertId }) => {
      // Invalidate all alert queries since we don't know which reportId
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
