import { useQuery, useMutation } from '@tanstack/react-query'
import { getInvoices, getInvoice, updateInvoiceStatus, getInvoiceSummary } from '../api/invoices'
import { queryClient } from './queryClient'

export function useInvoices(statusFilter = 'all') {
  return useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => getInvoices({ status: statusFilter }),
  })
}

export function useInvoice(id) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
    enabled: !!id,
  })
}

export function useInvoiceSummary() {
  return useQuery({
    queryKey: ['invoice-summary'],
    queryFn: getInvoiceSummary,
  })
}

export function useUpdateInvoiceStatus() {
  return useMutation({
    mutationFn: ({ id, status }) => updateInvoiceStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] })
    },
  })
}
