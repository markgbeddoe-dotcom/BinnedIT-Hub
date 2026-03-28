import { useQuery, useMutation } from '@tanstack/react-query'
import { getAllCompetitorRates, upsertCompetitorRate, deleteCompetitorRate } from '../api/competitors'
import { queryClient } from './queryClient'

export function useCompetitorRates() {
  return useQuery({
    queryKey: ['competitors'],
    queryFn: getAllCompetitorRates,
    staleTime: Infinity,
  })
}

export function useUpsertRate() {
  return useMutation({
    mutationFn: ({ competitorName, binType, rate, notes }) =>
      upsertCompetitorRate(competitorName, binType, rate, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] })
    },
  })
}

export function useDeleteRate() {
  return useMutation({
    mutationFn: ({ id }) => deleteCompetitorRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors'] })
    },
  })
}
