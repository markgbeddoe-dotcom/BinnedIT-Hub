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
    // WP-A (R1 / FR7.1.4): createBooking now accepts optional assignment
    // fields — driver_id (uuid), driver_name_assigned, driver_name (legacy
    // display), truck_id (text identifier), scheduled_date. Empty strings
    // are normalised to null so date/uuid columns don't reject ''.
    mutationFn: (booking) => {
      const b = { ...booking }
      for (const k of ['driver_id', 'driver_name_assigned', 'driver_name', 'truck_id', 'scheduled_date']) {
        if (k in b && !b[k]) b[k] = null
      }
      return createBooking(b)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

/**
 * WP-A (R1 / FR7.1.6): status transition rule for driver assignment.
 * A pending job becomes scheduled once it has BOTH a driver and a date.
 * Exported so DispatchBoard can mirror the rule for optimistic updates.
 */
export function assignmentStatusFor(currentStatus, driverId, scheduledDate) {
  if (currentStatus === 'pending' && driverId && scheduledDate) return 'scheduled'
  return currentStatus
}

/**
 * WP-A (R1 / FR7.1.3, FR7.1.6, FR7.1.7): assign/reassign/clear driver,
 * truck and scheduled date on a booking — one atomic UPDATE.
 * Writes driver_id (uuid, source of truth) + driver_name_assigned AND the
 * legacy driver_name display field in the same statement (ADR-708 risk 10:
 * the two must never diverge). Pass driver_id: null to unassign.
 *
 * Args: { id, driver_id, driver_name, truck_id, scheduled_date, currentStatus }
 */
export function useAssignDriver() {
  return useMutation({
    mutationFn: async ({ id, driver_id, driver_name, truck_id, scheduled_date, currentStatus }) => {
      const update = {
        driver_id: driver_id || null,
        driver_name_assigned: driver_name || null,
        driver_name: driver_name || null,
        truck_id: truck_id || null,
        scheduled_date: scheduled_date || null,
        updated_at: new Date().toISOString(),
      }
      const nextStatus = assignmentStatusFor(currentStatus, driver_id, scheduled_date)
      if (nextStatus && nextStatus !== currentStatus) update.status = nextStatus
      const { data, error } = await supabase
        .from('bookings')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
