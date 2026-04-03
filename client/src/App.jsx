import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'

import Ledger from './pages/Ledger'
import CreateQuote from './pages/CreateQuote'
import ViewQuote from './pages/ViewQuote'
import Clients from './pages/Clients'
import Admin from './pages/Admin'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'

// ─── Auth context ─────────────────────────────────────────────────────────────

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = not authed

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
  }, [])

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
}

// ─── AuthGuard ────────────────────────────────────────────────────────────────

function AuthGuard({ children, adminOnly = false }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/accept" element={<AcceptInvite />} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><Ledger /></AuthGuard>} />
        <Route path="/quotes/new" element={<AuthGuard><CreateQuote /></AuthGuard>} />
        <Route path="/quotes/:id" element={<AuthGuard><ViewQuote /></AuthGuard>} />
        <Route path="/clients" element={<AuthGuard><Clients /></AuthGuard>} />
        <Route path="/admin/users" element={<AuthGuard adminOnly><Admin /></AuthGuard>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
