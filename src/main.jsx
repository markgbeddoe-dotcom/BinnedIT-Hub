import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import InvestorView from './components/InvestorView'
import { queryClient } from './hooks/queryClient'

function AuthGate() {
  const { session, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#D8D5E0', color:'#1A1A1A', fontFamily:'DM Sans, sans-serif', fontSize:16 }}>
      Loading…
    </div>
  )
  if (!session) return <LoginPage />
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
