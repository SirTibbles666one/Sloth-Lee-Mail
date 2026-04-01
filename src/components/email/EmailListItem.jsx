import { useState } from 'react'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { Star, Folder, MailOpen, Mail, Trash2, MoreHorizontal, Check, Paperclip, Lock, LockKeyhole } from 'lucide-react'
import { formatEmailDate } from '@/emailParser'
import { SenderAvatar } from '@/components/SenderAvatar'

export function EmailListItem({
  uid,
  preview,
  isSelected,
  isChecked,
  isUnread,
  isStarred,
  onSelect,
  onCheck,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  onDeleteEmail,
  onMoveToGroup,
  onRemoveFromGroup,
  groups,
  selectedFolder,
}) {
  if (!preview) {
    return (
      <div className="flex items-start gap-3 p-3 border-b border-[#211F27]">
        <div className="w-8 h-8 rounded-md shrink-0 bg-white/5 animate-pulse" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-3.5 w-28 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
        </div>
      </div>
    )
  }

  const senderLabel =
    preview.from
      ? preview.from.name !== preview.from.email.split('@')[0]
        ? preview.from.name
        : preview.from.email
      : uid

  const isInGroup = selectedFolder && selectedFolder !== 'inbox' && selectedFolder !== 'starred'
  const [menuOpen, setMenuOpen] = useState(false)

  if (preview.decryptFailed) {
    return (
      <div
        role="button"
        onClick={() => onSelect(uid)}
        className={`flex items-start gap-3 p-3 cursor-pointer border-b border-l-2 transition-colors group/item ${
          isSelected
            ? 'bg-amber-950/40 border-l-amber-500 border-b-amber-900/40'
            : 'border-l-amber-600/50 border-b-border hover:bg-amber-950/20'
        }`}
      >
        <div
          onClick={(e) => { e.stopPropagation(); onCheck(uid) }}
          className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
            isChecked ? 'bg-primary border-primary opacity-100' : 'border-foreground/25 hover:border-foreground/50 opacity-0 group-hover/item:opacity-100'
          }`}
        >
          {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </div>
        <div className={`w-8 h-8 rounded-md shrink-0 flex items-center justify-center ${
          isSelected ? 'bg-amber-500/20' : 'bg-amber-900/20'
        }`}>
          <LockKeyhole className="w-4 h-4 text-amber-500/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5 gap-2">
            <span className={`font-medium text-sm truncate ${
              isSelected ? 'text-amber-200' : 'text-amber-500/80'
            }`}>
              Encrypted message
            </span>
            <span className={`text-xs whitespace-nowrap ${
              isSelected ? 'text-amber-200/60' : 'text-foreground/40'
            }`}>
              {preview.date ? formatEmailDate(preview.date) : ''}
            </span>
          </div>
          <p className={`text-xs ${
            isSelected ? 'text-amber-200/60' : 'text-amber-600/70'
          }`}>
            Cannot be decrypted with the current key
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteEmail(uid) }}
          className="shrink-0 p-1 rounded text-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/item:opacity-100"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      role="button"
      onClick={() => onSelect(uid)}
      className={`flex items-start gap-3 p-3 cursor-pointer border-b transition-colors group/item ${
        isSelected
          ? 'bg-primary/40 border-primary'
          : 'border-border hover:bg-accent'
      }`}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onCheck(uid) }}
        className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
          isChecked
            ? 'bg-primary border-primary opacity-100'
            : isSelected
            ? 'border-white/40 hover:border-white/70 opacity-100'
            : 'border-foreground/25 hover:border-foreground/50 opacity-0 group-hover/item:opacity-100'
        }`}
      >
        {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </div>
      <SenderAvatar from={preview.from} isSelected={isSelected} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-medium text-sm truncate ${
                isSelected ? 'text-white' : 'text-foreground'
              }`}
            >
              {senderLabel}
            </span>
            {preview.e2ee && (
              <Lock
                className={`w-3 h-3 shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-primary/70'}`}
                title="End-to-end encrypted"
              />
            )}
            {isUnread && !isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <span
            className={`text-xs whitespace-nowrap ${
              isSelected ? 'text-primary-foreground/80' : 'text-foreground/50'
            }`}
          >
            {preview.date ? formatEmailDate(preview.date) : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate ${
              isSelected ? 'text-primary-foreground/90' : 'text-foreground/65'
            }`}
          >
            {preview.subject}
          </p>

          <div className={`flex items-center gap-0.5 transition-opacity shrink-0 ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(uid) }}
              className={`p-1 rounded transition-colors ${
                isStarred
                  ? 'text-yellow-400'
                  : isSelected
                  ? 'text-primary-foreground/60 hover:text-yellow-400'
                  : 'text-foreground/50 hover:text-yellow-400'
              }`}
              title={isStarred ? 'Unstar' : 'Star'}
            >
              <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-yellow-400' : ''}`} />
            </button>
            <DropdownMenuRoot onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={`p-1 rounded transition-colors ${
                    isSelected ? 'text-primary-foreground/60 hover:text-primary-foreground' : 'text-foreground/50 hover:text-foreground'
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {isUnread ? (
                  <DropdownMenuItem onClick={() => onMarkRead(uid)}>
                    <MailOpen className="size-4" /> Mark as read
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onMarkUnread(uid)}>
                    <Mail className="size-4" /> Mark as unread
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Folder className="size-4" /> Move to group
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {groups.length > 0 ? groups.map((g) => (
                        <DropdownMenuItem key={g.uid} onClick={() => onMoveToGroup(uid, g.uid)}>
                          <Folder className="size-4" /> {g.title}
                        </DropdownMenuItem>
                      )) : (
                        <DropdownMenuItem disabled>
                          <span className="text-foreground/40">No groups yet</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                {isInGroup && (
                  <DropdownMenuItem onClick={() => onRemoveFromGroup(uid)}>
                    Remove from group
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => onDeleteEmail(uid)}>
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>
          </div>
        </div>

        {preview.attachments?.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Paperclip className="w-3 h-3 text-foreground/40 shrink-0" />
            {preview.attachments.slice(0, 3).map((att, i) => (
              <span
                key={i}
                className={`text-xs rounded px-1.5 py-0.5 truncate max-w-[120px] border ${
                  isSelected
                    ? 'bg-white/10 border-white/20 text-primary-foreground/70'
                    : 'bg-white/5 border-white/10 text-foreground/55'
                }`}
              >
                {att.name}
              </span>
            ))}
            {preview.attachments.length > 3 && (
              <span className={`text-xs ${isSelected ? 'text-primary-foreground/55' : 'text-foreground/40'}`}>
                +{preview.attachments.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
