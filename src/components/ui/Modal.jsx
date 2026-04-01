import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

export function Modal({ isOpen, children, onClose }) {
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)))
      return () => cancelAnimationFrame(raf)
    } else {
      setShow(false)
      const t = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-card border border-border shadow-2xl rounded-lg w-full max-w-md m-4 transition-all duration-200 ${
          show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <button
        onClick={onClose}
        className="size-7 rounded-md flex items-center justify-center text-foreground/50 hover:bg-accent hover:text-foreground transition-colors"
      >
        <X className="size-5" />
      </button>
    </div>
  )
}

export function ModalContent({ children }) {
  return <div className="p-6 space-y-4">{children}</div>
}

export function ModalFooter({ children }) {
  return <div className="flex justify-end gap-3 p-4 border-t border-border bg-secondary/30">{children}</div>
}

export function ConfirmModal({ isOpen, title, description, confirmText = 'Confirm', onConfirm, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title={title} onClose={onClose} />
      <ModalContent>
        <p className="text-foreground/75">{description}</p>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={onConfirm}>{confirmText}</Button>
      </ModalFooter>
    </Modal>
  )
}

export function InputModal({ isOpen, title, label, placeholder, initialValue = '', confirmText = 'Save', onConfirm, onClose }) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    if (isOpen) {
      setValue(initialValue ?? '')
    }
  }, [isOpen, initialValue])

  const handleConfirm = () => {
    onConfirm(value)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader title={title} onClose={onClose} />
      <ModalContent>
        {label && <p className="text-sm font-medium text-foreground/85 mb-2">{label}</p>}
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirm()
            }
          }}
          placeholder={placeholder}
          className="w-full h-10 text-sm bg-input border border-border rounded-md px-3 text-foreground outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/60"
        />
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm}>{confirmText}</Button>
      </ModalFooter>
    </Modal>
  )
}