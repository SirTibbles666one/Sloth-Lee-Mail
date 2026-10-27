// Export a mailbox as mbox, so a user can leave with their mail.
//
// Only the client can decrypt, so the archive is assembled here: list the
// uids, fetch each message, decrypt it, and join the plaintext RFC822 messages
// into the format Thunderbird and mutt can import.

export function toMbox(messages) {
  return messages
    .map((m) => {
      const raw = String(m.raw ?? '')
      // mbox separates messages with "From " at the start of a line, so any
      // occurrence inside a message has to be escaped or the archive splits
      // into the wrong number of messages.
      const escaped = raw.replace(/(^|\n)From /g, '$1>From ')
      const stamp = m.date ? ` ${m.date}` : ''
      return `From ${m.from || 'unknown'}${stamp}\n${escaped.replace(/\n*$/, '')}\n`
    })
    .join('\n')
}

export async function exportMailbox({ list, get, decrypt, privateKey }) {
  const uids = await list()
  const messages = []
  const failed = []

  for (const uid of uids) {
    try {
      const { data, message_key } = await get(uid)
      const raw = await decrypt(data, message_key, privateKey)
      messages.push({ raw, from: 'unknown', date: '' })
    } catch {
      // One unreadable message must not sink the export; record and continue.
      failed.push(uid)
    }
  }

  return { mbox: toMbox(messages), total: messages.length, failed }
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/mbox' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
