import { X, Loader2, AlertCircle, FileText } from 'lucide-react'
import { formatBytes } from '@/lib/mime'

export function AttachmentChip({ att, onRemove }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border max-w-[200px] ${
        att.status === 'error'
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-accent/50 border-border text-foreground/80'
      }`}
      title={
        att.status === 'error'
          ? att.readError
          : att.status === 'loading'
          ? `Reading ${att.name}…`
          : `${att.name} (${formatBytes(att.size)})`
      }
    >
      {att.status === 'loading' ? (
        <Loader2 className="w-3 h-3 shrink-0 animate-spin text-foreground/50" />
      ) : att.status === 'error' ? (
        <AlertCircle className="w-3 h-3 shrink-0" />
      ) : (
        <FileText className="w-3 h-3 shrink-0 text-foreground/50" />
      )}
      <span className="truncate">{att.name}</span>
      {att.status === 'ready' && (
        <span className="text-foreground/40 shrink-0">{formatBytes(att.size)}</span>
      )}
      {att.status === 'error' && <span className="shrink-0 opacity-70">failed</span>}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}
