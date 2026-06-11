/**
 * @file rules.js — business rules engine data access (WP-F, R6, ADR-704)
 *
 * One funnel for every rule read in the app. The RULE_DEFAULTS map mirrors the
 * migration 026 seeds exactly — if the table is empty, missing, or Supabase
 * errors, consumers get these hardcoded values and never crash (hardcoded
 * fallback convention).
 *
 * Fail-safe semantics (ADR-704):
 *  - SAFETY-category rules fail CLOSED — their defaults are the restrictive
 *    value (e.g. checklist_block_shift: true), so an unreadable table can
 *    never relax a safety gate.
 *  - Economic rules fail to their fallback defaults.
 *  - A rule that exists but is DISABLED resolves to the fallback default,
 *    not to its stored value.
 */

import { supabase } from '../lib/supabase'

// Mirrors the 026_business_rules.sql seeds. Keep the two in sync.
export const RULE_DEFAULTS = {
  fuel_cost_per_km: {
    value: 0.68, value_type: 'number', category: 'routing', unit: '$/km',
    name: 'Fuel cost per km',
    description: 'Cost of fuel per kilometre. Used in tip-decision ranking and route costing.',
  },
  driver_cost_per_hour: {
    value: 45, value_type: 'number', category: 'routing', unit: '$/hr',
    name: 'Driver cost per hour',
    description: 'Fully-loaded driver labour cost per hour. Used in tip-decision ranking.',
  },
  tip_search_radius_km: {
    value: 25, value_type: 'number', category: 'tipping', unit: 'km',
    name: 'Tip search radius',
    description: 'Maximum radius (km) to search for candidate tip sites after a pickup.',
  },
  redeploy_bin_savings_min: {
    value: 25, value_type: 'number', category: 'tipping', unit: '$',
    name: 'Redeploy savings minimum',
    description: 'Minimum dollar saving before suggesting tip-and-redeploy over return-to-base.',
  },
  checklist_block_shift: {
    value: true, value_type: 'boolean', category: 'safety', unit: '',
    name: 'Checklist blocks shift',
    description: "Drivers cannot see or start jobs until today's pre-start checklist passes. Safety rule — fails closed when unreadable.",
  },
  weight_overage_threshold_pct: {
    value: 15, value_type: 'number', category: 'billing', unit: '%',
    name: 'Weight overage threshold',
    description: 'Flag a load for billing review when estimated weight exceeds declared weight by this percentage.',
  },
  weight_overage_rate_per_tonne: {
    value: 95, value_type: 'number', category: 'billing', unit: '$/t',
    name: 'Weight overage rate per tonne',
    description: 'Rate per tonne used to draft weight-overage billing adjustments (internal record only — never pushed to Xero).',
  },
  adjustment_requires_approval: {
    value: true, value_type: 'boolean', category: 'billing', unit: '',
    name: 'Adjustment requires approval',
    description: 'Billing adjustments need owner/manager approval before being marked applied. Applied is an internal ledger state — Xero is never written.',
  },
  max_jobs_per_truck_day: {
    value: 8, value_type: 'number', category: 'dispatch', unit: 'jobs',
    name: 'Max jobs per truck per day',
    description: 'Soft cap on jobs assigned to one truck in a day. Dispatch shows a warning chip beyond this.',
  },
  ai_confidence_floor: {
    value: 0.5, value_type: 'number', category: 'billing', unit: '',
    name: 'AI confidence floor',
    description: 'Minimum AI confidence (0–1) for a waste-audit result to auto-draft a billing adjustment. Below this, audits are stored for human review only.',
  },
}

/**
 * Resolve a rule row to a usable value, applying the ADR-704 fail-safe rules.
 * Pure helper — also used by useRuleValue() and the RulesEnginePage fallback.
 *
 * @param {object|null} row business_rules row (or null/undefined)
 * @param {string} key rule_key
 * @param {*} [fallback] explicit consumer fallback (wins over RULE_DEFAULTS)
 */
export function resolveRuleValue(row, key, fallback) {
  const def = RULE_DEFAULTS[key]
  const fb = fallback !== undefined ? fallback : (def ? def.value : undefined)
  if (!row) return fb                 // missing table / missing rule → default
  if (row.enabled === false) return fb // disabled rule → default (safety defaults are closed)
  return row.value
}

/** Build fallback rows shaped like business_rules rows (for UI when the table is unreachable). */
export function getDefaultRuleRows() {
  return Object.entries(RULE_DEFAULTS).map(([rule_key, d]) => ({
    id: `default-${rule_key}`,
    rule_key,
    category: d.category,
    name: d.name,
    description: d.description,
    value: d.value,
    value_type: d.value_type,
    enabled: true,
    updated_by: null,
    updated_at: null,
    _fallback: true,
  }))
}

/**
 * All rules, ordered by category then name. Throws on Supabase error —
 * callers (useRules) surface the error state and the UI falls back to
 * getDefaultRuleRows() with edits disabled.
 */
export async function getRules() {
  // Try with the updated-by profile name joined; if the relationship is not
  // available (e.g. migration not applied to schema cache yet) retry plain.
  let { data, error } = await supabase
    .from('business_rules')
    .select('*, updated_profile:profiles(full_name)')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    const plain = await supabase
      .from('business_rules')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })
    if (plain.error) throw plain.error
    data = plain.data
  }
  return data || []
}

/**
 * Single rule value, resolved with fail-safe defaults. NEVER throws —
 * safe to call from gates and engines (tipDecision, checklist gate).
 *
 * @returns {Promise<*>} the resolved value (number/boolean/string/object)
 */
export async function getRule(key, defaultValue) {
  try {
    const { data, error } = await supabase
      .from('business_rules')
      .select('*')
      .eq('rule_key', key)
      .maybeSingle()
    if (error) return resolveRuleValue(null, key, defaultValue)
    return resolveRuleValue(data, key, defaultValue)
  } catch {
    return resolveRuleValue(null, key, defaultValue)
  }
}

/** Update a rule's value. History row is written by the DB trigger. Throws on error. */
export async function updateRule(key, value) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('business_rules')
    .update({ value, updated_by: session?.user?.id ?? null })
    .eq('rule_key', key)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Enable/disable a rule. History row is written by the DB trigger. Throws on error. */
export async function toggleRule(key, enabled) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase
    .from('business_rules')
    .update({ enabled: !!enabled, updated_by: session?.user?.id ?? null })
    .eq('rule_key', key)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Audit trail for one rule, newest first. Returns [] on any failure —
 * history is informational, never blocking.
 */
export async function getRuleHistory(key) {
  try {
    let { data, error } = await supabase
      .from('business_rule_history')
      .select('*, changed_profile:profiles(full_name)')
      .eq('rule_key', key)
      .order('changed_at', { ascending: false })
    if (error) {
      const plain = await supabase
        .from('business_rule_history')
        .select('*')
        .eq('rule_key', key)
        .order('changed_at', { ascending: false })
      if (plain.error) return []
      data = plain.data
    }
    return data || []
  } catch {
    return []
  }
}
