import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { keySession } from '@/keySession'
import {
  Inbox,
  Star,
  SendHorizontal,
  FileEdit,
  MoreVertical,
  Plus,
  Tag,
} from 'lucide-react'

const DEFAULT_FOLDERS = [
  { id: 'inbox', icon: Inbox, label: 'Inbox' },
  { id: 'starred', icon: Star, label: 'Starred' },
  { id: 'sent', icon: SendHorizontal, label: 'Sent' },
  { id: 'drafts', icon: FileEdit, label: 'Drafts' },
]

const Sidebar = ({
  selectedFolder,
  onSelectFolder,
  groups,
  onRequestCreateGroup,
  onRequestRenameGroup,
  onRequestDeleteGroup,
  emailMeta,
  uids,
  sentCount = 0,
  draftsCount = 0,
  onCompose,
}) => {
  const inboxUnread = uids.filter((uid) => emailMeta[uid]?.unread !== false).length
  const starredCount = uids.filter((uid) => emailMeta[uid]?.starred).length

  const getBadge = (id) => {
    if (id === 'inbox') return inboxUnread
    if (id === 'starred') return starredCount
    if (id === 'sent') return sentCount
    if (id === 'drafts') return draftsCount
    return 0
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Logo */}
      <div className="h-12 flex items-center px-4">
        <div className="flex items-center gap-2 font-bold text-xl tracking-wide">
          <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center shrink-0">

          </div>
          <span className="text-foreground font-bold">Open</span>
          <span className="text-foreground/55 font-normal -ml-1.5">Neutron</span>
        </div>
      </div>

      {/* New Message Button */}
      <div className="px-3 py-3">
        <button
          onClick={onCompose}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 px-4 font-medium text-center transition-colors"
        >
          New Message
        </button>
      </div>

      {/* Nav items */}
      <div className="px-2 pt-2 space-y-0.5">
        {DEFAULT_FOLDERS.map(({ id, icon: Icon, label }) => {
          const badge = getBadge(id)
          const isActive = selectedFolder === id
          return (
            <div
              key={id}
              onClick={() => onSelectFolder(id)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-md transition-colors ${
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-foreground/65 hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              {badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground/65'
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Divider */}
      <div className="my-3 mx-3 border-t border-border" />

      {/* Groups section header */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Groups</span>
        <button
          onClick={onRequestCreateGroup}
          className="text-foreground/55 hover:text-foreground transition-colors"
          title="New group"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Group list */}
      <div className="flex-1 custom-scrollbar overflow-y-auto px-2 space-y-0.5">
        {groups.map((group) => {
          const isActive = selectedFolder === group.uid
          const count = group.email_uids.filter((uid) => uids.includes(uid)).length
          return (
            <div key={group.uid} className="relative group/item">
              <div
                onClick={() => onSelectFolder(group.uid)}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-md transition-colors pr-8 ${
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/65 hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-4 h-4 text-foreground/45 shrink-0" />
                  <span className="text-sm font-medium truncate">{group.title}</span>
                </div>
                {count > 0 && (
                  <span className="text-xs text-foreground/55 font-medium min-w-[20px] text-right shrink-0">
                    {count}
                  </span>
                )}
              </div>

              {/* Dropdown - appears on row hover */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <DropdownMenuRoot>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-foreground/55 hover:text-foreground rounded transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => onRequestRenameGroup(group.uid, group.title)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      destructive
                      onClick={() => onRequestDeleteGroup(group.uid, group.title)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuRoot>
              </div>
            </div>
          )
        })}
        {groups.length === 0 && (
          <p className="text-xs text-foreground/50 text-center px-4 py-6">No groups yet.</p>
        )}
      </div>
    </div>
  )
}

export default Sidebar
