// PartyIdModal — shows party ID with QR code, copy button, and edit capability.

import { useState } from 'react'
import { Copy, Check, Edit2, X } from 'lucide-react'
import Drawer from '../Drawer'
import { useEmployees } from '../../context/EmployeeContext'

interface PartyIdModalProps {
  open: boolean
  onClose: () => void
  employeeId: string
  partyId: string | undefined
}

export function PartyIdModal({ open, onClose, employeeId, partyId }: PartyIdModalProps) {
  const { update } = useEmployees()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(partyId ?? '')
  const [saving, setSaving] = useState(false)

  const handleCopy = async () => {
    if (!partyId) return
    try {
      await navigator.clipboard.writeText(partyId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('[PartyIdModal] copy failed:', e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await update(employeeId, { cantonPartyId: draft.trim() || undefined })
      setEditing(false)
      onClose()
    } catch (e) {
      console.error('[PartyIdModal] save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const qrUrl = partyId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(partyId)}`
    : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Party ID"
      subtitle={partyId ? 'Canton network identifier' : 'Not configured'}
    >
      <div className="space-y-4">
        {/* QR Code */}
        {qrUrl && (
          <div className="flex justify-center">
            <img
              src={qrUrl}
              alt="Party ID QR Code"
              className="w-32 h-32 rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Party ID field */}
        <div className="space-y-1">
          <p className="m-0 font-mono text-[10px] uppercase tracking-wider2 text-gray-400">
            Canton Party ID
          </p>
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Enter party ID"
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded border border-gray-200 bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded bg-blue-600 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-900">
                {partyId ?? '—'}
              </code>
              {partyId && (
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy"
                  className="flex-shrink-0 rounded border border-gray-200 bg-white p-1.5 hover:bg-gray-50"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-gray-600" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setDraft(partyId ?? ''); setEditing(true) }}
                title="Edit"
                className="flex-shrink-0 rounded border border-gray-200 bg-white p-1.5 hover:bg-gray-50"
              >
                <Edit2 size={12} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

export default PartyIdModal
