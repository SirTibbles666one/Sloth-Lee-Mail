import { Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { EmailListItem } from '@/components/email/EmailListItem'

const EmailList = ({
  uids,
  previews,
  emailMeta,
  selectedUid,
  checkedUids,
  onSelect,
  onCheck,
  onToggleSelectAll,
  loading,
  hasMore,
  onLoadMore,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  onDeleteEmail,
  onMoveToGroup,
  onRemoveFromGroup,
  groups,
  folderLabel,
  selectedFolder,
  filterMode = 'all',
  onFilterModeChange,
}) => {
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const allChecked = uids.length > 0 && uids.every(uid => checkedUids?.has(uid))

  useEffect(() => {
    if (loading) {
      setHasAttemptedLoad(true)
    }
  }, [loading])

  useEffect(() => {
    setHasAttemptedLoad(false)
  }, [selectedFolder])
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] border-b border-border bg-background font-medium tracking-wide">
        <div
          onClick={onToggleSelectAll}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
            allChecked ? 'bg-primary border-primary' : 'border-foreground/30 hover:border-foreground/60'
          }`}
          title="Select all"
        >
          {allChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </div>
        <div className="flex items-center gap-3">
          {['all', 'unread', 'read'].map((mode) => (
            <span
              key={mode}
              onClick={() => onFilterModeChange?.(mode)}
              className={`capitalize cursor-pointer px-2.5 py-1 rounded transition-colors ${
                filterMode === mode
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/55 hover:text-foreground'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {uids.map((uid) => (
          <EmailListItem
            key={uid}
            uid={uid}
            preview={previews[uid]}
            isSelected={selectedUid === uid}
            isChecked={!!checkedUids?.has(uid)}
            isUnread={emailMeta[uid]?.unread !== false}
            isStarred={!!emailMeta[uid]?.starred}
            onSelect={onSelect}
            onCheck={onCheck}
            onMarkRead={onMarkRead}
            onMarkUnread={onMarkUnread}
            onToggleStar={onToggleStar}
            onDeleteEmail={onDeleteEmail}
            onMoveToGroup={onMoveToGroup}
            onRemoveFromGroup={onRemoveFromGroup}
            groups={groups}
            selectedFolder={selectedFolder}
          />
        ))}
        {uids.length === 0 && !loading && hasAttemptedLoad && (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-foreground/80">It's quiet in here</p>
            <p className="text-sm text-foreground/50 mt-1">There are no emails in this folder.</p>
          </div>
        )}
        {hasMore && (
          <div className="p-4">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground/50 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailList
