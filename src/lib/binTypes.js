/**
 * @file src/lib/binTypes.js
 *
 * Single source of truth for bin-type names across SkipSync. Closes audit
 * P1 #14 (bin-type name fragmentation: four parallel naming conventions
 * across binTypesData / pricingData / CompetitorPage rates / Supabase
 * bin_type_performance, with manual mapping in PricingTab).
 *
 * Canonical format: "<size>m <category>"
 *   - size: '2m' | '4m' | '6m' | '8m' | '10m' | '12m' | '16m' | '23m'
 *   - category: 'General Waste' | 'Asbestos' | 'Soil' | 'Green Waste' | 'Concrete'
 *
 * Examples:
 *   '4m General Waste', '6m Asbestos', '8m Soil', '10m Green Waste'
 *
 * `normalizeBinType(name)` accepts ANY of the legacy formats and returns the
 * canonical form, or `null` if the input cannot be mapped (caller MUST handle
 * null — never silently default to General Waste).
 *
 * Vitest in src/lib/binTypes.test.js documents every accepted variant.
 */

const SIZES = ['2m', '4m', '6m', '8m', '10m', '12m', '16m', '23m']
const CATEGORIES = ['General Waste', 'Asbestos', 'Soil', 'Green Waste', 'Concrete']

export const CANONICAL_BIN_TYPES = SIZES.flatMap(s => CATEGORIES.map(c => `${s} ${c}`))

// Prefix → category map. Order matters: longer matches first.
const PREFIX_CATEGORY = [
  { prefix: /^\s*(wmf|gw|w)\b|^\s*(wmf|gw|w)\s*-/i, category: 'General Waste' },
  { prefix: /^\s*(asb|asbestos)\b|^\s*(asb|asbestos)\s*-/i, category: 'Asbestos' },
  { prefix: /^\s*(soi|s)\b|^\s*(soi|s)\s*-/i, category: 'Soil' },
  { prefix: /^\s*(grw|gw|g)\b|^\s*(grw)\s*-/i, category: 'Green Waste' },
  { prefix: /^\s*(con|c)\b|^\s*(con|c)\s*-/i, category: 'Concrete' },
]

// Note: property is `regex` not `test` to avoid shadowing Vitest's global `test`
// when this file is imported into a vitest test (which it is — binTypes.test.js).
const KEYWORD_CATEGORY = [
  { regex: /asbestos|\basb\b/i, category: 'Asbestos' },
  { regex: /contaminated\s*soil|\bsoil\b|\bsoi\b|csoil/i, category: 'Soil' },
  { regex: /green\s*waste|\bgreen\b|\bgrw\b/i, category: 'Green Waste' },
  { regex: /general\s*waste|waste\s*management\s*fees|\bgw\b|\bwmf\b/i, category: 'General Waste' },
  { regex: /concrete|\bcon\b/i, category: 'Concrete' },
]

// Detect size token in the input. Match 'big' to 'big-m' (no canonical for it; flagged below).
function extractSize(name) {
  const m = String(name || '').match(/(\d+)\s*[mM]/)
  if (m) {
    const n = parseInt(m[1], 10)
    const candidate = `${n}m`
    return SIZES.includes(candidate) ? candidate : null
  }
  return null
}

function extractCategory(name) {
  const n = String(name || '').trim()
  if (!n) return null
  for (const { prefix, category } of PREFIX_CATEGORY) {
    if (prefix.test(n)) return category
  }
  for (const { regex, category } of KEYWORD_CATEGORY) {
    if (regex.test(n)) return category
  }
  return null
}

/**
 * Normalize a bin-type name from any of the legacy formats into canonical.
 * Returns null if the name cannot be confidently mapped.
 */
export function normalizeBinType(name) {
  const n = String(name || '').trim()
  if (!n) return null

  // Already canonical?
  if (CANONICAL_BIN_TYPES.includes(n)) return n

  // Strip Xero account-code suffix like "(305)"
  const stripped = n.replace(/\s*\(\d+\)\s*$/, '').trim()

  // Try size + category extraction. Prefer the prefix-based category since
  // the keyword matcher would catch overlapping words like "soil" inside
  // "Asbestos & Soil tipping (mixed)".
  const size = extractSize(stripped)
  const category = extractCategory(stripped)
  if (size && category) return `${size} ${category}`

  // Special handling for the legacy "ASB - Bigm" / "W - Bigm Heavy" — Big-m
  // historically maps to 8m for pricing comparison purposes. Document the
  // ambiguity by NOT silently mapping; return null so callers can decide.
  if (/big\s*m/i.test(stripped)) return null

  return null
}

/**
 * For competitor rate lookups: case-insensitive, handles "4m³" vs "4m" vs "4M".
 * Returns the canonical name OR null.
 */
export function normalizeCompetitorBinType(name) {
  const n = String(name || '').trim()
  if (!n) return null
  // Drop "³" cubic-metre superscript and "GW" → "General Waste"
  const cleaned = n
    .replace(/[³]/g, '')
    .replace(/\bgw\b/i, 'General Waste')
    .replace(/\basb\b/i, 'Asbestos')
    .trim()
  return normalizeBinType(cleaned)
}

/** True if the input is already in canonical form. */
export function isCanonicalBinType(name) {
  return CANONICAL_BIN_TYPES.includes(String(name || '').trim())
}
