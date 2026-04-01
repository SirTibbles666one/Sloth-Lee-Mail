import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/api'
import { storage } from '@/storage'
import { hashPassword, generateKeyPair, exportPublicKeyBase64, encryptPrivateKey, decryptPrivateKey, hasSubtleCrypto } from '@/crypto'
import { keySession } from '@/keySession'
import { Mail } from 'lucide-react'

const Login = () => {
  const [phase, setPhase] = useState('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      console.log('[Login] Hashing password for user:', username)
      const passwordHash = await hashPassword(password)
      console.log('[Login] Sending login request')
      const response = await api.post('/auth/login', { username, password: passwordHash })
      const { token, force_reset, username: name, public_key, salt, encrypted_private_key, is_admin } = response.data

      if (storage.getUsername() !== name) {
        console.log('[Login] Username changed from', storage.getUsername(), '→', name, '— clearing key session')
        keySession.clear()
      }

      storage.set({ token, force_reset, username: name })
      if (is_admin !== undefined) storage.set({ is_admin })
      if (public_key) storage.set({ public_key })
      if (salt) keySession.setSalt(salt)

      if (force_reset) {
        console.log('[Login] force_reset=true, switching to setup phase')
        setPhase('setup')
      } else {
        if (encrypted_private_key && salt) {
          try {
            console.log('[Login] Decrypting private key with salt:', salt)
            const privateKey = await decryptPrivateKey(encrypted_private_key, password, salt)
            await keySession.set(privateKey)
            console.log('[Login] ✅ Private key decrypted and loaded into session')
          } catch (keyErr) {
            console.error('[Login] ❌ Failed to decrypt private key:', keyErr)
          }
        } else {
          console.warn('[Login] ⚠️ Cannot load private key — missing fields:', {
            hasEncryptedPrivateKey: !!encrypted_private_key,
            hasSalt: !!salt,
          })
        }
        navigate('/')
      }
    } catch (err) {
      console.error('[Login] Login request failed:', err.response?.data ?? err.message)
      setError(err.response?.data?.error || 'Login failed')
    }
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const currentUsername = storage.getUsername()
      const serverSalt = keySession.getSalt()
      console.log('[Setup] Starting key generation for user:', currentUsername, 'salt:', serverSalt)
      const keyPair = await generateKeyPair()
      console.log('[Setup] RSA-4096 key pair generated')
      const publicKeyBase64 = await exportPublicKeyBase64(keyPair.publicKey)
      console.log('[Setup] Public key exported, base64 length:', publicKeyBase64.length)
      const encryptedKey = await encryptPrivateKey(keyPair.privateKey, setupPassword, serverSalt)
      console.log('[Setup] Private key encrypted, base64 length:', encryptedKey.length)
      const passwordHash = await hashPassword(setupPassword)

      let activeToken = storage.getToken()

      try {
        console.log('[Setup] Calling /user/setup')
        await api.post(
          '/user/setup',
          { password: passwordHash, public_key: publicKeyBase64, encrypted_private_key: encryptedKey },
          { headers: { Authorization: `Bearer ${activeToken}` } },
        )
        console.log('[Setup] /user/setup succeeded')
      } catch (setupErr) {
        console.warn('[Setup] /user/setup failed with status', setupErr.response?.status, '— attempting re-create flow')
        if (setupErr.response?.status !== 409) throw setupErr

        await api.delete('/admin/users', {
          data: { username: currentUsername },
          headers: { Authorization: `Bearer ${activeToken}` },
        })
        await api.post('/admin/users', { username: currentUsername }, {
          headers: { Authorization: `Bearer ${activeToken}` },
        })
        const loginRes = await api.post('/auth/login', {
          username: currentUsername,
          password: passwordHash,
        })
        console.log('[Setup] Re-login response:', {
          hasToken: !!loginRes.data.token,
          hasSalt: !!loginRes.data.salt,
          saltValue: loginRes.data.salt,
        })
        activeToken = loginRes.data.token
        if (loginRes.data.salt) keySession.setSalt(loginRes.data.salt)
        storage.set({ token: activeToken })
        await api.post(
          '/user/setup',
          { password: passwordHash, public_key: publicKeyBase64, encrypted_private_key: encryptedKey },
          { headers: { Authorization: `Bearer ${activeToken}` } },
        )
        console.log('[Setup] /user/setup succeeded on retry')
      }

      console.log('[Setup] Loading private key into session')
      await keySession.set(keyPair.privateKey)
      console.log('[Setup] ✅ Private key in session, storing encrypted key to localStorage')
      storage.set({ encrypted_key: encryptedKey, public_key: publicKeyBase64, force_reset: false })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed')
      console.error('[Setup] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderLogo = () => (
    <div className="flex justify-center items-center gap-2 mb-6">
      <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
        <Mail className="w-5 h-5 text-primary-foreground" />
      </div>
      <span className="text-2xl font-bold tracking-wide">
        <span className="text-foreground">Open</span>
        <span className="text-foreground/60 font-normal">Neutron</span>
      </span>
    </div>
  )

  if (phase === 'setup') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          {renderLogo()}
          <Card>
            <CardHeader>
              <CardTitle>Setup Account</CardTitle>
              <CardDescription>
                Choose a password to secure your account and generate your encryption keys.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label htmlFor="setup-password" className="block text-sm font-medium mb-1.5 text-foreground/80">New Password</label>
                  <Input
                    id="setup-password"
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />

                </div>
                <div>
                  <label htmlFor="setup-confirm" className="block text-sm font-medium mb-1.5 text-foreground/80">Confirm Password</label>
                  <Input
                    id="setup-confirm"
                    type="password"
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Generating keys…' : 'Setup Account & Login'}
                </Button>
                {loading && (
                  hasSubtleCrypto ? (
                    <p className="text-xs text-foreground/50 text-center pt-1">
                      Generating RSA-4096 key pair, this may take a moment…
                    </p>
                  ) : (
                    <p className="text-xs text-destructive text-center pt-1 font-medium">
                      No SSL connection detected — using software fallback (this will be significantly slower)
                    </p>
                  )
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {renderLogo()}
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-foreground/80">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. john"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-foreground/80">Password</label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Login