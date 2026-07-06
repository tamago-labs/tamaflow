import { useEffect, useRef, useState } from 'react'
import { Loader2, User } from 'lucide-react'
import { BaseModal } from './BaseModal'

export interface NameEditModalProps {
  open: boolean
  currentName: string
  onClose: () => void
  onSubmit: (name: string) => void
  busy?: boolean
}

export function NameEditModal({
  open,
  currentName,
  onClose,
  onSubmit,
  busy = false
}: NameEditModalProps) {
  const [name, setName] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(currentName)
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [open, currentName])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== currentName && !busy

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(trimmed)
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title='Change display name'
      hint='Your display name for the teamspace.'
      busy={busy}
      icon={<User className='h-5 w-5 text-brand-teal' aria-hidden='true' />}
      footer={
        <>
          <button
            type='button'
            onClick={onClose}
            disabled={busy}
            className='inline-flex h-9 items-center rounded-md border border-brand-border bg-white px-4 text-sm font-medium text-brand-navy transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={!canSubmit}
            className='inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-blue px-4 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {busy && <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />}
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <label htmlFor='name-edit-modal-input' className='sr-only'>
        Display name
      </label>
      <input
        id='name-edit-modal-input'
        ref={inputRef}
        type='text'
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder='e.g. Alice'
        spellCheck={false}
        autoComplete='off'
        disabled={busy}
        maxLength={32}
        className='h-9 w-full rounded border border-brand-border bg-white px-3 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-60'
      />
    </BaseModal>
  )
}
