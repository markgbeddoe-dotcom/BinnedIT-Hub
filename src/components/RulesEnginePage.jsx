/**
 * @file RulesEnginePage.jsx — management UI for the business rules engine
 * (WP-F, R6, GAP-015, FR7.6.4/FR7.6.7, ux-spec-v7 §6.2, ADR-704)
 *
 * Owner/manager only — role is checked HERE (content gate), not just at the
 * route. Light office theme (B.* tokens), useBreakpoint for mobile.
 *
 * Per value_type editors:
 *  - number: inline stepper input, amber border while editing, Save/Cancel,
 *    Enter saves / Esc cancels, client-side numeric validation (FR7.6.7).
 *  - boolean: toggle saving immediately with a 5 s Undo toast.
 *  - string: inline text input with Save/Cancel.
 *  - json: side-panel editor with JSON validation (Save disabled when invalid).
 * Safety-category rules get type-the-rule-name friction before being turned off.
 *
 * Fallback: if business_rules is empty/unreachable the page renders the
 * RULE_DEFAULTS as read-only rows under an amber banner — never a blank crash.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { B, fontHead, fontBody } from '../theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useAuth } from '../context/AuthContext'
import { useRules, useUpdateRule, useToggleRule, useRuleHistory } from '../hooks/useRules'
import { RULE_DEFAULTS, getDefaultRuleRows } from '../api/rules'

const CATEGORIES = [
  { key: 'routing',  label: 'Routing' },
  { key: 'tipping',  label: 'Tipping' },
  { key: 'billing',  label: 'Billing' },
  { key: 'safety',   label: 'Safety' },
  { key: 'pricing',  label: 'Pricing' },
  { key: 'dispatch', label: 'Dispatch' },
]

function fmtVal(v) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF'
  if (typeof v === 'object') {
    if ('enabled' in v && Object.keys(v).length === 1) return v.enabled ? 'Rule enabled' : 'Rule disabled'
    return JSON.stringify(v)
  }
  return String(v)
}

function timeAgo(ts) {
  if (!ts) return null
  const ms = Date.now() - new Date(ts).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function validateNumber(key, raw) {
  const n = parseFloat(raw)
  if (raw === '' || raw === null || !Number.isFinite(n)) return { ok: false, msg: 'Enter a number' }
  if (n < 0) return { ok: false, msg: 'Must be 0 or more' }
  if (key === 'ai_confidence_floor' && n > 1) return { ok: false, msg: 'Must be between 0 and 1' }
  if (RULE_DEFAULTS[key]?.unit === '%' && n > 100) return { ok: false, msg: 'Must be 100 or less' }
  return { ok: true, value: n }
}

// ── Small shared widgets ─────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled, testId, ariaLabel }) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={on}
      disabled={disabled}
      onClick={onChange}
      style={{
        minWidth: 64, minHeight: 44, padding: '0 6px',
        border: `1px solid ${on ? B.green : B.cardBorder}`,
        borderRadius: 22, background: on ? '#E6F7EE' : '#F0F2F1',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start', gap: 6,
        fontFamily: fontHead, fontSize: 11, color: on ? B.green : B.textMuted,
      }}
    >
      {on ? <span>ON</span> : null}
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: on ? B.green : B.textMuted, display: 'inline-block',
      }} />
      {!on ? <span>OFF</span> : null}
    </button>
  )
}

function Btn({ children, onClick, kind = 'ghost', disabled, testId, style }) {
  const kinds = {
    primary: { background: B.yellow, color: B.black, border: `1px solid ${B.yellowDark}` },
    danger:  { background: B.red, color: B.white, border: `1px solid ${B.red}` },
    ghost:   { background: B.white, color: B.textPrimary, border: `1px solid ${B.cardBorder}` },
  }
  return (
    <button
      type="button" data-testid={testId} disabled={disabled} onClick={onClick}
      style={{
        minHeight: 44, padding: '0 14px', borderRadius: 8, fontFamily: fontHead,
        fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        ...kinds[kind], ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Inline value editors ─────────────────────────────────────────────────────

function InlineValueEditor({ rule, disabled, onSave, saving }) {
  const isNumber = rule.value_type === 'number'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState(null)
  const inputRef = useRef(null)
  const unit = RULE_DEFAULTS[rule.rule_key]?.unit || ''

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const begin = () => {
    if (disabled) return
    setDraft(String(rule.value ?? ''))
    setErr(null)
    setEditing(true)
  }
  const cancel = () => { setEditing(false); setErr(null) }
  const save = () => {
    if (isNumber) {
      const v = validateNumber(rule.rule_key, draft)
      if (!v.ok) { setErr(v.msg); return }
      onSave(v.value); setEditing(false)
    } else {
      onSave(draft); setEditing(false)
    }
  }
  const step = (dir) => {
    const cur = parseFloat(draft)
    const base = Number.isFinite(cur) ? cur : 0
    const inc = Number.isInteger(rule.value) && Math.abs(rule.value) >= 1 ? 1 : 0.01
    const next = Math.round((base + dir * inc) * 100) / 100
    setDraft(String(next < 0 ? 0 : next))
    setErr(null)
  }

  if (!editing) {
    return (
      <button
        type="button"
        data-testid={`rule-value-${rule.rule_key}`}
        onClick={begin}
        disabled={disabled}
        title={disabled ? 'Edits disabled' : 'Click to edit'}
        style={{
          minHeight: 44, padding: '0 12px', borderRadius: 8,
          border: `1px solid ${B.cardBorder}`, background: B.white,
          fontFamily: fontBody, fontSize: 15, fontWeight: 700, color: B.textPrimary,
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving…' : fmtVal(rule.value)}{unit ? <span style={{ fontWeight: 400, color: B.textMuted, marginLeft: 4, fontSize: 12 }}>{unit}</span> : null}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isNumber && (
          <Btn testId={`rule-step-down-${rule.rule_key}`} onClick={() => step(-1)} style={{ minWidth: 44, padding: 0 }}>−</Btn>
        )}
        <input
          ref={inputRef}
          data-testid={`rule-value-input-${rule.rule_key}`}
          value={draft}
          inputMode={isNumber ? 'decimal' : 'text'}
          onChange={e => { setDraft(e.target.value); setErr(null) }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          style={{
            width: isNumber ? 90 : 200, minHeight: 44, padding: '0 10px',
            border: `2px solid ${err ? B.red : B.amber}`, borderRadius: 8,
            fontFamily: fontBody, fontSize: 15, color: B.textPrimary, background: B.white,
          }}
        />
        {isNumber && (
          <Btn testId={`rule-step-up-${rule.rule_key}`} onClick={() => step(1)} style={{ minWidth: 44, padding: 0 }}>+</Btn>
        )}
        {unit ? <span style={{ fontSize: 12, color: B.textMuted, fontFamily: fontBody }}>{unit}</span> : null}
        <Btn kind="primary" testId={`rule-save-${rule.rule_key}`} onClick={save} disabled={isNumber && !validateNumber(rule.rule_key, draft).ok}>Save</Btn>
        <Btn testId={`rule-cancel-${rule.rule_key}`} onClick={cancel}>Cancel</Btn>
      </div>
      {err && <div style={{ color: B.red, fontSize: 12, fontFamily: fontBody }}>{err}</div>}
    </div>
  )
}

// ── Drawers / modals ─────────────────────────────────────────────────────────

function JsonEditorPanel({ rule, onClose, onSave, isMobile, saving }) {
  const [text, setText] = useState(JSON.stringify(rule.value, null, 2))
  const [err, setErr] = useState(null)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const tryParse = (t) => { try { return { ok: true, value: JSON.parse(t) } } catch (e) { return { ok: false, msg: e.message } } }
  const parsed = tryParse(text)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,6,0.4)' }} />
      <div data-testid="rule-json-panel" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: isMobile ? '100%' : 420, background: B.cardBg,
        borderLeft: `1px solid ${B.cardBorder}`, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textPrimary, textTransform: 'uppercase' }}>{rule.name} — JSON</div>
          <Btn testId="rule-json-close" onClick={onClose} style={{ minWidth: 44, padding: 0 }} >×</Btn>
        </div>
        <div style={{ fontSize: 12, color: B.textMuted, fontFamily: fontBody }}>
          Advanced editor — structured values are interpreted by the code that owns this rule key.
        </div>
        <textarea
          ref={ref}
          data-testid="rule-json-textarea"
          value={text}
          onChange={e => { setText(e.target.value); setErr(null) }}
          spellCheck={false}
          style={{
            flex: 1, minHeight: 260, padding: 12, fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: 13, color: B.textPrimary, background: B.white,
            border: `2px solid ${parsed.ok ? B.cardBorder : B.red}`, borderRadius: 8, resize: 'vertical',
          }}
        />
        {!parsed.ok && <div style={{ color: B.red, fontSize: 12, fontFamily: fontBody }}>Invalid JSON: {parsed.msg}</div>}
        {err && <div style={{ color: B.red, fontSize: 12, fontFamily: fontBody }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="primary" testId="rule-json-save" disabled={!parsed.ok || saving}
            onClick={() => { const p = tryParse(text); if (p.ok) onSave(p.value); else setErr('Fix the JSON before saving') }}>
            {saving ? 'Saving…' : 'Save JSON'}
          </Btn>
          <Btn testId="rule-json-cancel" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  )
}

function SafetyConfirmModal({ rule, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])
  const match = typed.trim().toLowerCase() === rule.name.trim().toLowerCase()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,6,0.5)' }} />
      <div data-testid="safety-confirm-modal" style={{
        position: 'relative', background: B.cardBg, borderRadius: 12, padding: 24,
        maxWidth: 440, width: 'calc(100% - 32px)', border: `2px solid ${B.amber}`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textPrimary, textTransform: 'uppercase' }}>⚠ Turn off a safety rule?</div>
        <div style={{ fontSize: 14, color: B.textSecondary, fontFamily: fontBody, lineHeight: 1.5 }}>
          Turning off “{rule.name}” relaxes a safety gate (e.g. drivers could skip pre-start checks).
          Type the rule name to confirm.
        </div>
        <input
          ref={ref}
          data-testid="safety-confirm-input"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={rule.name}
          onKeyDown={e => { if (e.key === 'Enter' && match) onConfirm() }}
          style={{
            minHeight: 44, padding: '0 12px', border: `2px solid ${match ? B.green : B.cardBorder}`,
            borderRadius: 8, fontFamily: fontBody, fontSize: 15, color: B.textPrimary,
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="danger" testId="safety-confirm-off" disabled={!match} onClick={onConfirm}>Turn off anyway</Btn>
          <Btn kind="primary" testId="safety-confirm-keep" onClick={onCancel}>Keep on</Btn>
        </div>
      </div>
    </div>
  )
}

function HistoryDrawer({ rule, onClose, onRevert, isMobile, reverting }) {
  const { data: history, isLoading } = useRuleHistory(rule.rule_key)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const rows = Array.isArray(history) ? history : []
  const isEnabledFlip = (h) =>
    h.old_value && typeof h.old_value === 'object' && !Array.isArray(h.old_value) &&
    Object.keys(h.old_value).length === 1 && 'enabled' in h.old_value && rule.value_type !== 'json'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,6,0.4)' }} />
      <div data-testid="rule-history-drawer" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: isMobile ? '100%' : 380, background: B.cardBg,
        borderLeft: `1px solid ${B.cardBorder}`, padding: 20, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textPrimary, textTransform: 'uppercase' }}>↺ {rule.name}</div>
          <button ref={ref} type="button" data-testid="rule-history-close" onClick={onClose} aria-label="Close history"
            style={{ minWidth: 44, minHeight: 44, border: `1px solid ${B.cardBorder}`, borderRadius: 8, background: B.white, fontSize: 18, cursor: 'pointer', color: B.textPrimary }}>×</button>
        </div>
        {isLoading && <div style={{ color: B.textMuted, fontFamily: fontBody, fontSize: 13 }}>Loading history…</div>}
        {!isLoading && rows.length === 0 && (
          <div style={{ color: B.textMuted, fontFamily: fontBody, fontSize: 13 }}>No changes recorded yet — seed value still in effect.</div>
        )}
        {rows.map(h => (
          <div key={h.id} style={{ border: `1px solid ${B.cardBorder}`, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: fontBody, fontSize: 14, color: B.textPrimary, fontWeight: 700 }}>
              {fmtVal(h.new_value)} <span style={{ color: B.textMuted, fontWeight: 400 }}>← {fmtVal(h.old_value)}</span>
            </div>
            <div style={{ fontSize: 12, color: B.textMuted, fontFamily: fontBody }}>
              {h.changed_profile?.full_name || 'Unknown'} · {h.changed_at ? new Date(h.changed_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
            {!isEnabledFlip(h) && h.old_value !== null && h.old_value !== undefined && (
              <Btn testId={`rule-revert-${h.id}`} disabled={reverting} onClick={() => onRevert(h.old_value)} style={{ alignSelf: 'flex-start' }}>
                Revert to {fmtVal(h.old_value)}
              </Btn>
            )}
          </div>
        ))}
        <div style={{ fontSize: 11, color: B.textMuted, fontFamily: fontBody }}>
          Reverting writes a new change — history is never deleted.
        </div>
      </div>
    </div>
  )
}

// ── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({ rule, disabled, isMobile, onOpenHistory, showUndo }) {
  const updateMut = useUpdateRule()
  const toggleMut = useToggleRule()
  const [jsonOpen, setJsonOpen] = useState(false)
  const [safetyConfirm, setSafetyConfirm] = useState(null) // {action: 'value-off'|'disable'}
  const isBoolean = rule.value_type === 'boolean'
  const isSafety = rule.category === 'safety'
  const busy = updateMut.isPending || toggleMut.isPending
  const saveError = updateMut.isError || toggleMut.isError

  const saveValue = (value) => {
    const prev = rule.value
    updateMut.mutate({ key: rule.rule_key, value }, {
      onSuccess: () => {
        if (isBoolean) {
          showUndo(`${rule.name} turned ${value ? 'ON' : 'OFF'}`, () =>
            updateMut.mutate({ key: rule.rule_key, value: prev }))
        }
      },
    })
  }

  const saveEnabled = (enabled) => {
    const prev = rule.enabled
    toggleMut.mutate({ key: rule.rule_key, enabled }, {
      onSuccess: () => {
        showUndo(`${rule.name} rule ${enabled ? 'enabled' : 'disabled'}`, () =>
          toggleMut.mutate({ key: rule.rule_key, enabled: prev }))
      },
    })
  }

  const onBooleanToggle = () => {
    if (disabled || busy) return
    const next = !(rule.value === true)
    if (isSafety && !next) { setSafetyConfirm({ action: 'value-off' }); return }
    saveValue(next)
  }

  const onEnabledToggle = () => {
    if (disabled || busy) return
    const next = !rule.enabled
    if (isSafety && !next) { setSafetyConfirm({ action: 'disable' }); return }
    saveEnabled(next)
  }

  const retry = () => {
    if (updateMut.isError && updateMut.variables) updateMut.mutate(updateMut.variables)
    else if (toggleMut.isError && toggleMut.variables) toggleMut.mutate(toggleMut.variables)
  }

  return (
    <div data-testid={`rule-row-${rule.rule_key}`} style={{
      background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10,
      padding: isMobile ? 14 : '14px 18px',
      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      gap: 12, alignItems: isMobile ? 'stretch' : 'center',
      opacity: rule.enabled === false ? 0.75 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontHead, fontSize: 15, color: B.textPrimary, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {rule.name}
          {isSafety && <span style={{ fontSize: 10, color: B.red, border: `1px solid ${B.red}`, borderRadius: 4, padding: '1px 6px', fontFamily: fontHead }}>SAFETY</span>}
          {rule.enabled === false && <span style={{ fontSize: 10, color: B.textMuted, border: `1px solid ${B.cardBorder}`, borderRadius: 4, padding: '1px 6px', fontFamily: fontHead }}>DISABLED — DEFAULT APPLIES</span>}
        </div>
        <div style={{ fontSize: 13, color: B.textSecondary, fontFamily: fontBody, marginTop: 2, lineHeight: 1.4 }}>
          {rule.description}
        </div>
        <div style={{ fontSize: 11, color: B.textMuted, fontFamily: fontBody, marginTop: 4 }}>
          {rule._fallback
            ? 'Default value (table unavailable)'
            : rule.updated_at
              ? `Updated ${timeAgo(rule.updated_at)}${rule.updated_profile?.full_name ? ` by ${rule.updated_profile.full_name}` : ''}`
              : 'Seed value — never changed'}
        </div>
        {saveError && (
          <div style={{ marginTop: 6, fontSize: 12, color: B.red, fontFamily: fontBody, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠ Not saved
            <Btn testId={`rule-retry-${rule.rule_key}`} onClick={retry} style={{ minHeight: 32, padding: '0 10px', fontSize: 11 }}>Retry</Btn>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {isBoolean ? (
          <Toggle
            on={rule.value === true}
            onChange={onBooleanToggle}
            disabled={disabled || busy}
            testId={`rule-toggle-${rule.rule_key}`}
            ariaLabel={`${rule.name} ${rule.value === true ? 'on' : 'off'}`}
          />
        ) : rule.value_type === 'json' ? (
          <Btn testId={`rule-json-edit-${rule.rule_key}`} disabled={disabled || busy} onClick={() => setJsonOpen(true)}>Edit…</Btn>
        ) : (
          <InlineValueEditor rule={rule} disabled={disabled || busy} saving={busy} onSave={saveValue} />
        )}

        {!isBoolean && (
          <Toggle
            on={rule.enabled !== false}
            onChange={onEnabledToggle}
            disabled={disabled || busy}
            testId={`rule-enabled-${rule.rule_key}`}
            ariaLabel={`${rule.name} rule ${rule.enabled !== false ? 'enabled' : 'disabled'}`}
          />
        )}

        <Btn testId={`rule-history-${rule.rule_key}`} disabled={rule._fallback} onClick={() => onOpenHistory(rule)} style={{ fontSize: 11 }}>↺ History</Btn>
      </div>

      {jsonOpen && (
        <JsonEditorPanel
          rule={rule} isMobile={isMobile} saving={busy}
          onClose={() => setJsonOpen(false)}
          onSave={(value) => { saveValue(value); setJsonOpen(false) }}
        />
      )}
      {safetyConfirm && (
        <SafetyConfirmModal
          rule={rule}
          onCancel={() => setSafetyConfirm(null)}
          onConfirm={() => {
            if (safetyConfirm.action === 'value-off') saveValue(false)
            else saveEnabled(false)
            setSafetyConfirm(null)
          }}
        />
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RulesEnginePage() {
  const { profile, loading: authLoading } = useAuth()
  const { isMobile } = useBreakpoint()
  const { data, isLoading, isError } = useRules()
  const [tab, setTab] = useState('routing')
  const [historyRule, setHistoryRule] = useState(null)
  const [undo, setUndo] = useState(null) // { message, onUndo }
  const undoTimer = useRef(null)
  const updateMut = useUpdateRule()

  const showUndo = (message, onUndo) => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndo({ message, onUndo })
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  const fallbackMode = isError || (!isLoading && Array.isArray(data) && data.length === 0)
  const rules = useMemo(() => {
    if (fallbackMode) return getDefaultRuleRows()
    return Array.isArray(data) ? data : []
  }, [data, fallbackMode])

  const byCategory = useMemo(() => {
    const m = {}
    for (const c of CATEGORIES) m[c.key] = []
    for (const r of rules) (m[r.category] || (m[r.category] = [])).push(r)
    return m
  }, [rules])

  // ── Role gate: content-level, not just route-level ──
  const role = profile?.role
  // fleet_manager is manager-equivalent (AuthContext isManager) and the route
  // already admits it — the content gate must match (assessment DEAD-4).
  const allowed = role === 'owner' || role === 'manager' || role === 'fleet_manager'

  if (authLoading) {
    return (
      <div style={{ padding: 24, fontFamily: fontBody, color: B.textMuted, background: B.bg, minHeight: '100vh' }}>
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div data-testid="rules-access-denied" style={{ background: B.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 32, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontFamily: fontHead, fontSize: 18, color: B.textPrimary, textTransform: 'uppercase', marginTop: 8 }}>Access denied</div>
          <div style={{ fontFamily: fontBody, fontSize: 14, color: B.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
            Business Rules can only be viewed and edited by owners and managers.
            If you need a rule changed, ask Mark or your manager.
          </div>
        </div>
      </div>
    )
  }

  const activeRules = byCategory[tab] || []

  return (
    <div data-testid="rules-page" style={{ background: B.bg, minHeight: '100vh', padding: isMobile ? 12 : 24, fontFamily: fontBody }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 8, marginBottom: 16 }}>
          <h1 style={{ fontFamily: fontHead, fontSize: isMobile ? 22 : 26, color: B.textPrimary, textTransform: 'uppercase', margin: 0 }}>
            Business Rules
          </h1>
          <div style={{ fontSize: 12, color: B.textMuted }}>ⓘ Changes apply immediately to the next calculation that reads them</div>
        </div>

        {/* Fallback banner */}
        {fallbackMode && (
          <div data-testid="rules-fallback-banner" style={{
            background: '#FDF3E3', border: `1px solid ${B.amber}`, color: '#8a5a00',
            borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
          }}>
            ⚠ Showing default values — {isError ? 'rules table unavailable; edits disabled until connection is restored.' : 'no rules found in the database yet; run migration 026 to enable editing.'}
          </div>
        )}

        {/* Category tabs */}
        <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {CATEGORIES.map(c => {
            const count = (byCategory[c.key] || []).length
            const active = tab === c.key
            return (
              <button
                key={c.key}
                role="tab"
                aria-selected={active}
                data-testid={`rules-tab-${c.key}`}
                onClick={() => setTab(c.key)}
                style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 8, whiteSpace: 'nowrap',
                  fontFamily: fontHead, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase',
                  cursor: 'pointer',
                  background: active ? B.headerBg : B.cardBg,
                  color: active ? B.yellow : B.textSecondary,
                  border: `1px solid ${active ? B.headerBg : B.cardBorder}`,
                }}
              >
                {c.label}{count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>

        {/* Rows */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 86, borderRadius: 10, background: B.cardBg, border: `1px solid ${B.cardBorder}`, opacity: 0.55 }} />
            ))}
          </div>
        ) : activeRules.length === 0 ? (
          <div data-testid="rules-empty-category" style={{ background: B.cardBg, border: `1px dashed ${B.cardBorder}`, borderRadius: 10, padding: 28, textAlign: 'center', color: B.textMuted, fontSize: 14 }}>
            No rules in this category yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeRules.map(r => (
              <RuleRow
                key={r.rule_key}
                rule={r}
                disabled={fallbackMode}
                isMobile={isMobile}
                onOpenHistory={setHistoryRule}
                showUndo={showUndo}
              />
            ))}
          </div>
        )}
      </div>

      {/* History drawer */}
      {historyRule && (
        <HistoryDrawer
          rule={rules.find(r => r.rule_key === historyRule.rule_key) || historyRule}
          isMobile={isMobile}
          reverting={updateMut.isPending}
          onClose={() => setHistoryRule(null)}
          onRevert={(oldValue) => updateMut.mutate({ key: historyRule.rule_key, value: oldValue })}
        />
      )}

      {/* Undo toast */}
      {undo && (
        <div data-testid="rules-undo-toast" style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: B.headerBg, color: B.white, borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 80,
          boxShadow: '0 4px 16px rgba(0,0,6,0.35)', maxWidth: 'calc(100% - 32px)',
        }}>
          <span style={{ fontSize: 13, fontFamily: fontBody }}>{undo.message}</span>
          <button
            type="button"
            data-testid="rules-undo-button"
            onClick={() => { undo.onUndo(); setUndo(null) }}
            style={{
              minHeight: 44, padding: '0 14px', background: 'transparent', color: B.yellow,
              border: `1px solid ${B.yellow}`, borderRadius: 8, fontFamily: fontHead,
              fontSize: 12, textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
