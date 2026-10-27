import { useState } from 'react'
import { Link } from 'react-router-dom'
import { hashPassword, encryptPrivateKey } from '@/crypto'
import { unwrapPrivateKeyWithRecovery, recoveryAuthProof } from '@/lib/recoveryKey'
import { userFetchRecoveryBlob, userRestoreWithRecoveryKey } from '@/api'

/**
 * Public page: regain access with a saved recovery key.
 *
 * Unlike an emailed reset, this keeps the *same* private key, so previously
 * received mail still decrypts. The key is unwrapped locally; the server only
 * ever sees a one-way proof and the re-wrapped key.
 */
export default function RecoverAccount() {
  const [step, setStep] = useState('username') // username -> key -> password -> done
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [bundle, setBundle] = useState(null)
  const [recoveredKey, setRecoveredKey] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fail = (err, fallback) => {
    setError(err?.response?.data?.error || err?.message || fallback)
    setBusy(false)
  }

  const lookup = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await userFetchRecoveryBlob(username.trim().toLowerCase())
      setBundle(data)
      setStep('key')
      setBusy(false)
    } catch (err) {
      fail(err, 'No recovery key is on file for that account')
    }
  }

  const unlock = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const key = await unwrapPrivateKeyWithRecovery(bundle.wrapped_key, secret, bundle.kdf_salt)
      setRecoveredKey(key)
      setStep('password')
      setBusy(false)
    } catch (err) {
      fail(err, 'That recovery key does not unlock this account')
    }
  }

  const finish = async (event) => {
    event.preventDefault()
    setError('')
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
      const wrapped = await encryptPrivateKey(recoveredKey, password, bundle.account_salt)
      const proof = await recoveryAuthProof(secret)
      await userRestoreWithRecoveryKey({
        username: username.trim().toLowerCase(),
        auth_proof: proof,
        credentials,
        wrapped_key: wrapped,
        kdf_salt: bundle.account_salt,
      })
      setStep('done')
    } catch (err) {
      fail(err, 'Could not restore the account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-foreground">Recover your account</h1>

        {step === 'username' && (
          <form onSubmit={lookup} className="mt-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Enter your mailbox name. You will need the recovery key you saved when the account was
              created.
            </p>
            <div>
              <label htmlFor="recover-username" className="block text-xs uppercase tracking-wide text-foreground/50">
                Username
              </label>
              <input
                id="recover-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </div>
            {error && <p id="recover-message" className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || !username.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? 'Looking…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'key' && (
          <form onSubmit={unlock} className="mt-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Paste the recovery key for <span className="text-foreground/80">{username}</span>.
              Dashes and letter case do not matter.
            </p>
            <div>
              <label htmlFor="recover-key" className="block text-xs uppercase tracking-wide text-foreground/50">
                Recovery key
              </label>
              <input
                id="recover-key"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            {error && <p id="recover-message" className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy || !secret.trim()}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? 'Unlocking…' : 'Unlock my mailbox'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={finish} className="mt-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Your key is unlocked. Choose a new password — your existing mail stays readable.
            </p>
            <div>
              <label htmlFor="recover-password" className="block text-xs uppercase tracking-wide text-foreground/50">
                New password
              </label>
              <input
                id="recover-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="recover-confirm" className="block text-xs uppercase tracking-wide text-foreground/50">
                Repeat password
              </label>
              <input
                id="recover-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </div>
            {error && <p id="recover-message" className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Set new password and sign in'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground/70">
              Your account is restored and every message you already had is still readable.
            </p>
            <p className="text-xs text-foreground/50">
              That recovery key is now spent. After you sign in, create a new one.
            </p>
            <Link to="/login" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Go to sign in
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="mt-4 text-center text-[11px] text-foreground/35">
            No recovery key? <Link to="/login" className="underline">Forgotten password options</Link>
          </p>
        )}
      </div>
    </div>
  )
}
