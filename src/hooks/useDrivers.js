import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// WP-A (R1 / FR7.1.2): driver + truck rosters for dispatch assignment.
//
// Hardcoded-fallback convention: both hooks resolve to [] on ANY error
// (table missing, RLS denial, network) so consuming UIs render their
// empty-roster fallbacks instead of crashing or showing error states.

/**
 * Drivers = profiles where role = 'driver'.
 * Returns [{ id (uuid, references auth.users), full_name }] sorted by name.
 * Empty until migration 022 (adds 'driver' to the profiles.role CHECK)
 * is applied and drivers are onboarded via the Team page.
 */
export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'driver')
          .order('full_name', { ascending: true })
        if (error) return []
        return data ?? []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })
}

/**
 * Trucks = fleet_assets where asset_type = 'truck' AND is_active.
 * Returns [{ id (uuid), identifier (text — what bookings.truck_id stores),
 * description }] sorted by identifier.
 * NOTE: bookings.truck_id is a TEXT column (no FK — see GAP-053), so
 * consumers should write `identifier`, not the fleet_assets uuid.
 */
export function useTrucks() {
  return useQuery({
    queryKey: ['trucks'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('fleet_assets')
          .select('id, identifier, description')
          .eq('asset_type', 'truck')
          .eq('is_active', true)
          .order('identifier', { ascending: true })
        if (error) return []
        return data ?? []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })
}
