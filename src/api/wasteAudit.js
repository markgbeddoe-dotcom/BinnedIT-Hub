// WP-D (R5) — client data access for AI waste audits + billing adjustments.
// FR7.5.5. All billing adjustments are INTERNAL records only — nothing here
// (or anywhere in this flow) writes to Xero.

import { supabase } from '../lib/supabase'

const MAX_EDGE_PX = 1568 // Claude's effective per-image ceiling (ADR-705)

/**
 * Resize an image File/Blob client-side to ≤1568px long edge and return
 * { base64, mediaType }. Mandatory before calling the analyze endpoint —
 * a raw 12MP phone photo wastes bandwidth and tokens (ADR-705).
 * Falls back to the raw file if canvas decoding fails (server still
 * enforces the 5MB cap).
 */
export async function fileToResizedBase64(file, maxEdge = MAX_EDGE_PX) {
  const readAsBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result || '')
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    r.onerror = () => reject(new Error('Could not read photo'))
    r.readAsDataURL(blob)
  })

  try {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('decode failed'))
        i.src = url
      })
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const comma = dataUrl.indexOf(',')
      return { base64: dataUrl.slice(comma + 1), mediaType: 'image/jpeg' }
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch {
    // Canvas path failed (odd format / no DOM) — send the original bytes.
    const base64 = await readAsBase64(file)
    const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      ? file.type : 'image/jpeg'
    return { base64, mediaType }
  }
}

/**
 * Run the AI bin-content analysis for a collection photo.
 * @param {object} p
 * @param {string} p.bookingId
 * @param {File|Blob} p.file           the photo just captured
 * @param {string} [p.declaredWasteType]
 * @param {string} [p.photoId]         job_photos.id of the uploaded photo
 * @returns {Promise<{audit: object, low_confidence: boolean}>}
 */
export async function analyzeBinPhoto({ bookingId, file, declaredWasteType, photoId }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not signed in')

  const { base64, mediaType } = await fileToResizedBase64(file)

  const res = await fetch('/api/analyze-bin-photo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      bookingId,
      imageBase64: base64,
      mediaType,
      declaredWasteType: declaredWasteType || undefined,
      photoId: photoId || undefined,
    }),
  })

  let payload = null
  try { payload = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    throw new Error(payload?.error || `AI analysis failed (${res.status})`)
  }
  return payload // { audit, low_confidence }
}

/**
 * List waste audits for the office review queue, with booking, photo and
 * adjustment context embedded.
 * @param {object} [p]
 * @param {'pending'|'resolved'|'all'} [p.status='pending']
 */
export async function listAudits({ status = 'pending' } = {}) {
  let query = supabase
    .from('waste_audits')
    .select(`
      *,
      bookings ( id, customer_name, bin_size, waste_type, address, suburb ),
      job_photos ( id, photo_url, storage_path ),
      billing_adjustments ( * )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status === 'pending') query = query.eq('status', 'pending_review')
  else if (status === 'resolved') query = query.in('status', ['confirmed', 'dismissed'])

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** Driver flags an audit for office attention (with an optional note). */
export async function flagAudit({ auditId, note }) {
  const { data, error } = await supabase
    .from('waste_audits')
    .update({ driver_flagged: true, driver_note: note || null })
    .eq('id', auditId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Create a billing adjustment (internal record only — never pushed to Xero). */
export async function createAdjustment({ bookingId, wasteAuditId, amount, reason, createdBy }) {
  const { data, error } = await supabase
    .from('billing_adjustments')
    .insert({
      booking_id: bookingId,
      waste_audit_id: wasteAuditId || null,
      amount: amount == null || amount === '' ? null : Number(amount),
      reason: reason || null,
      status: 'draft',
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Approve an adjustment (owner/manager). Sets amount/reason, marks the
 * adjustment approved and the parent audit confirmed.
 * Creates the adjustment first if the audit has none yet.
 * INTERNAL record only — not pushed to Xero (XERO_WRITE_ENABLED doctrine).
 */
export async function approveAdjustment({ audit, adjustmentId, amount, reason, userId }) {
  let adjId = adjustmentId
  if (!adjId) {
    const created = await createAdjustment({
      bookingId: audit.booking_id,
      wasteAuditId: audit.id,
      amount,
      reason,
      createdBy: userId,
    })
    adjId = created.id
  }

  const { data, error } = await supabase
    .from('billing_adjustments')
    .update({
      amount: amount == null || amount === '' ? null : Number(amount),
      reason: reason || null,
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', adjId)
    .select()
    .single()
  if (error) throw error

  const { error: auditErr } = await supabase
    .from('waste_audits')
    .update({ status: 'confirmed' })
    .eq('id', audit.id)
  if (auditErr) throw auditErr

  return data
}

/** Reject an adjustment / dismiss the audit (owner/manager). */
export async function rejectAdjustment({ audit, adjustmentId, reason, userId }) {
  if (adjustmentId) {
    const { error } = await supabase
      .from('billing_adjustments')
      .update({
        status: 'rejected',
        reason: reason || 'AI false positive',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', adjustmentId)
    if (error) throw error
  }

  const { error: auditErr } = await supabase
    .from('waste_audits')
    .update({ status: 'dismissed' })
    .eq('id', audit.id)
  if (auditErr) throw auditErr
}

/**
 * Suggested adjustment rate from the rules engine, if seeded.
 * Queries business_rules directly (per build rules: do NOT import another
 * WP's module tonight). Returns a number or null → panel leaves the
 * amount field blank when null (hardcoded-fallback convention).
 */
export async function getSuggestedAdjustmentRate() {
  try {
    const { data, error } = await supabase
      .from('business_rules')
      .select('rule_key, value, enabled')
      .eq('rule_key', 'weight_overage_rate_per_tonne')
      .limit(1)
    if (error || !data || data.length === 0) return null
    const row = data[0]
    if (row.enabled === false) return null
    const v = typeof row.value === 'object' && row.value !== null ? row.value.amount : row.value
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null // table missing / RLS — fall back to blank
  }
}
