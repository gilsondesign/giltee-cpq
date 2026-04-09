import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAuth } from '../context/AuthContext'

export function SettingsShell({ children }) {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-on-surface mb-1">Settings</h1>
        <p className="text-on-surface-variant text-sm mb-6">Manage users and system configuration.</p>
        <div className="flex gap-0 border-b border-outline-variant/40 mb-8">
          {[
            { to: '/admin/users', label: 'Users' },
            { to: '/admin/pricing', label: 'Manufacturers' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Admin() {
  const { user: currentUser } = useAuth()
  const [data, setData] = useState({ users: [], invitations: [] })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState(null)
  const [inviteError, setInviteError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/auth/users').then(r => r.json())
      .then((userData) => {
        setData(userData)
        setLoading(false)
      }).catch((err) => {
        setFetchError(err.message || 'Failed to load data')
        setLoading(false)
      })
  }, [])

  async function handleInvite(e) {
    e.preventDefault()
    setSubmitting(true)
    setInviteError(null)
    setInviteLink(null)

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create invite')
      setInviteLink(json.inviteUrl)
      setInviteEmail('')
      // Refresh list
      const refreshed = await fetch('/api/auth/users').then(r => r.json())
      setData(refreshed)
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusToggle(userId, currentStatus) {
    setActionError(null)
    setToggling(true)
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to update user status')
      }
      const refreshed = await fetch('/api/auth/users').then(r => r.json())
      setData(refreshed)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <SettingsShell>
        <div className="text-on-surface-variant">Loading...</div>
      </SettingsShell>
    )
  }

  const pendingInvitations = data.invitations.filter(i => i.status === 'pending')

  return (
    <SettingsShell>
      <h2 className="text-lg font-semibold text-on-surface mb-1">User Management</h2>
      <p className="text-on-surface-variant text-sm mb-8">Invite team members and manage access to Giltee Ledger.</p>

      {fetchError && (
        <p className="mb-6 text-sm text-error">{fetchError}</p>
      )}

      {/* Invite form */}
      <section className="bg-surface-container-low rounded p-6 mb-8">
        <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-4">INVITE USER</p>
        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email address to invite"
            required
            className="flex-1 bg-surface rounded px-3 py-2 text-sm text-on-surface placeholder:text-[#cacaca] focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Send Invite'}
          </button>
        </form>

        {inviteLink && (
          <div className="mt-4 bg-secondary-fixed/20 rounded p-3">
            <p className="text-xs text-on-surface-variant mb-1">Invite link (share this):</p>
            <div className="flex items-center gap-2">
              <code className="text-xs text-on-surface flex-1 break-all">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="text-xs text-secondary font-medium whitespace-nowrap hover:underline"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {inviteError && (
          <p className="mt-3 text-sm text-error">{inviteError}</p>
        )}
      </section>

      {/* Active users */}
      <section className="mb-8">
        <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-3">ACTIVE USERS</p>

        {actionError && (
          <p className="mb-3 text-sm text-error">{actionError}</p>
        )}

        <div className="bg-surface-container-low rounded overflow-hidden">
          {data.users.map(user => (
            <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-container transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-bold flex items-center justify-center">
                  {user.name?.slice(0, 2).toUpperCase() || user.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-on-surface">{user.name || user.email}</p>
                  <p className="text-xs text-on-surface-variant">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  user.role === 'admin'
                    ? 'bg-secondary-fixed/20 text-secondary'
                    : 'bg-surface-container-highest text-on-surface-variant'
                }`}>
                  {user.role}
                </span>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => handleStatusToggle(user.id, user.status)}
                    disabled={toggling}
                    className="text-xs text-on-surface-variant hover:text-error transition-colors disabled:opacity-60"
                  >
                    {user.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section>
          <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-3">PENDING INVITATIONS</p>
          <div className="bg-surface-container-low rounded overflow-hidden">
            {pendingInvitations.map(invite => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-on-surface">{invite.email}</p>
                <p className="text-xs text-on-surface-variant">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </SettingsShell>
  )
}
