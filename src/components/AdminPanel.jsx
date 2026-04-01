import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, RefreshCw, ShieldCheck, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmModal, InputModal } from '@/components/ui/Modal'
import { adminGetUsers, adminCreateUser, adminDeleteUser, adminSetAdminStatus } from '@/api'
import { storage } from '@/storage'

const AdminPanel = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalState, setModalState] = useState({ type: null })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminGetUsers()
      setUsers(data.users ?? [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!storage.getIsAdmin()) {
      navigate('/')
      return
    }
    fetchUsers()
  }, [fetchUsers, navigate])

  const handleCreate = async (username) => {
    setModalState({ type: null })
    try {
      await adminCreateUser(username.trim())
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user')
    }
  }

  const handleDelete = async () => {
    const { username } = modalState
    setModalState({ type: null })
    try {
      await adminDeleteUser(username)
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user')
    }
  }

  const handleToggleAdmin = async (user) => {
    const myUsername = storage.getUsername()
    if (user.username === myUsername) return // never change own role
    try {
      await adminSetAdminStatus(user.username, !user.is_admin)
      setUsers((prev) =>
        prev.map((u) => u.username === user.username ? { ...u, is_admin: !u.is_admin } : u)
      )
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update admin status')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
              title="Back to inbox"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-xl font-semibold">Admin management</h1>
                <p className="text-sm text-foreground/60">
                    Due to nature of the application, there isnt anything much you can do here except creating new users or deleting existing ones.
                </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2 rounded-md text-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button
              onClick={() => setModalState({ type: 'create' })}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New User
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-foreground/50">Loading…</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-foreground/50">No users found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-2.5 font-medium text-foreground/60">Username</th>
                  <th className="text-left px-4 py-2.5 font-medium text-foreground/60">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-foreground/60">Admin</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => {
                  const isSelf = user.username === storage.getUsername()
                  return (
                  <tr
                    key={user.uid ?? user.username}
                    className={`border-b border-border last:border-0 ${idx % 2 === 0 ? '' : 'bg-secondary/10'}`}
                  >
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-foreground/70">{user.email ?? '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => !isSelf && handleToggleAdmin(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot change your own role' : user.is_admin ? 'Revoke admin' : 'Grant admin'}
                        className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          isSelf
                            ? 'opacity-50 cursor-not-allowed border-transparent'
                            : 'cursor-pointer hover:opacity-80'
                        } ${
                          user.is_admin
                            ? 'bg-primary/15 border-primary/30 text-primary'
                            : 'bg-secondary border-border text-foreground/50 hover:border-foreground/30'
                        }`}
                      >
                        {user.is_admin
                          ? <><ShieldCheck className="w-3 h-3" /> Admin</>
                          : <><Shield className="w-3 h-3" /> User</>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModalState({ type: 'delete', username: user.username })}
                        className="p-1.5 rounded text-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={`Delete ${user.username}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InputModal
        isOpen={modalState.type === 'create'}
        onClose={() => setModalState({ type: null })}
        title="Create New User"
        label="Username"
        placeholder="e.g. john"
        confirmText="Create"
        onConfirm={handleCreate}
      />

      <ConfirmModal
        isOpen={modalState.type === 'delete'}
        onClose={() => setModalState({ type: null })}
        title="Delete User"
        description={`Are you sure you want to delete "${modalState.username}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default AdminPanel
