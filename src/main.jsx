import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import InvestorView from './components/InvestorView'
import BookingPage from './components/BookingPage'
import EmbedBookingPage from './components/EmbedBookingPage'
import DriverApp from './components/driver/DriverApp'
import { queryClient } from './hooks/queryClient'

function AuthGate() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()

  // Public routes — no auth required
  if (location.pathname === '/book') return <BookingPage />

  // White-label embed widget — public, no auth, no chrome
  if (location.pathname.startsWith('/embed/')) {
    const tenantSlug = location.pathname.split('/')[2] || ''
    return <EmbedBookingPage tenantSlug={tenantSlug} />
  }

  // Driver portal — handles its own auth internally.
  // Match /driver and /driver/* exactly (singular) — must NOT match /drivers (admin route).
  if (/^\/driver(\/|$)/.test(location.pathname)) return <DriverApp />

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#D8D5E0', color:'#1A1A1A', fontFamily:'DM Sans, sans-serif', fontSize:16 }}>
      Loading…
    </div>
  )
  if (!session) return <LoginPage />

  // Investor RBAC sandbox (audit P0-12). Viewer role only sees /investor.
  // Any other path is redirected. Per PRD-v6 §4.6 Andrew the investor must
  // not see operational data (dispatch, customers, collections, invoices).
  const role = profile?.role
  if (role === 'viewer' || role === 'investor') {
    if (location.pathname !== '/investor') {
      return <Navigate to="/investor" replace />
    }
    return <InvestorView />
  }

  return (
    <Routes>
      <Route path="/investor" element={<InvestorView />} />
      <Route path="/*" element={<App />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
