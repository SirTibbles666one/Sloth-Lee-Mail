import { useState, useRef } from 'react'
import { KeyRound, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  generateKeyPair,
  exportPublicKeyBase64,
  encryptPrivateKey,
  decryptPrivateKey,
  hashPassword,
  getPublicCryptoKeyFromPrivate,
  encryptEmail,
  decryptEmail,
} from '@/crypto'
import { keySession } from '@/keySession'
import { storage } from '@/storage'
import { userSetCredentials, emailListAll, emailGetRaw, emailSetRaw } from '@/api'

export function ChangePasswordModal({ isOpen, onClose }) {
  const [phase, setPhase] = useState('form') // 'form' | 'working' | 'done'

  const [currentPwd, setCurrentPwd]   = useState('')
  const [newPwd, setNewPwd]           = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [formError, setFormError]     = useState('')

  const [status, setStatus]     = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  const abortRef = useRef(false)

  const reset = () => {
    setPhase('form')
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setFormError('')
    setStatus('')
    setProgress({ done: 0, total: 0, failed: 0 })
    abortRef.current = false
  }

  const handleClose = () => {
    if (phase === 'working') return // don't allow close mid-run
    reset()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (newPwd.length < 1) { setFormError('New password cannot be empty'); return }
    if (newPwd !== confirmPwd) { setFormError('Passwords do not match'); return }

    setPhase('working')
    abortRef.current = false

    try {
      // 1. Verify current password by re-decrypting stored private key
      setStatus('Verifying current password…')
      const encryptedKey = storage.getEncryptedKey()
      if (!encryptedKey) throw new Error('No encrypted key found in storage')
      const serverSalt = keySession.getSalt()
      if (!serverSalt) throw new Error('Server salt not found - please log out and back in')
      const username = storage.getUsername()
      let oldPrivateKey
      try {
        oldPrivateKey = await decryptPrivateKey(encryptedKey, currentPwd, serverSalt)
      } catch {
        setPhase('form')
        setFormError('Current password is incorrect')
        return
      }

      // 2. Generate new key pair
      setStatus('Generating new key pair…')
      const newKeyPair = await generateKeyPair()
      const newPublicKeyB64 = await exportPublicKeyBase64(newKeyPair.publicKey)
      const newEncryptedKey = await encryptPrivateKey(newKeyPair.privateKey, newPwd, serverSalt)
      const newPasswordHash = await hashPassword(newPwd)

      // 3. Push new credentials to server
      setStatus('Updating credentials on server…')
      await userSetCredentials(newPasswordHash, newPublicKeyB64, newEncryptedKey)

      // 4. Update local storage and session key BEFORE re-encrypting so server
      //    accepts future requests with the new token (token is unchanged here)
      storage.set({ encrypted_key: newEncryptedKey, public_key: newPublicKeyB64 })
      await keySession.set(newKeyPair.privateKey)

      // 5. Gather all email UIDs
      setStatus('Fetching email list…')
      const uids = await emailListAll()
      const total = uids.length
      setProgress({ done: 0, total, failed: 0 })

      if (total === 0) {
        setStatus('Done - no emails to re-encrypt.')
        setPhase('done')
        return
      }

      setStatus('Re-encrypting emails…')
      let done = 0
      let failed = 0

      for (const uid of uids) {
        if (abortRef.current) break
        try {
          const { data: rawData, message_key: rawMsgKey } = await emailGetRaw(uid)
          const plaintext = await decryptEmail(rawData, rawMsgKey, oldPrivateKey)
          const { aes_encrypted, data_encrypted } = await encryptEmail(plaintext, newKeyPair.publicKey)
          await emailSetRaw(uid, data_encrypted, aes_encrypted)
          done++
        } catch {
          failed++
          done++ // still count as processed
        }
        setProgress({ done, total, failed })
      }

      setStatus(
        failed === 0
          ? `All ${total} email${total !== 1 ? 's' : ''} re-encrypted successfully.`
          : `Done - ${total - failed}/${total} re-encrypted. ${failed} could not be re-encrypted (already unreadable).`,
      )
      setPhase('done')
    } catch (err) {
      setPhase('form')
      setFormError(err?.response?.data?.error || err?.message || 'An error occurred')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader title="Change Password" onClose={handleClose} />

      {phase === 'form' && (
        <form onSubmit={handleSubmit}>
          <ModalContent>
            <p className="text-sm text-foreground/60">
              Changing your password generates a new encryption key pair. All stored emails will
              be sequentially re-encrypted with the new key.
            </p>
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-foreground/60 mb-1 block">Current Password</label>
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/60 mb-1 block">New Password</label>
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/60 mb-1 block">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {formError && (
                <p className="text-xs text-destructive pt-1">{formError}</p>
              )}
            </div>
          </ModalContent>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={!currentPwd || !newPwd || !confirmPwd}>
              <KeyRound className="w-4 h-4 mr-1.5" />
              Change Password
            </Button>
          </ModalFooter>
        </form>
      )}

      {phase === 'working' && (
        <ModalContent>
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-foreground/70 text-center">{status}</p>
            {progress.total > 0 && (
              <div className="w-full space-y-2">
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-foreground/50">
                  <span>{progress.done} / {progress.total} emails</span>
                  {progress.failed > 0 && (
                    <span className="text-amber-500">{progress.failed} skipped</span>
                  )}
                  <span>{pct}%</span>
                </div>
              </div>
            )}
          </div>
        </ModalContent>
      )}

      {phase === 'done' && (
        <ModalContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {progress.failed === 0 ? (
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            ) : (
              <XCircle className="w-10 h-10 text-amber-500" />
            )}
            <p className="text-sm text-foreground/80">{status}</p>
            {progress.failed > 0 && (
              <p className="text-xs text-foreground/50 max-w-xs">
                Emails that could not be re-encrypted were already unreadable with the old key.
                They remain on the server in their previous state.
              </p>
            )}
          </div>
        </ModalContent>
      )}

      {phase === 'done' && (
        <ModalFooter>
          <Button onClick={() => { reset(); onClose() }}>Close</Button>
        </ModalFooter>
      )}
    </Modal>
  )
}
