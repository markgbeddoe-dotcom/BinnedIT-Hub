/**
 * Tests for offlineQueue.js
 *
 * IndexedDB is mocked inline (no new npm deps). The mock supports:
 *   open(name, version) → { onupgradeneeded, onsuccess, result }
 *   transaction(store, mode).objectStore(store).{ add, put, delete, getAll, clear }
 *   autoIncrement keyPath
 *
 * Each test resets the mock + the queue's in-memory state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ----- Minimal in-memory IndexedDB mock -----------------------------------

function createIDBMock() {
  const stores = new Map() // name → { records: Map<id, value>, nextId: number }

  function ensureStore(name) {
    if (!stores.has(name)) {
      stores.set(name, { records: new Map(), nextId: 1 })
    }
    return stores.get(name)
  }

  function makeRequest(executor) {
    const req = { onsuccess: null, onerror: null, result: undefined, error: null }
    // Defer like real IDB (microtask).
    queueMicrotask(() => {
      try {
        const result = executor()
        req.result = result
        if (typeof req.onsuccess === 'function') {
          req.onsuccess({ target: req })
        }
      } catch (err) {
        req.error = err
        if (typeof req.onerror === 'function') {
          req.onerror({ target: req })
        }
      }
    })
    return req
  }

  function makeTransaction(storeNames) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    const tx = {
      oncomplete: null,
      onerror: null,
      objectStore(name) {
        if (!names.includes(name)) {
          throw new Error(`Store ${name} not in transaction`)
        }
        ensureStore(name)
        return {
          add(value) {
            return makeRequest(() => {
              const store = ensureStore(name)
              const id = store.nextId++
              const record = { ...value, id }
              store.records.set(id, record)
              return id
            })
          },
          put(value) {
            return makeRequest(() => {
              const store = ensureStore(name)
              const id = value.id ?? store.nextId++
              store.records.set(id, { ...value, id })
              return id
            })
          },
          delete(id) {
            return makeRequest(() => {
              const store = ensureStore(name)
              store.records.delete(id)
              return undefined
            })
          },
          getAll() {
            return makeRequest(() => {
              const store = ensureStore(name)
              return Array.from(store.records.values())
            })
          },
          clear() {
            return makeRequest(() => {
              const store = ensureStore(name)
              store.records.clear()
              store.nextId = 1
              return undefined
            })
          },
        }
      },
    }
    // Fire oncomplete after a microtask.
    queueMicrotask(() => {
      // Schedule completion *after* any add/put/delete microtask.
      queueMicrotask(() => {
        if (typeof tx.oncomplete === 'function') tx.oncomplete()
      })
    })
    return tx
  }

  const db = {
    objectStoreNames: {
      contains(name) { return stores.has(name) },
    },
    createObjectStore(name) {
      ensureStore(name)
      return {}
    },
    transaction: makeTransaction,
    close() { /* noop */ },
  }

  function open(/* name, version */) {
    const req = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      onblocked: null,
      result: db,
      error: null,
    }
    queueMicrotask(() => {
      // First fire upgradeneeded if not yet initialised.
      if (!stores.has('offlineQueue') || !stores.has('offlineFailed')) {
        if (typeof req.onupgradeneeded === 'function') {
          // Pre-create both stores to mirror createObjectStore behaviour.
          ensureStore('offlineQueue')
          ensureStore('offlineFailed')
          req.onupgradeneeded({ target: req })
        }
      }
      if (typeof req.onsuccess === 'function') {
        req.onsuccess({ target: req })
      }
    })
    return req
  }

  return {
    indexedDB: { open },
    _stores: stores,
    _reset() {
      stores.clear()
    },
  }
}

// ----- Test setup ---------------------------------------------------------

let idbMock

beforeEach(async () => {
  // Fresh mock per test.
  idbMock = createIDBMock()
  globalThis.indexedDB = idbMock.indexedDB
  // Default to online; individual tests can override.
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    get: () => true,
  })
  // Reset module so its module-level Map state is fresh.
  vi.resetModules()
})

async function loadModule() {
  return await import('./offlineQueue.js')
}

function setOnline(value) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

// ----- Tests --------------------------------------------------------------

describe('enqueueWrite — online happy path', () => {
  it('returns the result synchronously when sender succeeds', async () => {
    const { enqueueWrite, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async (payload) => ({ ok: true, data: payload }))

    const result = await enqueueWrite(sender, { foo: 'bar' })

    expect(result.status).toBe('sent')
    expect(result.result).toEqual({ ok: true, data: { foo: 'bar' } })
    expect(sender).toHaveBeenCalledTimes(1)

    const snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
    expect(snap.failed).toEqual([])
  })
})

describe('enqueueWrite — offline persistence', () => {
  it('persists when navigator.onLine is false', async () => {
    setOnline(false)
    const { enqueueWrite, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async () => ({ ok: true }))

    const result = await enqueueWrite(sender, { id: 1, type: 'jobEvent' }, { tag: 'recordJobEvent' })

    expect(result.status).toBe('queued')
    expect(sender).not.toHaveBeenCalled()

    const snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
    expect(snap.pending[0].payload).toEqual({ id: 1, type: 'jobEvent' })
    expect(snap.pending[0].tag).toBe('recordJobEvent')
    expect(snap.pending[0].attempts).toBe(0)
  })

  it('persists when the sender rejects with a network-style error (TypeError)', async () => {
    setOnline(true)
    const { enqueueWrite, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    const result = await enqueueWrite(sender, { hello: 'world' }, { tag: 'submitChecklist' })

    expect(result.status).toBe('queued')
    expect(sender).toHaveBeenCalledTimes(1)

    const snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
    expect(snap.pending[0].attempts).toBe(1)
    expect(snap.pending[0].lastError).toMatch(/Failed to fetch/)
  })

  it('persists when sender rejects with status === 0 (network drop mid-flight)', async () => {
    const { enqueueWrite, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async () => {
      const e = new Error('connection reset')
      e.status = 0
      throw e
    })

    const result = await enqueueWrite(sender, { x: 1 })
    expect(result.status).toBe('queued')

    const snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
  })
})

describe('flushQueue — oldest-first delivery + delete on success', () => {
  it('flushes pending items oldest-first and deletes on success', async () => {
    setOnline(false)
    const { enqueueWrite, flushQueue, getQueueSnapshot } = await loadModule()

    const calls = []
    const sender = vi.fn(async (payload) => {
      calls.push(payload)
      return { ok: true }
    })

    await enqueueWrite(sender, { n: 1 }, { tag: 'tagA' })
    await enqueueWrite(sender, { n: 2 }, { tag: 'tagA' })
    await enqueueWrite(sender, { n: 3 }, { tag: 'tagA' })

    setOnline(true)
    const result = await flushQueue()

    expect(result.sent).toBe(3)
    expect(result.failed).toBe(0)
    expect(calls.map((c) => c.n)).toEqual([1, 2, 3])

    const snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
  })
})

describe('flushQueue — 4xx terminal handling', () => {
  it('marks 4xx responses as failed without retrying', async () => {
    setOnline(false)
    const { enqueueWrite, flushQueue, getQueueSnapshot } = await loadModule()

    const sender = vi.fn(async () => {
      const e = new Error('Bad request')
      e.status = 400
      throw e
    })

    await enqueueWrite(sender, { bad: true }, { tag: 'tagBad' })

    setOnline(true)
    const result = await flushQueue()

    expect(result.failed).toBe(1)
    expect(result.sent).toBe(0)
    expect(sender).toHaveBeenCalledTimes(1) // no retry

    const snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
    expect(snap.failed).toHaveLength(1)
    expect(snap.failed[0].reason).toBe('terminal')
    expect(snap.failed[0].lastError).toMatch(/Bad request/)
  })
})

describe('flushQueue — maxRetries cap', () => {
  it('stops retrying after maxRetries and moves item to failed', async () => {
    setOnline(false)
    const { enqueueWrite, flushQueue, getQueueSnapshot } = await loadModule()

    // 5xx is retryable; we expect maxRetries flushes before it gives up.
    const sender = vi.fn(async () => {
      const e = new Error('Server boom')
      e.status = 500
      throw e
    })

    await enqueueWrite(sender, { p: 1 }, { tag: 'tagRetry', maxRetries: 3 })

    setOnline(true)
    // First flush: attempts goes from 0 → 1 (still pending)
    await flushQueue()
    let snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
    expect(snap.pending[0].attempts).toBe(1)

    // Second flush: 1 → 2
    await flushQueue()
    snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
    expect(snap.pending[0].attempts).toBe(2)

    // Third flush: 2 → 3, hits maxRetries, moves to failed
    await flushQueue()
    snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
    expect(snap.failed).toHaveLength(1)
    expect(snap.failed[0].reason).toBe('maxRetries')
    expect(snap.failed[0].attempts).toBe(3)
  })
})

describe('subscribeQueue — change notifications', () => {
  it('notifies subscribers on enqueue and on flush', async () => {
    setOnline(false)
    const { enqueueWrite, subscribeQueue, flushQueue } = await loadModule()

    const states = []
    const unsub = subscribeQueue((s) => states.push(s))

    // Wait for the initial snapshot fire.
    await new Promise((r) => setTimeout(r, 0))
    const initialCount = states.length
    expect(initialCount).toBeGreaterThanOrEqual(1)
    expect(states[0]).toEqual({ pending: [], failed: [] })

    const sender = vi.fn(async () => ({ ok: true }))
    await enqueueWrite(sender, { hi: true }, { tag: 'tagSub' })

    expect(states.length).toBeGreaterThan(initialCount)
    const afterEnqueue = states[states.length - 1]
    expect(afterEnqueue.pending).toHaveLength(1)

    setOnline(true)
    await flushQueue()

    const afterFlush = states[states.length - 1]
    expect(afterFlush.pending).toEqual([])

    unsub()
  })
})

describe('getQueueSnapshot — pending + failed buckets', () => {
  it('returns both pending and failed items', async () => {
    setOnline(false)
    const { enqueueWrite, flushQueue, getQueueSnapshot } = await loadModule()

    // One item that will succeed once we go online; one that will 4xx and
    // land in the failed bucket.
    let callCount = 0
    const sender = vi.fn(async (payload) => {
      callCount += 1
      if (payload.bad) {
        const e = new Error('rejected')
        e.status = 422
        throw e
      }
      return { ok: true }
    })

    await enqueueWrite(sender, { bad: true }, { tag: 'tagX' })
    await enqueueWrite(sender, { bad: false }, { tag: 'tagX' })

    let snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(2)
    expect(snap.failed).toEqual([])

    setOnline(true)
    await flushQueue()

    snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
    expect(snap.failed).toHaveLength(1)
    expect(snap.failed[0].payload).toEqual({ bad: true })
  })
})

describe('idempotencyKey — dedupe', () => {
  it('does not enqueue a duplicate when an item with the same key is pending', async () => {
    setOnline(false)
    const { enqueueWrite, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async () => ({ ok: true }))

    const r1 = await enqueueWrite(sender, { v: 1 }, { tag: 'tagDup', idempotencyKey: 'job-42-arrived' })
    const r2 = await enqueueWrite(sender, { v: 2 }, { tag: 'tagDup', idempotencyKey: 'job-42-arrived' })

    expect(r1.status).toBe('queued')
    expect(r2.status).toBe('deduped')
    expect(r2.id).toBe(r1.id)

    const snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(1)
  })
})

describe('clearQueue', () => {
  it('removes all pending and failed items', async () => {
    setOnline(false)
    const { enqueueWrite, clearQueue, getQueueSnapshot } = await loadModule()
    const sender = vi.fn(async () => ({ ok: true }))

    await enqueueWrite(sender, { a: 1 }, { tag: 'tagClear' })
    await enqueueWrite(sender, { a: 2 }, { tag: 'tagClear' })

    let snap = await getQueueSnapshot()
    expect(snap.pending).toHaveLength(2)

    await clearQueue()

    snap = await getQueueSnapshot()
    expect(snap.pending).toEqual([])
    expect(snap.failed).toEqual([])
  })
})

describe('classifyError', () => {
  it('classifies error types correctly', async () => {
    const { __test } = await loadModule()
    const { classifyError } = __test

    expect(classifyError(new TypeError('Failed to fetch'))).toBe('retry')
    expect(classifyError({ status: 0 })).toBe('retry')
    expect(classifyError({ status: 500 })).toBe('retry')
    expect(classifyError({ status: 503 })).toBe('retry')
    expect(classifyError({ status: 400 })).toBe('terminal')
    expect(classifyError({ status: 401 })).toBe('terminal')
    expect(classifyError({ status: 404 })).toBe('terminal')
    expect(classifyError({ status: 422 })).toBe('terminal')
    expect(classifyError(null)).toBe('retry')
  })
})
