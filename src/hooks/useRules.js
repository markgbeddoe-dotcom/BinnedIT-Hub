/**
 * @file useRules.js — TanStack Query wrappers for the business rules engine (WP-F, ADR-704)
 *
 * Rule reads are live (FR7.6.6): staleTime 60 s, invalidated on every mutation,
 * so a saved change applies to the next computation that reads it — no deploy.
 *
 * Fail-safe convention (ADR-704, documented here on purpose):
 *  - SAFETY-category rules fail CLOSED: if the table is empty/unreachable or
 *    the rule is disabled, useRuleValue/getRule return the restrictive default
 *    (e.g. checklist_block_shift → true).
 *  - Economic rules fail to their hardcoded fallback defaults (RULE_DEFAULTS
 *    in src/api/rules.js mirrors the migration 026 seeds).
 * Every consumer should still pass its own explicit fallback.
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import {
  getRules,
  getRuleHistory,
  updateRule,
  toggleRule,
  resolveRuleValue,
} from '../api/rules'

/** All business rules. data is [] until loaded; isError ⇒ consumers fall back to defaults. */
export function useRules() {
  return useQuery({
    queryKey: ['business-rules'],
    queryFn: getRules,
    staleTime: 60_000,
    retry: 1,
  })
}

/**
 * Live resolved value for one rule key, with fail-safe fallback.
 * Usable from any component without extra fetches (shares the useRules cache).
 *
 *   const blockShift = useRuleValue('checklist_block_shift', true)
 *
 * @param {string} key rule_key
 * @param {*} [defaultValue] explicit fallback (wins over RULE_DEFAULTS)
 * @returns {*} resolved value — defaults while loading, on error, when the
 *   rule is missing, or when the rule is disabled.
 */
export function useRuleValue(key, defaultValue) {
  const { data } = useRules()
  const row = Array.isArray(data) ? data.find(r => r.rule_key === key) : null
  return resolveRuleValue(row, key, defaultValue)
}

/** Mutation: change a rule's value. usage: mutate({ key, value }) */
export function useUpdateRule() {
  return useMutation({
    mutationFn: ({ key, value }) => updateRule(key, value),
    onSuccess: (_data, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] })
      queryClient.invalidateQueries({ queryKey: ['business-rule-history', key] })
    },
  })
}

/** Mutation: enable/disable a rule. usage: mutate({ key, enabled }) */
export function useToggleRule() {
  return useMutation({
    mutationFn: ({ key, enabled }) => toggleRule(key, enabled),
    onSuccess: (_data, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['business-rules'] })
      queryClient.invalidateQueries({ queryKey: ['business-rule-history', key] })
    },
  })
}

/** Audit trail for one rule, newest first. Returns [] on failure (non-blocking). */
export function useRuleHistory(key) {
  return useQuery({
    queryKey: ['business-rule-history', key],
    queryFn: () => getRuleHistory(key),
    enabled: !!key,
    staleTime: 30_000,
  })
}
