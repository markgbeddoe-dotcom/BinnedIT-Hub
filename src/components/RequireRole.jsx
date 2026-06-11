/**
 * @file RequireRole.jsx
 *
 * Role-based route/section guard (WP-H — GAP-030 viewer/investor sandboxing,
 * GAP-031 /driver role check).
 *
 * Usage (route wrapping is done by the integrator in App.jsx / main.jsx):
 *
 *   <RequireRole roles={['owner', 'manager']}>
 *     <RulesEnginePage />
 *   </RequireRole>
 *
 *   <RequireRole roles={['driver', 'owner', 'manager']} fallback={<Navigate to="/" replace />}>
 *     <DriverApp />
 *   </RequireRole>
 *
 * Props:
 * - roles:    array of allowed profile.role strings (exact match against
 *             AuthContext `role`). Required — empty/missing array denies all.
 * - fallback: element rendered when the current role is NOT allowed.
 *             Defaults to <Navigate to="/" replace />.
 * - children: rendered when the current role is in `roles`.
 *
 * Behaviour:
 * - While auth/profile is still loading, a centred spinner renders — we never
 *   flash a redirect before the role is known.
 * - No session, no profile, or profile fetch failure → role is null → fallback
 *   (fail closed; never a blank crash, per repo fallback convention).
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { B, fontBody } from '../theme'

export function RequireRole({ roles, fallback = <Navigate to="/" replace />, children }) {
  const { loading, role } = useAuth()

  if (loading) {
    return (
      <div
        data-testid="require-role-loading"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, minHeight: '60vh',
          background: B.bg, color: B.textSecondary,
          fontFamily: fontBody, fontSize: 15,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `3px solid ${B.cardBorder}`, borderTopColor: B.yellow,
            display: 'inline-block', animation: 'require-role-spin 0.7s linear infinite',
          }}
        />
        Checking access…
        <style>{`@keyframes require-role-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const allowed = Array.isArray(roles) ? roles : roles ? [roles] : []
  if (!role || !allowed.includes(role)) return fallback

  return <>{children}</>
}

export default RequireRole
