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
      className="fixed z-50 flex flex-col bg-card border border-border rounded-t-lg shadow-2xl"
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
                <span className="flex items-center gap-1.5 text-xs text-green-500">
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
                      className={r.status === 'failed' ? 'text-destructive' : 'text-green-500'}
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
                onClick={() => handleSend({ toChips, ccChips, bccChips, subject, body, attachments })}
                disabled={isSendBlocked || hasLoadingFiles}
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
