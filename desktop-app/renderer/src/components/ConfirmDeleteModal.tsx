import { useEffect, useRef, useState } from 'react'
import { BaseModal } from './BaseModal'
import type { Employee } from '../../ai/types'

interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  target: Employee | null
  onConfirm: () => void
}

export default function ConfirmDeleteModal({
  open,
  onClose,
  target,
  onConfirm
}: ConfirmDeleteModalProps) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    const id = requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    timerRef.current = setTimeout(() => {
      setTyped('')
    }, 4000)

    return () => {
      cancelAnimationFrame(id)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  const canDelete = target && typed.trim() === target.displayName

  function handleConfirm() {
    if (!canDelete) return
    onConfirm()
    onClose()
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title='Delete Employee'
      subtitle='This action cannot be undone.'
      footer={
        <>
          <button
            type='button'
            onClick={onClose}
            className='inline-flex h-9 items-center rounded-md border border-brand-border bg-white px-4 text-sm font-medium text-brand-navy transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand-teal/60'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={!canDelete}
            className='inline-flex h-9 items-center rounded-md bg-brand-err px-4 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-err/60 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Delete
          </button>
        </>
      }
    >
      <p className='mb-3 text-sm text-brand-navy'>
        Are you sure you want to delete{' '}
        <span className='font-semibold'>{target?.displayName}</span>?
      </p>
      <label htmlFor='confirm-delete-input' className='sr-only'>
        Type the employee name to confirm
      </label>
      <input
        id='confirm-delete-input'
        ref={inputRef}
        type='text'
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleConfirm()
          }
        }}
        placeholder={`Type "${target?.displayName}" to confirm`}
        spellCheck={false}
        autoComplete='off'
        className='h-9 w-full rounded border border-brand-border bg-white px-3 text-sm text-brand-navy placeholder:text-brand-muted focus:border-brand-err focus:outline-none focus:ring-2 focus:ring-brand-err/60'
      />
    </BaseModal>
  )
}
