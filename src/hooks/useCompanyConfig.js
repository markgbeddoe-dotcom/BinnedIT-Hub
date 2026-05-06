/**
 * @file useCompanyConfig.js
 *
 * Reads the company identity config (ABN, ACN, BSB, addresses, etc.) used by
 * the legal-letter templates. Stored in `platform_settings` (key/value table,
 * migration 015) with keys: `company.name`, `company.abn`, `company.acn`,
 * `company.address`, `company.phone`, `company.email`, `company.bsb`,
 * `company.account_number`, `company.penalty_interest_rate`.
 *
 * Returns a company config object with PLACEHOLDER fallbacks for any missing
 * keys, plus a `hasPlaceholders` boolean flagging whether the config contains
 * the ABN sentinel `57 123 456 789` (audit P0-11). Callers MUST gate any
 * "Send" action on `hasPlaceholders === false`.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const PLACEHOLDER_ABN = '57 123 456 789'

const PLACEHOLDERS = {
  name: 'Binned-IT Pty Ltd',
  abn: PLACEHOLDER_ABN,
  acn: '123 456 789',
  address: '12 Industrial Way, Seaford VIC 3198',
  phone: '03 9000 0000',
  email: 'accounts@binnedit.com.au',
  bsb: '063-000',
  account_number: '1234 5678',
  penalty_interest_rate: '10',
}

const SETTING_KEYS = [
  'company.name',
  'company.abn',
  'company.acn',
  'company.address',
  'company.phone',
  'company.email',
  'company.bsb',
  'company.account_number',
  'company.penalty_interest_rate',
]

async function fetchCompanyConfig() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', SETTING_KEYS)
  if (error) {
    // Non-fatal — fall back to placeholders. Log so the issue is visible in dev.
    console.warn('useCompanyConfig: platform_settings read failed; using placeholders', error.message)
    return null
  }
  const map = Object.fromEntries((data || []).map(r => [r.key.replace(/^company\./, ''), r.value]))
  return map
}

export function useCompanyConfig() {
  const q = useQuery({
    queryKey: ['company-config'],
    queryFn: fetchCompanyConfig,
    staleTime: 60 * 60 * 1000, // 1h — rarely changes
    retry: 1,
  })

  const fromDb = q.data || {}
  // Merge: db overrides placeholder for any non-empty value
  const company = Object.fromEntries(
    Object.entries(PLACEHOLDERS).map(([k, def]) => {
      const v = fromDb[k]
      return [k, v && String(v).trim() ? v : def]
    })
  )

  const hasPlaceholders =
    company.abn === PLACEHOLDER_ABN ||
    company.bsb === PLACEHOLDERS.bsb ||
    company.account_number === PLACEHOLDERS.account_number

  return { company, hasPlaceholders, loading: q.isLoading, error: q.error }
}

// Exported so legalTemplates.js + tests can detect the sentinel
export const PLACEHOLDER_VALUES = PLACEHOLDERS
