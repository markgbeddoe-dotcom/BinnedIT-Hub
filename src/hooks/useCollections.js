import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getCollectionsEvents, getAllCollectionsEvents, createCollectionsEvent,
  updateCollectionsEvent, getOverdueInvoices, escalateInvoice, getCollectionsSummary,
} from '../api/collections'
import { queryClient } from './queryClient'

export function useCollectionsSummary() {
  return useQuery({
    queryKey: ['collections-summary'],
    queryFn: getCollectionsSummary,
    staleTime: 60000,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useOverdueInvoices() {
  return useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: getOverdueInvoices,
    staleTime: 60000,
  })
}

export function useCollectionsEvents(customerId) {
  return useQuery({
    queryKey: ['collections-events', customerId],
    queryFn: () => getCollectionsEvents(customerId),
    enabled: !!customerId,
  })
}

export function useAllCollectionsEvents(options = {}) {
  return useQuery({
    queryKey: ['all-collections-events', options],
    queryFn: () => getAllCollectionsEvents(options),
    staleTime: 30000,
  })
}

export function useCreateCollectionsEvent() {
  return useMutation({
    mutationFn: createCollectionsEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections-summary'] })
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['collections-events'] })
      queryClient.invalidateQueries({ queryKey: ['all-collections-events'] })
    },
  })
}

export function useUpdateCollectionsEvent() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCollectionsEvent(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections-events'] }),
  })
}

export function useEscalateInvoice() {
  return useMutation({
    mutationFn: ({ invoiceId, level }) => escalateInvoice(invoiceId, level),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections-summary'] })
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] })
    },
  })
}
