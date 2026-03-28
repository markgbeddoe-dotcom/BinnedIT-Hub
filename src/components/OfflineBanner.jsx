import { useState, useEffect } from 'react'

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (online) return null

  return (
    <div style={{
      background: '#c0392b', color: '#fff', textAlign: 'center',
      padding: '8px 16px', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
    }}>
      Offline — showing cached data. Changes will sync when connection returns.
    </div>
  )
}
