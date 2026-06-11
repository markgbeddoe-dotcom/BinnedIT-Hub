/**
 * @file AuthContext.jsx
 *
 * Provides authentication state and role helpers to the entire app.
 * Wraps Supabase Auth — session state is kept in sync via onAuthStateChange.
 *
 * Available via useAuth() hook:
 * - session: Supabase session object (null if not logged in)
 * - user: session.user (null if not logged in)
 * - profile: profiles table row (id, role, full_name, email)
 * - loading: true while session is being initialised
 * - role: profile.role string (null until profile loads)
 *
 * Role booleans. Convention: isOwner / isDriver / isViewer identify the
 * persona exactly; the capability booleans (isManager, isBookkeeper,
 * isFleetManager, canWrite) include the roles above them in the hierarchy
 * (owner can do everything a manager can, etc.):
 * - isOwner: boolean — role === 'owner'
 * - isManager: boolean — role in ['owner', 'manager', 'fleet_manager']
 * - isBookkeeper: boolean — role in ['owner', 'bookkeeper']
 * - isFleetManager: boolean — role in ['owner', 'manager', 'fleet_manager']
 * - isDriver: boolean — role === 'driver' (exact — office staff are NOT drivers)
 * - isViewer: boolean — role in ['viewer', 'investor'] ('investor' is a
 *   defensive alias kept in sync with the sandbox check in src/main.jsx)
 * - canWrite: boolean — role in ['owner', 'bookkeeper']
 *
 * - signIn(email, password): async, returns { error }
 * - signOut(): async
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error) setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role = profile?.role ?? null

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn,
    signOut,
    role,
    isOwner: role === 'owner',
    isManager: ['owner', 'manager', 'fleet_manager'].includes(role),
    isBookkeeper: ['owner', 'bookkeeper'].includes(role),
    isFleetManager: ['owner', 'manager', 'fleet_manager'].includes(role),
    isDriver: role === 'driver',
    isViewer: role === 'viewer' || role === 'investor',
    canWrite: ['owner', 'bookkeeper'].includes(role),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
