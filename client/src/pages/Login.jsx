import { useSearchParams } from 'react-router-dom'
import GoogleIcon from '../components/GoogleIcon'

export default function Login() {
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
      <div className="bg-surface rounded p-10 w-full max-w-sm text-center">
        <img src="/giltee-logo.svg" alt="Giltee" className="h-10 w-auto mx-auto mb-3" />
        <p className="text-on-surface-variant text-sm mb-8">The Ledger — Quote Management</p>

        {error === 'auth_failed' && (
          <div className="bg-error-container text-on-error-container text-sm rounded p-3 mb-6">
            Sign-in failed. You may not have an invitation, or your account may be suspended.
          </div>
        )}

        <a
          href="/auth/google"
          className="flex items-center justify-center gap-3 w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-medium py-2.5 px-4 rounded hover:opacity-90 transition-opacity"
        >
          <GoogleIcon />
          Sign in with Google
        </a>

        <p className="text-xs text-on-surface-variant mt-6">
          Access is by invitation only. Contact your admin if you need access.
        </p>
      </div>
    </div>
  )
}
