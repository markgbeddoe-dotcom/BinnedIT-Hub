import { useQuery, useMutation } from '@tanstack/react-query'
import { getBookings, updateBookingStatus, createBooking } from '../api/bookings'
import { queryClient } from './queryClient'

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings,
  })
}

export function useUpdateBookingStatus() {
  return useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
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
