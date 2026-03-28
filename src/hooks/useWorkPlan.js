import { useQuery, useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getWorkPlanItems, markItemComplete, unmarkItemComplete } from '../api/workplan'
import { queryClient } from './queryClient'
import { supabase } from '../lib/supabase'

export function useWorkPlanItems() {
  const query = useQuery({
    queryKey: ['workplan'],
    queryFn: getWorkPlanItems,
  })

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('workplan-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_plan_completions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['workplan'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return query
}

export function useMarkComplete() {
  return useMutation({
    mutationFn: ({ itemId, notes }) => markItemComplete(itemId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workplan'] })
    },
  })
}

export function useUnmarkComplete() {
  return useMutation({
    mutationFn: ({ itemId }) => unmarkItemComplete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workplan'] })
    },
  })
}
