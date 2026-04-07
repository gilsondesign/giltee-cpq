import { useSearchParams } from 'react-router-dom'
import GoogleIcon from '../components/GoogleIcon'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
      <div className="bg-surface rounded p-10 w-full max-w-sm text-center">
        <img src="/giltee-logo.svg" alt="Giltee" className="h-10 w-auto mx-auto mb-3" />
        <p className="text-on-surface-variant text-sm mb-2">The Ledger — Quote Management</p>

        <div className="w-12 h-12 bg-secondary-fixed/20 rounded-full flex items-center justify-center mx-auto my-6">
          <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-on-surface font-bold text-xl mb-2">You've been invited</h1>
        <p className="text-on-surface-variant text-sm mb-8">
          Sign in with your Google account to access Giltee Ledger.
        </p>

        {!token && (
          <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-6">
            Invalid or missing invite token. Please use the full invite link you received.
          </div>
        )}

        {token ? (
          <a
            href="/auth/google"
            className="flex items-center justify-center gap-3 w-full font-medium py-2.5 px-4 rounded transition-colors bg-gradient-to-br from-primary to-primary-container text-on-primary hover:opacity-90"
          >
            <GoogleIcon />
            Sign in with Google
          </a>
        ) : (
          <button
            disabled
            aria-disabled="true"
            className="flex items-center justify-center gap-3 w-full font-medium py-2.5 px-4 rounded transition-colors bg-surface-container-highest text-on-surface-variant cursor-not-allowed"
          >
            <GoogleIcon />
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  )
}
