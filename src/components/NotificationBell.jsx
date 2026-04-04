import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { B, fontHead, fontBody } from '../theme'
import { getNotifications, markAsRead, markAllRead, dismissNotification } from '../api/notifications'

const TYPE_ICONS = {
  booking_received: '📅',
  job_completed:    '✅',
  invoice_paid:     '💰',
  compliance_expiry:'⚠️',
  hazard_report:    '🚨',
  general:          '🔔',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
    retry: false,
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markReadMut = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllReadMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const dismissMut = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 20 }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: B.red,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: fontHead,
            borderRadius: 10,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 320,
          maxHeight: 460,
          overflowY: 'auto',
          background: B.cardBg,
          border: `1px solid ${B.cardBorder}`,
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          zIndex: 500,
        }}>
          {/* Header row */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${B.cardBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: B.cardBg,
            zIndex: 1,
          }}>
            <span style={{
              fontFamily: fontHead,
              fontSize: 12,
              fontWeight: 700,
              color: B.textPrimary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Notifications {unreadCount > 0 && `· ${unreadCount} new`}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMut.mutate()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: B.blue,
                  fontFamily: fontBody,
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: B.textMuted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
              No notifications
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: '11px 16px',
                  borderBottom: `1px solid ${B.cardBorder}`,
                  background: n.is_read ? 'transparent' : `${B.blue}08`,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {TYPE_ICONS[n.type] || '🔔'}
                </span>
                <div
                  style={{ flex: 1, minWidth: 0, cursor: !n.is_read ? 'pointer' : 'default' }}
                  onClick={() => !n.is_read && markReadMut.mutate(n.id)}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: n.is_read ? 400 : 600,
                    color: B.textPrimary,
                    marginBottom: 2,
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: B.textSecondary, marginBottom: 4 }}>{n.body}</div>
                  )}
                  <div style={{ fontSize: 11, color: B.textMuted }}>
                    {new Date(n.created_at).toLocaleString('en-AU', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {!n.is_read && (
                    <div style={{
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: B.blue,
                      flexShrink: 0,
                    }} />
                  )}
                  <button
                    onClick={() => dismissMut.mutate(n.id)}
                    title="Dismiss"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: B.textMuted,
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
