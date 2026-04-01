import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(addr) {
  return EMAIL_RE.test(addr.trim())
}

export function downloadAttachment(att) {
  const bytes = new Uint8Array(att.data.length)
  for (let i = 0; i < att.data.length; i++) {
    bytes[i] = att.data.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: att.contentType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = att.name || 'attachment'
  a.click()
  URL.revokeObjectURL(url)
}