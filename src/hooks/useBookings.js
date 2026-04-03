import { useQuery, useMutation } from '@tanstack/react-query'
import { getBookings, updateBookingStatus, createBooking } from '../api/bookings'
import { queryClient } from './queryClient'
import { supabase } from '../lib/supabase'

/** Fire-and-forget: call the invoice-generate API when a job is completed. */
async function triggerInvoiceGeneration(bookingId) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/invoice-generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ booking_id: bookingId }),
    })
    // Invalidate invoices queries so the Invoices page refreshes
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    queryClient.invalidateQueries({ queryKey: ['invoice-summary'] })
  } catch {
    // Non-fatal — invoice can be generated manually later
  }
}

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings,
  })
}

export function useUpdateBookingStatus() {
  return useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, status),
    onSuccess: (data, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      // Auto-generate invoice when job is marked as completed
      if (status === 'completed') {
        triggerInvoiceGeneration(id)
      }
    },
  })
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
