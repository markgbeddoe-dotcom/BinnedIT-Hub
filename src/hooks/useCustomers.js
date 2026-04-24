import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getCustomers, getCustomer, createCustomer, updateCustomer,
  getCustomerContacts, createCustomerContact, updateCustomerContact, deleteCustomerContact,
  getCustomerDirectors, createCustomerDirector, updateCustomerDirector, deleteCustomerDirector,
  getCustomerTradeRefs, createCustomerTradeRef, updateCustomerTradeRef,
  getCreditApplication, createCreditApplication, updateCreditApplication,
  getAccountContracts, createAccountContract,
  getCustomerNotes, addCustomerNote,
  getPaymentHistory, runCreditorWatchCheck,
} from '../api/customers'
import { queryClient } from './queryClient'

// ── Customers ─────────────────────────────────────────────────────────────────

export function useCustomers(filters = {}) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => getCustomers(filters),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomer(id, updates),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer', v.id] })
    },
  })
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export function useCustomerContacts(customerId) {
  return useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: () => getCustomerContacts(customerId),
    enabled: !!customerId,
  })
}

export function useCreateContact() {
  return useMutation({
    mutationFn: createCustomerContact,
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['customer-contacts', v.customer_id] }),
  })
}

export function useUpdateContact() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomerContact(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-contacts'] }),
  })
}

export function useDeleteContact() {
  return useMutation({
    mutationFn: deleteCustomerContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-contacts'] }),
  })
}

// ── Directors ─────────────────────────────────────────────────────────────────

export function useCustomerDirectors(customerId) {
  return useQuery({
    queryKey: ['customer-directors', customerId],
    queryFn: () => getCustomerDirectors(customerId),
    enabled: !!customerId,
  })
}

export function useCreateDirector() {
  return useMutation({
    mutationFn: createCustomerDirector,
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['customer-directors', v.customer_id] }),
  })
}

export function useUpdateDirector() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomerDirector(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-directors'] }),
  })
}

export function useDeleteDirector() {
  return useMutation({
    mutationFn: deleteCustomerDirector,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-directors'] }),
  })
}

// ── Trade references ──────────────────────────────────────────────────────────

export function useCustomerTradeRefs(customerId) {
  return useQuery({
    queryKey: ['customer-trade-refs', customerId],
    queryFn: () => getCustomerTradeRefs(customerId),
    enabled: !!customerId,
  })
}

export function useCreateTradeRef() {
  return useMutation({
    mutationFn: createCustomerTradeRef,
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['customer-trade-refs', v.customer_id] }),
  })
}

export function useUpdateTradeRef() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCustomerTradeRef(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-trade-refs'] }),
  })
}

// ── Credit application ────────────────────────────────────────────────────────

export function useCreditApplication(customerId) {
  return useQuery({
    queryKey: ['credit-application', customerId],
    queryFn: () => getCreditApplication(customerId),
    enabled: !!customerId,
  })
}

export function useCreateCreditApplication() {
  return useMutation({
    mutationFn: createCreditApplication,
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['credit-application', v.customer_id] }),
  })
}

export function useUpdateCreditApplication() {
  return useMutation({
    mutationFn: ({ id, updates }) => updateCreditApplication(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credit-application'] }),
  })
}

// ── Account contracts ─────────────────────────────────────────────────────────

export function useAccountContracts(customerId) {
  return useQuery({
    queryKey: ['account-contracts', customerId],
    queryFn: () => getAccountContracts(customerId),
    enabled: !!customerId,
  })
}

export function useCreateAccountContract() {
  return useMutation({
    mutationFn: createAccountContract,
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['account-contracts', v.customer_id] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

// ── Notes ─────────────────────────────────────────────────────────────────────

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
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['customer-notes', v.customerId] }),
  })
}

// ── Payment history ───────────────────────────────────────────────────────────

export function usePaymentHistory(customerId) {
  return useQuery({
    queryKey: ['payment-history', customerId],
    queryFn: () => getPaymentHistory(customerId),
    enabled: !!customerId,
  })
}

// ── CreditorWatch ─────────────────────────────────────────────────────────────

export function useRunCreditorWatch() {
  return useMutation({
    mutationFn: ({ customerId, abn }) => runCreditorWatchCheck(customerId, abn),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['customer', v.customerId] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
