import { useState } from 'react'

type Mode = 'url' | 'file'

interface AddCustomModelFormProps {
  onComplete: (entry: { name: string; source: string; description?: string }) => void
  onCancel: () => void
}

/**
 * Two-mode form for adding a custom model:
 *   - URL:    free-text `http(s)://` source. The qvac layer will
 *             download via the SDK's `downloadAsset`.
 *   - FILE:   triggers the main-process file picker (via
 *             `models:pickFile`) and seeds the source with the
 *             picked absolute path.
 *
 * `registry://...` is intentionally NOT exposed in this form — the
 * curated registry list lives in `modelStore.ts` and is meant to be
 * maintained by app developers, not end users.
 */
export default function AddCustomModelForm({ onComplete, onCancel }: AddCustomModelFormProps) {
  const [mode, setMode] = useState<Mode>('url')
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [picking, setPicking] = useState(false)
  const [pickError, setPickError] = useState('')

  const handlePickFile = async () => {
    setPickError('')
    setPicking(true)
    try {
      const picked = await window.api.models.pickFile()
      if (picked) {
        setSource(picked)
        if (!name.trim()) {
          // Suggest a default name from the filename.
          const filename = picked.split(/[\\/]/).pop() ?? picked
          setName(filename.replace(/\.gguf$/i, ''))
        }
      }
    } catch (e) {
      setPickError(e instanceof Error ? e.message : 'Failed to pick file')
    } finally {
      setPicking(false)
    }
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    if (mode === 'url' && !/^https?:\/\//i.test(source.trim())) return
    if (mode === 'file' && !source.trim()) return
    onComplete({
      name: name.trim(),
      source: source.trim(),
      description: description.trim() || undefined,
    })
  }

  const canSubmit =
    name.trim().length > 0 &&
    ((mode === 'url' && /^https?:\/\//i.test(source.trim())) ||
      (mode === 'file' && source.trim().length > 0))

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[11px] tracking-wider2 text-brand-muted uppercase m-0">
        Add custom model
      </p>

      {/* Mode toggle */}
      <div className="inline-flex border border-brand-border rounded-md overflow-hidden self-start">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 font-mono text-[11px] tracking-wide2 uppercase border-0 cursor-pointer ${
            mode === 'url'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-brand-navy'
          }`}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`px-3 py-1.5 font-mono text-[11px] tracking-wide2 uppercase border-0 border-l border-brand-border cursor-pointer ${
            mode === 'file'
              ? 'bg-brand-blue text-white'
              : 'bg-white text-brand-navy'
          }`}
        >
          File
        </button>
      </div>

      <Field
        label="Name"
        value={name}
        onChange={setName}
        placeholder="My fine-tuned QWEN"
      />

      {mode === 'url' ? (
        <Field
          label="Source URL"
          value={source}
          onChange={setSource}
          placeholder="https://example.com/model.gguf"
          monospace
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase">
            GGUF file
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Click “Browse…” to pick a .gguf file"
              readOnly
              className="flex-1 px-3 py-2 border border-brand-border rounded-md font-mono text-xs text-brand-navy bg-brand-light outline-none focus:border-brand-blue"
            />
            <button
              type="button"
              onClick={() => void handlePickFile()}
              disabled={picking}
              className="px-3 py-2 bg-white border border-brand-blue text-brand-blue rounded-md font-mono text-[11px] font-bold tracking-wide2 uppercase cursor-pointer hover:bg-[#f7f7fc] disabled:opacity-50"
            >
              {picking ? 'Picking…' : 'Browse…'}
            </button>
          </div>
          {pickError && (
            <p className="font-sans text-xs text-brand-err mt-0.5 mb-0">{pickError}</p>
          )}
        </div>
      )}

      <Field
        label="Description (optional)"
        value={description}
        onChange={setDescription}
        placeholder="Local fine-tune, 8K context"
      />

      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-5 py-2.5 bg-brand-blue text-white border-0 rounded-md font-mono text-xs font-medium tracking-wide2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add model
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-xs font-medium tracking-wide2 uppercase cursor-pointer hover:bg-brand-light"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  monospace = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  monospace?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`px-3 py-2 border border-brand-border rounded-md text-[13px] text-brand-navy bg-white outline-none focus:border-brand-blue ${
          monospace ? 'font-mono' : 'font-sans'
        }`}
      />
    </div>
  )
}
