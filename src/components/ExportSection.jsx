import { useState } from 'react'
import { Download } from 'lucide-react'
import { keySession } from '@/keySession'
import { emailListAll, emailGetRaw } from '@/api'
import { decryptEmail } from '@/crypto'
import { exportMailbox, downloadText } from '@/lib/exportMailbox'

// Your mail leaves with you. Assembled in the browser because only this device
// can decrypt it.
export default function ExportSection() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function run() {
    setBusy(true)
    setStatus('Unlocking your key…')
    try {
      const privateKey = await keySession.get()
      if (!privateKey) {
        setStatus('Unlock your encryption key first (OpenPGP panel), then try again.')
        setBusy(false)
        return
      }
      setStatus('Reading your mailbox…')
      const { mbox, total, failed } = await exportMailbox({
        list: emailListAll,
        get: emailGetRaw,
        decrypt: decryptEmail,
        privateKey,
      })
      const stamp = new Date().toISOString().slice(0, 10)
      downloadText(`sloth-lee-mail-${stamp}.mbox`, mbox)
      setStatus(
        failed.length
          ? `Exported ${total} messages. ${failed.length} could not be decrypted and were skipped.`
          : `Exported ${total} messages.`,
      )
    } catch (err) {
      setStatus(err?.message || 'The export could not be completed')
    }
    setBusy(false)
  }

  return (
    <section className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Download size={16} className="text-neutral-400" />
        <h3 className="text-sm font-medium text-neutral-200">Download your mail</h3>
      </div>
      <p className="mb-3 text-xs text-neutral-500">
        Saves every message as an .mbox file, decrypted on this device. Import it
        into Thunderbird or any mbox-compatible client. Attachments stay part of
        each message.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? 'Preparing…' : 'Download .mbox'}
      </button>
      {status ? <p className="mt-2 text-xs text-neutral-400">{status}</p> : null}
    </section>
  )
}
