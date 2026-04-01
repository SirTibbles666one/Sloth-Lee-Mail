import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Trash2, MailOpen, Mail, Folder, ChevronLeft, ChevronRight, Check, RefreshCw } from 'lucide-react'

export function EmailToolbar({
  pagedUids,
  checkedUids,
  totalFiltered,
  pageStart,
  pageEnd,
  safePage,
  pageCount,
  hasMore,
  groups,
  onToggleSelectAll,
  onDeleteSelected,
  onMarkSelectedRead,
  onMarkSelectedUnread,
  onMoveSelectedToGroup,
  onPrevPage,
  onNextPage,
  onRefresh,
  refreshing,
}) {
  const allChecked = pagedUids.length > 0 && pagedUids.every(uid => checkedUids.has(uid))

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-foreground/60 bg-background">
      <div className="flex items-center gap-1">
        <div
          onClick={onToggleSelectAll}
          className={`w-4 h-4 border-2 rounded flex items-center justify-center cursor-pointer p-0.5 transition-colors ${
            allChecked
              ? 'bg-primary border-primary'
              : 'border-foreground/40 hover:border-foreground/70 text-foreground/60 hover:text-foreground'
          }`}
          title="Select all"
        >
          {allChecked && <Check className="w-full h-full text-primary-foreground" />}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          onClick={() => checkedUids.size > 0 && onDeleteSelected()}
          disabled={checkedUids.size === 0}
          className={`p-1.5 rounded transition-colors ${
            checkedUids.size > 0
              ? 'text-destructive hover:bg-destructive/15'
              : 'text-foreground/25 cursor-default'
          }`}
          title="Delete selected"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => checkedUids.size > 0 && onMarkSelectedRead()}
          disabled={checkedUids.size === 0}
          className={`p-1.5 rounded transition-colors ${
            checkedUids.size > 0
              ? 'text-foreground/70 hover:bg-accent hover:text-foreground'
              : 'text-foreground/25 cursor-default'
          }`}
          title="Mark selected as read"
        >
          <MailOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => checkedUids.size > 0 && onMarkSelectedUnread()}
          disabled={checkedUids.size === 0}
          className={`p-1.5 rounded transition-colors ${
            checkedUids.size > 0
              ? 'text-foreground/70 hover:bg-accent hover:text-foreground'
              : 'text-foreground/25 cursor-default'
          }`}
          title="Mark selected as unread"
        >
          <Mail className="w-4 h-4" />
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 rounded transition-colors text-foreground/70 hover:bg-accent hover:text-foreground disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        {groups.length > 0 && (
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <button
                disabled={checkedUids.size === 0}
                className={`p-1.5 rounded transition-colors ${
                  checkedUids.size > 0
                    ? 'text-foreground/70 hover:bg-accent hover:text-foreground'
                    : 'text-foreground/25 cursor-default'
                }`}
                title="Move selected to group"
              >
                <Folder className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            {checkedUids.size > 0 && (
              <DropdownMenuContent align="start">
                {groups.map((g) => (
                  <DropdownMenuItem key={g.uid} onClick={() => onMoveSelectedToGroup(g.uid)}>
                    <Folder className="size-4" /> {g.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenuRoot>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-foreground/60">
          {checkedUids.size > 0
            ? `${checkedUids.size} selected`
            : totalFiltered === 0 ? '0' : `${pageStart}–${pageEnd} of ${totalFiltered}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-accent hover:text-foreground disabled:opacity-30"
            disabled={safePage === 0}
            onClick={onPrevPage}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="p-1 rounded hover:bg-accent hover:text-foreground disabled:opacity-30"
            disabled={safePage >= pageCount - 1 && !hasMore}
            onClick={onNextPage}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
