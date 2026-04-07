import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './context/AuthContext'

import Ledger from './pages/Ledger'
import CreateQuote from './pages/CreateQuote'
import ViewQuote from './pages/ViewQuote'
import Customers from './pages/Customers'
import CreateCustomer from './pages/CreateCustomer'
import CustomerProfile from './pages/CustomerProfile'
import Admin from './pages/Admin'
import AdminPricing from './pages/AdminPricing'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'

// ─── AuthGuard ────────────────────────────────────────────────────────────────

function AuthGuard({ children, adminOnly = false }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) {
    return <div className="min-h-screen bg-surface flex items-center justify-center text-on-surface-variant text-sm">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
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
        <Route path="/login" element={<Login />} />
        <Route path="/accept" element={<AcceptInvite />} />

        {/* Protected routes */}
        <Route path="/" element={<AuthGuard><Ledger /></AuthGuard>} />
        <Route path="/quotes/new" element={<AuthGuard><CreateQuote /></AuthGuard>} />
        <Route path="/quotes/:id" element={<AuthGuard><ViewQuote /></AuthGuard>} />
        <Route path="/customers" element={<AuthGuard><Customers /></AuthGuard>} />
        <Route path="/customers/new" element={<AuthGuard><CreateCustomer /></AuthGuard>} />
        <Route path="/customers/:id" element={<AuthGuard><CustomerProfile /></AuthGuard>} />
        <Route path="/admin/users" element={<AuthGuard adminOnly><Admin /></AuthGuard>} />
        <Route path="/admin/pricing" element={<AuthGuard adminOnly><AdminPricing /></AuthGuard>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
