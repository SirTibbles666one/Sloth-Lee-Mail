import { useState, useRef, useCallback } from 'react'
import {
  X,
  Minus,
  Send,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Trash2,
} from 'lucide-react'
import { AddressField } from '@/components/compose/AddressField'
import { AttachmentChip } from '@/components/compose/AttachmentChip'
import { TiptapEditor } from '@/components/compose/TiptapEditor'
import { useSendEmail } from '@/hooks/useSendEmail'
import { useAttachments } from '@/hooks/useAttachments'
import { useResizable } from '@/hooks/useResizable'
import { Lock, LockOpen } from 'lucide-react'
import { keyCoverage, encryptBody, encryptAttachment, hasIdentity, importPublicKey } from '@/pgp'
import { lookupKey } from '@/lib/wkd'

const ComposeWindow = ({ myEmail, onClose, onSent, replyData = null, draftId = null, onDeleteDraft }) => {
  const [minimized, setMinimized] = useState(false)

  const currentDraftId = useRef(draftId ?? ('draft_' + Date.now()))

  const [toChips,  setToChips]  = useState(() => replyData?.to  ?? [])
  const [ccChips,  setCcChips]  = useState(() => replyData?.cc  ?? [])
  const [bccChips, setBccChips] = useState(() => replyData?.bcc ?? [])
  const [subject,  setSubject]  = useState(() => replyData?.subject ?? '')
  const [body,     setBody]     = useState(() => replyData?.body ?? '')

  const { sendState, sendError, sendResults, handleSend, reportError } = useSendEmail({
    myEmail, replyData, draftId, onDeleteDraft, onSent, onClose,
  })

  const { attachments, isDragOver, setIsDragOver, fileInputRef, addFiles, removeAttachment } = useAttachments({
    onError: reportError,
  })

  const { windowRef, size, handleResizeMouseDown } = useResizable()

  // OpenPGP (inline) is separate from the server-side E2EE the send hook does:
  // it is what makes mail readable by correspondents on other providers.
  const [pgpOn, setPgpOn] = useState(false)
  const [pgpPass, setPgpPass] = useState('')
  const [pgpError, setPgpError] = useState('')
  const [pgpBusy, setPgpBusy] = useState(false)

  const recipients = [...toChips, ...ccChips, ...bccChips]
  const coverage = keyCoverage(recipients)
  const [finding, setFinding] = useState(false)
  const [found, setFound] = useState('')

  /** Fetch any missing recipient keys from WKD / keys.openpgp.org, then pin them. */
  const findMissingKeys = async () => {
    if (!coverage.missing.length) return
    setFinding(true)
    setFound('')
    const notes = []
    for (const address of coverage.missing) {
      try {
        const hit = await lookupKey(address)
        if (!hit) {
          notes.push(`no key found for ${address}`)
          continue
        }
        await importPublicKey(hit.armored)
        notes.push(`${address} from ${hit.source}`)
      } catch (err) {
        notes.push(`${address}: ${err.message || 'could not import'}`)
      }
    }
    setFound(notes.join(' · '))
    setFinding(false)
  }

  const plainText = (html) =>
    (html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  const sendWithPgpIfNeeded = async () => {
    if (!pgpOn) {
      handleSend({ toChips, ccChips, bccChips, subject, body, attachments })
      return
    }
    setPgpError('')
    if (!hasIdentity()) {
      setPgpError('Create your OpenPGP key first — lock icon in the top bar')
      return
    }
    if (!coverage.canEncrypt) {
      setPgpError(`No OpenPGP key for: ${coverage.missing.join(', ')}`)
      return
    }
    if (!pgpPass) {
      setPgpError('Enter your PGP passphrase to sign and encrypt')
      return
    }
    if (attachments.some((a) => a.status !== 'ready')) {
      setPgpError('Some files are still being read — wait a moment and try again')
      return
    }
    setPgpBusy(true)
    try {
      const armored = await encryptBody({
        text: plainText(body),
        recipients,
        passphrase: pgpPass,
      })

      // Each file travels as its own encrypted .asc, so the recipient's client
      // never has to understand PGP/MIME to read it.
      const encryptedFiles = []
      for (const att of attachments) {
        const bytes = new Uint8Array(await att.file.arrayBuffer())
        const armoredFile = await encryptAttachment({ bytes, recipients, passphrase: pgpPass })
        encryptedFiles.push({
          name: `${att.name}.asc`,
          type: 'application/pgp-encrypted',
          data: btoa(unescape(encodeURIComponent(armoredFile))),
        })
      }

      handleSend({ toChips, ccChips, bccChips, subject, body: armored, attachments: encryptedFiles })
    } catch (err) {
      setPgpError(err.message || 'Encryption failed')
    } finally {
      setPgpBusy(false)
    }
  }

  const buildDraft = useCallback(() => {
    const hasContent = toChips.length > 0 || subject.trim() || (body && body.replace(/<(.|\n)*?>/g, '').trim()) || attachments.length > 0
    if (!hasContent) return null
    return {
      id:        currentDraftId.current,
      to:        toChips,
      cc:        ccChips,
      bcc:       bccChips,
      subject,
      body,
      updatedAt: Date.now(),
    }
  }, [toChips, ccChips, bccChips, subject, body, attachments])

  const handleClose = useCallback(() => {
    const draft = buildDraft()
    onClose(draft)
  }, [buildDraft, onClose])

  const handleDiscard = useCallback(() => {
    if (draftId) onDeleteDraft?.(draftId)
    onClose(null)
  }, [draftId, onDeleteDraft, onClose])

  const isSending       = ['resolving', 'fetchingkeys', 'encrypting', 'sending'].includes(sendState)
  const hasLoadingFiles = attachments.some((a) => a.status === 'loading')
  const isSendBlocked   = isSending || sendState === 'done'

  const sendStatusLabel = {
    resolving:    'Resolving…',
    fetchingkeys: 'Fetching recipient keys…',
    encrypting:   'Encrypting…',
    sending:      'Sending…',
    done:         'Sent!',
    error:        sendError,
  }[sendState]

  return (
    <div
      ref={windowRef}
      className="compose-window fixed z-50 flex flex-col bg-card border border-border rounded-t-lg shadow-2xl"
      style={{ bottom: 0, right: 24, width: minimized ? 320 : size.w, height: minimized ? 'auto' : size.h }}
    >
      {!minimized && (
        <>
          <div className="absolute top-0 left-4 right-0 h-1.5 cursor-n-resize z-10"
               onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div className="absolute left-0 top-4 bottom-0 w-1.5 cursor-w-resize z-10"
               onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20"
               onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
        </>
      )}

      {/* Title bar */}
      <div className="flex items-center justify-between px-3 h-10 bg-muted/30 rounded-t-lg border-b border-border shrink-0 select-none">
        <span className="text-sm font-medium text-card-foreground truncate">
          {subject || 'New Message'}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDiscard}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Discard draft"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Save draft & close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Address + subject fields */}
          <div className="shrink-0 border-b border-border">
            <div className="px-3 pt-3">
              <AddressField label="To:" chips={toChips} onChipsChange={setToChips} />
              <AddressField label="Cc:" chips={ccChips} onChipsChange={setCcChips} />
              <AddressField label="Bcc:" chips={bccChips} onChipsChange={setBccChips} />
            </div>
            <div className="flex items-center px-6">
              <span className="text-sm font-semibold text-muted-foreground w-14 shrink-0 py-1.5">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="My super secret subject"
                className="flex-1 py-1.5 bg-transparent outline-none text-sm text-card-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Body + drag-and-drop */}
          <div
            className="flex-1 flex flex-col relative min-h-0 bg-muted/20"
            onDragOver={(e)  => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              const files = Array.from(e.dataTransfer.files)
              if (files.length > 0) addFiles(files)
            }}
          >
            {isDragOver && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-primary/10 border-2 border-dashed border-primary/50 rounded-lg pointer-events-none">
                <Paperclip className="w-8 h-8 text-primary/70" />
                <span className="text-sm font-medium text-primary/80">Drop files to attach</span>
                <span className="text-xs text-primary/60">Max 20 MB per file</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-border/60 text-xs">
              <button
                type="button"
                onClick={() => { setPgpOn(!pgpOn); setPgpError('') }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
                  pgpOn ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
                title="Encrypt this message with OpenPGP"
              >
                {pgpOn ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                OpenPGP
              </button>
              {pgpOn && (
                <>
                  <input
                    type="password"
                    value={pgpPass}
                    onChange={(e) => setPgpPass(e.target.value)}
                    placeholder="Key passphrase"
                    autoComplete="off"
                    className="flex-1 min-w-[8rem] bg-transparent border-b border-border/70 outline-none py-1 text-xs"
                  />
                  <span className={`text-[11px] ${coverage.canEncrypt ? 'text-primary' : 'text-destructive'}`}>
                    {coverage.canEncrypt
                      ? `to ${recipients.length} key${recipients.length === 1 ? '' : 's'}`
                      : coverage.missing.length
                        ? `no key: ${coverage.missing.join(', ')}`
                        : 'add a recipient'}
                  </span>
                  {!coverage.canEncrypt && coverage.missing.length > 0 && (
                    <button
                      type="button"
                      onClick={findMissingKeys}
                      disabled={finding}
                      className="text-[11px] underline underline-offset-2 text-primary/90 disabled:opacity-50"
                    >
                      {finding ? 'looking up…' : 'find key'}
                    </button>
                  )}
                  {attachments.length > 0 && (
                    <span className="text-[11px] text-foreground/45">
                      {attachments.length} file{attachments.length === 1 ? '' : 's'} encrypted separately
                    </span>
                  )}
                </>
              )}
            </div>
            {found && (
              <p className="px-3 py-1 text-[11px] text-foreground/60 border-b border-border/60">{found}</p>
            )}
            {pgpError && (
              <p className="px-3 py-1 text-[11px] text-destructive border-b border-border/60">{pgpError}</p>
            )}
            <TiptapEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message… (or drag & drop files to attach)"
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-border/60 shrink-0">
                {attachments.map((att) => (
                  <AttachmentChip key={att.id} att={att} onRemove={() => removeAttachment(att.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Footer: status + send */}
          <div className="shrink-0 px-3 py-2 border-t border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              {hasLoadingFiles && !isSending && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Reading files…
                </span>
              )}
              {isSending && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {sendStatusLabel}
                </span>
              )}
              {sendState === 'done' && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {sendStatusLabel}
                </span>
              )}
              {sendState === 'error' && (
                <span className="flex items-center gap-1.5 text-xs text-destructive min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={sendError}>{sendError}</span>
                </span>
              )}
              {sendState === 'done' && sendResults.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs ml-2 shrink-0">
                  {sendResults.map((r, i) => (
                    <span
                      key={i}
                      title={r.error ?? undefined}
                      className={r.status === 'failed' ? 'text-destructive' : 'text-primary'}
                    >
                      {r.address.split('@')[0]}: {r.status}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) addFiles(files)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSendBlocked}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                title="Attach files (max 20 MB each)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={sendWithPgpIfNeeded}
                disabled={isSendBlocked || hasLoadingFiles || pgpBusy}
                title={hasLoadingFiles ? 'Waiting for files to finish loading…' : undefined}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ComposeWindow
