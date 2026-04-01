const KEY = 'openneutron'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function save(obj) {
  localStorage.setItem(KEY, JSON.stringify({ ...load(), ...obj }))
}

export const storage = {
  getToken: () => load().token ?? null,
  getForceReset: () => load().force_reset ?? false,
  getUsername: () => load().username ?? null,
  getIsAdmin: () => load().is_admin ?? false,
  getEncryptedKey: () => load().encrypted_key ?? null,
  getPublicKey: () => load().public_key ?? null,
  set: (obj) => save(obj),

  getEmailMeta: () => load().email_meta ?? {},
  setEmailMeta: (uid, patch) => {
    const meta = load().email_meta ?? {}
    meta[uid] = { ...meta[uid], ...patch }
    save({ email_meta: meta })
  },

  getGroups: () => load().groups ?? [],
  saveGroups: (groups) => save({ groups }),

  getSentUids: () => load().sent_uids ?? [],
  addSentUid: (uid) => {
    const uids = load().sent_uids ?? []
    if (!uids.includes(String(uid))) save({ sent_uids: [String(uid), ...uids] })
  },
  setSentUids: (uids) => save({ sent_uids: uids }),

  clear: () => {
    const { encrypted_key, public_key, username } = load()
    localStorage.removeItem(KEY)
    if (encrypted_key || public_key) save({ encrypted_key, public_key, username })
  },
  fullClear: () => localStorage.removeItem(KEY),

  getDrafts: () => load().drafts ?? [],
  saveDraft: (draft) => {
    const drafts = load().drafts ?? []
    const idx = drafts.findIndex((d) => d.id === draft.id)
    if (idx >= 0) drafts[idx] = draft
    else drafts.unshift(draft)
    save({ drafts })
  },
  deleteDraft: (id) => {
    const drafts = (load().drafts ?? []).filter((d) => d.id !== id)
    save({ drafts })
  },
}
