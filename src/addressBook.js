// In-memory address book populated from decrypted emails.
// Persists only for the lifetime of the page session (no localStorage).

const addresses = new Map() // email -> { email, name }

export const addressBook = {
  add(addr) {
    if (!addr?.email) return
    if (!addresses.has(addr.email)) {
      addresses.set(addr.email, { email: addr.email, name: addr.name ?? '' })
    }
  },

  addAll(addrs) {
    if (!addrs) return
    for (const addr of addrs) this.add(addr)
  },

  search(query) {
    if (!query) return []
    const q = query.toLowerCase()
    const results = []
    for (const entry of addresses.values()) {
      if (
        entry.email.toLowerCase().includes(q) ||
        (entry.name && entry.name.toLowerCase().includes(q))
      ) {
        results.push(entry)
        if (results.length >= 8) break
      }
    }
    return results
  },
}
