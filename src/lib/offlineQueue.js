/**
 * offlineQueue.js — Offline-tolerant write queue for the SkipSync driver app.
 *
 * Sprint 12 #17: Drivers in 4G blackspots can read jobs (the JobQueue caches
 * for 2h in localStorage) but every write previously failed silently. This
 * library queues writes durably, flushes them when connectivity returns, and
 * applies a retry policy that distinguishes transient (5xx, network) errors
 * from permanent (4xx) ones.
 *
 * Persistence strategy:
 *   - Primary: IndexedDB database `skipsync-offline-queue` with two stores:
 *       'offlineQueue'  — pending writes, auto-incrementing ids
 *       'offlineFailed' — writes that exceeded maxRetries (kept for diag UI)
 *   - Fallback: localStorage under keys `skipsync.offlineQueue` /
 *     `skipsync.offlineFailed`. Used in environments where IndexedDB is
 *     missing (private mode in some browsers, ancient WebViews).
 *
 * Retry policy:
 *   - Network-style errors (TypeError, status === 0, no response): retry
 *   - 5xx responses: retry
 *   - 4xx responses: do NOT retry (mark failed immediately; server rejected
 *     the payload, looping would never recover)
 *   - After `maxRetries` (default 10) the item moves to the failed store
 *
 * Idempotency:
 *   - Caller passes `idempotencyKey`; the queue dedupes re-enqueues with the
 *     same key (a second enqueueWrite with the same key is a no-op while the
 *     original is still pending). The sender is responsible for forwarding
 *     the key to the server (e.g. as an HTTP header) so the server can
 *     dedupe on its side.
 *
 * SSR safety:
 *   - All storage access is gated on `typeof window !== 'undefined'`. In
 *     SSR contexts enqueueWrite simply runs the sender once and returns.
 */

const DB_NAME = 'skipsync-offline-queue'
const DB_VERSION = 1
const PENDING_STORE = 'offlineQueue'
const FAILED_STORE = 'offlineFailed'
const LS_PENDING_KEY = 'skipsync.offlineQueue'
const LS_FAILED_KEY = 'skipsync.offlineFailed'

const DEFAULT_MAX_RETRIES = 10

// ----- Environment detection ----------------------------------------------

function isBrowser() {
  return typeof window !== 'undefined'
}

function hasIndexedDB() {
  return isBrowser() && typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null
}

function isOnline() {
  if (!isBrowser()) return true
  // navigator.onLine defaults to true in jsdom; when explicitly set to false
  // we treat the app as offline.
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

// ----- Sender registry ----------------------------------------------------
// Senders are functions; they cannot be serialised to IndexedDB. We persist
// payloads + a `tag` and require the caller to either (a) re-enqueue the
// sender on app boot (rare) or (b) provide the sender at flush-time via the
// per-call binding kept in memory. For a single-page driver app that flushes
// during the same session as the enqueue, the in-memory binding is enough;
// after a hard reload, items remain pending and the next enqueueWrite call
// for the same tag will pick them up via flushQueue.
//
// In practice, components that issue offline writes register a default sender
// per tag at module load. We expose `registerSender(tag, sender)` for that.

const senderRegistry = new Map()

export function registerSender(tag, sender) {
  if (typeof sender !== 'function') {
    throw new TypeError('registerSender: sender must be a function')
  }
  senderRegistry.set(tag, sender)
}

function resolveSender(item, fallback) {
  if (fallback) return fallback
  if (item.tag && senderRegistry.has(item.tag)) {
    return senderRegistry.get(item.tag)
  }
  return null
}

// ----- IndexedDB helpers --------------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    let req
    try {
      req = globalThis.indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    req.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(FAILED_STORE)) {
        db.createObjectStore(FAILED_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

function idbAdd(storeName, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.add(value)
        req.onsuccess = () => {
          const id = req.result
          resolve({ ...value, id })
        }
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
        tx.onerror = () => {
          try { db.close() } catch { /* noop */ }
        }
      })
  )
}

function idbPut(storeName, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.put(value)
        req.onsuccess = () => resolve(value)
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      })
  )
}

function idbDelete(storeName, id) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.delete(id)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      })
  )
}

function idbGetAll(storeName) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.getAll()
        req.onsuccess = () => {
          const items = req.result || []
          // Defensive: sort by id ascending to guarantee oldest-first.
          items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
          resolve(items)
        }
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      })
  )
}

function idbClear(storeName) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      })
  )
}

// ----- localStorage fallback ---------------------------------------------

function lsRead(key) {
  if (!isBrowser() || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function lsWrite(key, items) {
  if (!isBrowser() || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    /* quota exceeded — silently drop; queue is best-effort durability */
  }
}

let lsAutoId = 0
function lsNextId() {
  lsAutoId += 1
  return Date.now() * 1000 + lsAutoId
}

function lsAdd(key, value) {
  const items = lsRead(key)
  const withId = { ...value, id: lsNextId() }
  items.push(withId)
  lsWrite(key, items)
  return withId
}

function lsPut(key, value) {
  const items = lsRead(key)
  const idx = items.findIndex((it) => it.id === value.id)
  if (idx >= 0) items[idx] = value
  else items.push(value)
  lsWrite(key, items)
  return value
}

function lsDelete(key, id) {
  const items = lsRead(key).filter((it) => it.id !== id)
  lsWrite(key, items)
}

function lsClear(key) {
  if (!isBrowser() || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

// ----- Storage abstraction ------------------------------------------------

async function storageAdd(storeName, value) {
  if (hasIndexedDB()) {
    try {
      return await idbAdd(storeName, value)
    } catch {
      // Fall through to localStorage
    }
  }
  const key = storeName === PENDING_STORE ? LS_PENDING_KEY : LS_FAILED_KEY
  return lsAdd(key, value)
}

async function storagePut(storeName, value) {
  if (hasIndexedDB()) {
    try {
      return await idbPut(storeName, value)
    } catch {
      /* fall through */
    }
  }
  const key = storeName === PENDING_STORE ? LS_PENDING_KEY : LS_FAILED_KEY
  return lsPut(key, value)
}

async function storageDelete(storeName, id) {
  if (hasIndexedDB()) {
    try {
      await idbDelete(storeName, id)
      return
    } catch {
      /* fall through */
    }
  }
  const key = storeName === PENDING_STORE ? LS_PENDING_KEY : LS_FAILED_KEY
  lsDelete(key, id)
}

async function storageGetAll(storeName) {
  if (hasIndexedDB()) {
    try {
      return await idbGetAll(storeName)
    } catch {
      /* fall through */
    }
  }
  const key = storeName === PENDING_STORE ? LS_PENDING_KEY : LS_FAILED_KEY
  const items = lsRead(key)
  items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  return items
}

async function storageClear(storeName) {
  if (hasIndexedDB()) {
    try {
      await idbClear(storeName)
    } catch {
      /* fall through, also clear LS to be safe */
    }
  }
  const key = storeName === PENDING_STORE ? LS_PENDING_KEY : LS_FAILED_KEY
  lsClear(key)
}

// ----- Error classification ----------------------------------------------

/**
 * Classify a sender failure as retryable or terminal.
 *   - TypeError (fetch failed / DNS / offline) → retry
 *   - Error.status / response.status:
 *       0    → retry (browser lost connection mid-flight)
 *       4xx  → terminal
 *       5xx  → retry
 *   - response.ok === false → use status above
 *   - anything else → retry (be optimistic; maxRetries caps the loop)
 */
function classifyError(err) {
  if (!err) return 'retry'

  // fetch returned a Response with ok === false (sender chose to throw it)
  if (typeof err === 'object' && 'status' in err && typeof err.status === 'number') {
    const s = err.status
    if (s === 0) return 'retry'
    if (s >= 400 && s < 500) return 'terminal'
    if (s >= 500) return 'retry'
    return 'retry'
  }

  // Standard fetch network failure
  if (err instanceof TypeError) return 'retry'

  // Supabase / PostgREST style: { code: 'PGRST...', status: 4xx }
  if (typeof err === 'object' && err.response && typeof err.response.status === 'number') {
    return classifyError({ status: err.response.status })
  }

  return 'retry'
}

// ----- Listener pub/sub ---------------------------------------------------

const listeners = new Set()

export function subscribeQueue(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('subscribeQueue: listener must be a function')
  }
  listeners.add(listener)
  // Fire once immediately with current state so the UI can render without
  // waiting for the next change.
  getQueueSnapshot().then((snapshot) => {
    try { listener(snapshot) } catch { /* swallow */ }
  })
  return () => {
    listeners.delete(listener)
  }
}

async function notify() {
  if (listeners.size === 0) return
  const snapshot = await getQueueSnapshot()
  for (const fn of listeners) {
    try { fn(snapshot) } catch { /* swallow listener errors */ }
  }
}

// ----- Public API ---------------------------------------------------------

/**
 * Enqueue a write.
 *
 * @param {Function} sender   async (payload) => result; rejects on failure
 * @param {*}        payload  JSON-serialisable payload
 * @param {Object}   options
 *   - tag             string identifier so flushQueue can find the sender
 *                     after a reload (used with registerSender)
 *   - maxRetries      default 10
 *   - idempotencyKey  string; dedupes re-enqueues with same key
 *
 * @returns {Promise<{id, queuedAt, result?, status: 'sent'|'queued'|'deduped'}>}
 */
export async function enqueueWrite(sender, payload, options = {}) {
  if (typeof sender !== 'function') {
    throw new TypeError('enqueueWrite: sender must be a function')
  }
  const {
    tag = null,
    maxRetries = DEFAULT_MAX_RETRIES,
    idempotencyKey = null,
  } = options

  const queuedAt = Date.now()

  // Idempotency dedupe: if a pending item already has this key, don't
  // enqueue again.
  if (idempotencyKey) {
    const pending = await storageGetAll(PENDING_STORE)
    const existing = pending.find((it) => it.idempotencyKey === idempotencyKey)
    if (existing) {
      return { id: existing.id, queuedAt: existing.queuedAt, status: 'deduped' }
    }
  }

  // If we believe we're online, try the sender directly. On success, no
  // persistence needed.
  if (isOnline()) {
    try {
      const result = await sender(payload)
      // If the sender returns a Response-like object with ok === false, treat
      // it as a failure rather than success.
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
        const fakeErr = { status: result.status ?? 0, response: result }
        if (classifyError(fakeErr) === 'terminal') {
          // 4xx — server rejected. Persist as failed so the diagnostics UI
          // can show it; don't throw, the caller asked us to queue.
          const stored = await storageAdd(FAILED_STORE, {
            payload, tag, maxRetries, idempotencyKey, queuedAt,
            attempts: 1,
            lastError: `HTTP ${result.status}`,
          })
          await notify()
          return { id: stored.id, queuedAt, status: 'failed' }
        }
        // 5xx / network — persist for retry
        const stored = await storageAdd(PENDING_STORE, {
          payload, tag, maxRetries, idempotencyKey, queuedAt,
          attempts: 1,
          lastError: `HTTP ${result.status}`,
        })
        await notify()
        return { id: stored.id, queuedAt, status: 'queued' }
      }
      // Success path
      return { id: null, queuedAt, status: 'sent', result }
    } catch (err) {
      const verdict = classifyError(err)
      if (verdict === 'terminal') {
        // 4xx — don't queue for retry; surface to caller via failed store.
        const stored = await storageAdd(FAILED_STORE, {
          payload, tag, maxRetries, idempotencyKey, queuedAt,
          attempts: 1,
          lastError: errMessage(err),
        })
        await notify()
        // Re-throw so the caller knows the immediate attempt was rejected
        // permanently; the failed store keeps a record for the diag UI.
        const e = new Error(errMessage(err))
        e.status = err && err.status
        e.terminal = true
        throw e
      }
      // Retryable: persist for later flush.
      const stored = await storageAdd(PENDING_STORE, {
        payload, tag, maxRetries, idempotencyKey, queuedAt,
        attempts: 1,
        lastError: errMessage(err),
      })
      await notify()
      return { id: stored.id, queuedAt, status: 'queued' }
    }
  }

  // Offline path — straight to the queue.
  const stored = await storageAdd(PENDING_STORE, {
    payload, tag, maxRetries, idempotencyKey, queuedAt,
    attempts: 0,
    lastError: null,
  })
  // Bind the sender so flushQueue (in the same session) can use it without
  // requiring registerSender.
  if (tag && !senderRegistry.has(tag)) {
    senderRegistry.set(tag, sender)
  } else if (!tag) {
    // Anonymous: store sender by id so we can find it at flush time.
    inMemorySenders.set(stored.id, sender)
  }
  await notify()
  return { id: stored.id, queuedAt, status: 'queued' }
}

// In-memory sender bindings keyed by item id (for items without a tag, in
// the same session).
const inMemorySenders = new Map()

function errMessage(err) {
  if (!err) return 'unknown error'
  if (typeof err === 'string') return err
  if (err.message) return String(err.message)
  if (err.status) return `HTTP ${err.status}`
  return String(err)
}

/**
 * Flush the queue oldest-first.
 *
 * For each pending item: resolve its sender (registered by tag or bound
 * in-memory at enqueue time), call it, and either delete on success or
 * increment attempts on retryable failure / move to failed on terminal
 * failure or maxRetries.
 *
 * Items that have no resolvable sender (e.g. after a hard reload before the
 * driver app re-registered senders) are left in place untouched.
 */
export async function flushQueue() {
  const items = await storageGetAll(PENDING_STORE)
  if (items.length === 0) return { sent: 0, failed: 0, skipped: 0 }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const item of items) {
    const sender = resolveSender(item, inMemorySenders.get(item.id))
    if (!sender) {
      skipped += 1
      continue
    }
    try {
      const result = await sender(item.payload)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
        const fakeErr = { status: result.status ?? 0 }
        await handleFailure(item, fakeErr)
        if (classifyError(fakeErr) === 'terminal') failed += 1
        continue
      }
      // Success
      await storageDelete(PENDING_STORE, item.id)
      inMemorySenders.delete(item.id)
      sent += 1
    } catch (err) {
      const moved = await handleFailure(item, err)
      if (moved) failed += 1
    }
  }

  await notify()
  return { sent, failed, skipped }
}

/**
 * Apply retry policy after a sender failure.
 * Returns true if the item was moved to the failed store.
 */
async function handleFailure(item, err) {
  const verdict = classifyError(err)
  const nextAttempts = (item.attempts || 0) + 1

  if (verdict === 'terminal') {
    // Move to failed store immediately.
    await storageDelete(PENDING_STORE, item.id)
    await storageAdd(FAILED_STORE, {
      payload: item.payload,
      tag: item.tag,
      maxRetries: item.maxRetries,
      idempotencyKey: item.idempotencyKey,
      queuedAt: item.queuedAt,
      attempts: nextAttempts,
      lastError: errMessage(err),
      reason: 'terminal',
    })
    inMemorySenders.delete(item.id)
    return true
  }

  if (nextAttempts >= (item.maxRetries ?? DEFAULT_MAX_RETRIES)) {
    // Exceeded retries — move to failed.
    await storageDelete(PENDING_STORE, item.id)
    await storageAdd(FAILED_STORE, {
      payload: item.payload,
      tag: item.tag,
      maxRetries: item.maxRetries,
      idempotencyKey: item.idempotencyKey,
      queuedAt: item.queuedAt,
      attempts: nextAttempts,
      lastError: errMessage(err),
      reason: 'maxRetries',
    })
    inMemorySenders.delete(item.id)
    return true
  }

  // Otherwise increment attempts in-place.
  await storagePut(PENDING_STORE, {
    ...item,
    attempts: nextAttempts,
    lastError: errMessage(err),
  })
  return false
}

/**
 * Inspect queue without flushing. Returns { pending, failed }.
 */
export async function getQueueSnapshot() {
  const [pending, failed] = await Promise.all([
    storageGetAll(PENDING_STORE),
    storageGetAll(FAILED_STORE),
  ])
  return { pending, failed }
}

/**
 * Clear both queues. For tests and "discard all" UX.
 */
export async function clearQueue() {
  await storageClear(PENDING_STORE)
  await storageClear(FAILED_STORE)
  inMemorySenders.clear()
  await notify()
}

// ----- 'online' auto-flush ------------------------------------------------

if (isBrowser() && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => {
    flushQueue().catch(() => { /* swallow; flush will retry next time */ })
  })
}

// ----- Test/debug exports -------------------------------------------------
// Not part of the public contract, but handy for white-box testing.
export const __test = {
  classifyError,
  PENDING_STORE,
  FAILED_STORE,
  resetSenders: () => {
    senderRegistry.clear()
    inMemorySenders.clear()
  },
}
