import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  getCustomerNotes,
  addCustomerNote,
} from '../api/customers'
import { queryClient } from './queryClient'

export function useCustomers({ search = '', churnFilter = 'all' } = {}) {
  return useQuery({
    queryKey: ['customers', search, churnFilter],
    queryFn: () => getCustomers({ search, churnFilter }),
    staleTime: 30000,
  })
}

export function useCustomer(id) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomer(id, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] })
    },
  })
}

export function useCustomerNotes(customerId) {
  return useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: () => getCustomerNotes(customerId),
    enabled: !!customerId,
  })
}

export function useAddCustomerNote() {
  return useMutation({
    mutationFn: ({ customerId, note }) => addCustomerNote(customerId, note),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', variables.customerId] })
    },
  })
}
