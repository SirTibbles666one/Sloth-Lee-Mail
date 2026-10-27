import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hashPassword } from '@/crypto'
import { resetWithToken } from '@/api'

/**
 * Public page reached from the recovery email: choose a new password.
 *
 * The token in the URL is the only proof of identity, which is why it is
 * single-use and expires. The password is hashed here exactly like login, so
 * the server never sees it.
 */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('This link is missing its code. Ask the operator for a new one.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const credentials = await hashPassword(password)
      await resetWithToken(token, credentials)
      setDone(true)
    } catch (err) {
      const message = err?.response?.data?.error
      setError(message || 'That reset link is invalid or has expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>

        {done ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground/70">
              Your password is set. Sign in with it and you will be asked to create a new
              encryption key.
            </p>
            <p className="text-xs text-foreground/50">
              Mail that was encrypted to your old key cannot be read any more. If you exported a
              copy of that key, import it after signing in.
            </p>
            <Link
              to="/login"
              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-foreground/60">
              This link works once and expires an hour after it was sent.
            </p>

            <div>
              <label htmlFor="reset-password" className="block text-xs uppercase tracking-wide text-foreground/50">
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm" className="block text-xs uppercase tracking-wide text-foreground/50">
                Repeat password
              </label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </div>

            {error && (
              <p id="reset-message" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
