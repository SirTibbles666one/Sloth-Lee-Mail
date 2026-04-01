import { Search, ShieldCheck, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export function TopBar({ searchQuery, onSearchChange, userEmail, isAdmin, serverStatus, onLogout, onRetryServer, onChangePassword }) {
  return (
    <>
      <div className="h-12 flex items-center justify-between px-2 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/60">{userEmail}</span>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
              title="Admin panel"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={onChangePassword}
              className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
              title="Change password"
            >
              <KeyRound className="w-4 h-4" />
              Password
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-sm text-foreground/60 hover:text-foreground"
          >
            Logout
          </button>
        </div>
      </div>
      {serverStatus === 'unreachable' && (
        <div className="flex items-center justify-between px-4 py-2 bg-destructive/15 border-b border-destructive/30 text-destructive text-sm">
          <span>Server is not accessible. Check your connection or try again later.</span>
          <button
            onClick={onRetryServer}
            className="ml-4 px-2.5 py-1 rounded text-xs font-medium border border-destructive/40 hover:bg-destructive/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </>
  )
}
