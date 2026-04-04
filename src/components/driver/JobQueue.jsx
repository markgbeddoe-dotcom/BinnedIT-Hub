import React, { useState, useEffect, useCallback } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { getTodayJobs } from '../../api/driver'
import JobCard from './JobCard'

const CACHE_KEY = 'skipsync_driver_jobs_cache'

function loadCachedJobs() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { jobs, ts } = JSON.parse(raw)
    // Cache valid for 2 hours
    if (Date.now() - ts > 2 * 60 * 60 * 1000) return null
    return jobs
  } catch {
    return null
  }
}

function cacheJobs(jobs) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ jobs, ts: Date.now() }))
  } catch {}
}

export default function JobQueue({ driverId, onOpenChecklist }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [filter, setFilter] = useState('active') // 'active' | 'all'

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getTodayJobs()
      cacheJobs(data)
      setJobs(data)
      setLastUpdated(new Date())
    } catch (err) {
      // Offline — use cache
      const cached = loadCachedJobs()
      if (cached) setJobs(cached)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Try to load from network first, fall back to cache
    const cached = loadCachedJobs()
    if (cached) { setJobs(cached); setLoading(false) }
    fetchJobs()

    const onOnline  = () => { setOnline(true);  fetchJobs() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [fetchJobs])

  function handleStatusChange(jobId, newStatus) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
  }

  const activeJobs    = jobs.filter(j => !['completed','cancelled'].includes(j.status))
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const displayJobs   = filter === 'active' ? activeJobs : jobs

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: B.yellow, fontSize: 40 }}>⏳</div>
        <div style={{ color: '#aaa', fontFamily: fontBody, fontSize: 16 }}>Loading your jobs…</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: fontBody }}>
      {/* Date header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: B.yellow, fontFamily: fontHead, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Today
        </div>
        <div style={{ color: B.white, fontFamily: fontHead, fontSize: 22, letterSpacing: '0.02em' }}>
          {today}
        </div>
      </div>

      {/* Offline warning */}
      {!online && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#2B1A0F', border: `1px solid ${B.amber}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: B.amber, fontSize: 13,
        }}>
          <span>📶</span>
          <span>No signal — showing cached jobs. Actions will sync when online.</span>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: 1, background: '#1A1A2E', borderRadius: 8, padding: '12px',
          border: `1px solid ${B.yellow}33`, textAlign: 'center',
        }}>
          <div style={{ fontFamily: fontHead, fontSize: 28, color: B.yellow }}>{activeJobs.length}</div>
          <div style={{ color: '#888', fontSize: 12 }}>Remaining</div>
        </div>
        <div style={{
          flex: 1, background: '#1A1A2E', borderRadius: 8, padding: '12px',
          border: `1px solid ${B.green}33`, textAlign: 'center',
        }}>
          <div style={{ fontFamily: fontHead, fontSize: 28, color: B.green }}>{completedJobs.length}</div>
          <div style={{ color: '#888', fontSize: 12 }}>Done</div>
        </div>
        <div style={{
          flex: 1, background: '#1A1A2E', borderRadius: 8, padding: '12px',
          border: `1px solid #33333366`, textAlign: 'center',
        }}>
          <div style={{ fontFamily: fontHead, fontSize: 28, color: B.white }}>{jobs.length}</div>
          <div style={{ color: '#888', fontSize: 12 }}>Total</div>
        </div>
      </div>

      {/* Pre-start checklist button */}
      <button
        onClick={onOpenChecklist}
        style={{
          width: '100%', padding: '14px 18px',
          background: '#1A1A2E', border: `1px solid ${B.yellow}`,
          borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <span style={{ color: B.yellow, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 15 }}>
            Vehicle Pre-Start Checklist
          </span>
        </div>
        <span style={{ color: '#555', fontSize: 20 }}>›</span>
      </button>

      {/* Filter tabs */}
      {completedJobs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'active', label: `Active (${activeJobs.length})` },
            { key: 'all',    label: `All (${jobs.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '8px 16px',
                background: filter === key ? B.yellow : '#1A1A2E',
                color: filter === key ? B.black : '#aaa',
                border: `1px solid ${filter === key ? B.yellow : '#333'}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: fontHead,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Job cards */}
      {displayJobs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: '#1A1A2E', borderRadius: 12,
          border: '1px dashed #333',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontFamily: fontHead, fontSize: 20, color: B.white, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {filter === 'active' && completedJobs.length > 0 ? 'All Jobs Complete!' : 'No Jobs Today'}
          </div>
          <div style={{ color: '#888', fontSize: 14, marginTop: 6 }}>
            {filter === 'active' && completedJobs.length > 0
              ? `You completed ${completedJobs.length} job${completedJobs.length !== 1 ? 's' : ''} today`
              : 'Check back or contact dispatch'}
          </div>
        </div>
      ) : (
        displayJobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            driverId={driverId}
            onStatusChange={handleStatusChange}
          />
        ))
      )}

      {/* Last updated */}
      {lastUpdated && (
        <div style={{ textAlign: 'center', color: '#444', fontSize: 12, marginTop: 20 }}>
          Last updated {lastUpdated.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          {' · '}
          <button
            onClick={fetchJobs}
            style={{ background: 'none', border: 'none', color: B.yellow, fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
