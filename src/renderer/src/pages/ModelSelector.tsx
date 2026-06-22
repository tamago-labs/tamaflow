import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAI } from '../context/AIContext'
import { TealBar, Wordmark } from '../components/ModelSelectorChrome'
import { ModelCard } from '../components/ModelCard'
import AddCustomModelForm from '../components/AddCustomModelForm'
import { statusForEntry } from '../utils/modelDisplay'
import type { ModelEntry } from '../../../preload/index.d'

/**
 * ModelSelector — list of registered models with the same card layout
 * as the my-doctor-ai picker. The user picks one, which kicks off a
 * download/load in the main process. The parent (App) then transitions
 * to the LoadingScreen to show real progress, so the page itself is
 * just list + add-form chrome.
 */
export default function ModelSelector({
  onComplete,
}: {
  onComplete: (entry: ModelEntry) => void
}) {
  const { status, progress, error, select, cancel } = useAI()
  const [showAddForm, setShowAddForm] = useState(false)
  const [localEntries, setLocalEntries] = useState<ModelEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    void refresh()
  }, [])

  const refresh = async () => {
    try {
      if (window.api?.models?.list) {
        const list = await window.api.models.list()
        setLocalEntries(list)
      }
    } catch (e) {
      console.error('[ModelSelector] Failed to list models:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async (entry: {
    name: string
    source: string
    description?: string
  }) => {
    setAddError('')
    setSubmitting(true)
    try {
      const newEntry = await window.api.models.add(entry)
      setLocalEntries((prev) => [...prev, newEntry])
      setShowAddForm(false)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add model')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (entry: ModelEntry) => {
    if (entry.builtin) return
    if (!confirm(`Remove "${entry.name}"?`)) return
    try {
      const ok = await window.api.models.remove(entry.id)
      if (ok) {
        setLocalEntries((prev) => prev.filter((m) => m.id !== entry.id))
      }
    } catch (err) {
      console.error('[ModelSelector] Failed to remove:', err)
    }
  }

  /**
   * Fire-and-forget: kick off the load and immediately let the parent
   * transition to the LoadingScreen. The screen reads `progress` /
   * `isReady` from useAI() and will advance once the SDK reports the
   * model as loaded.
   */
  const handlePick = (entry: ModelEntry) => {
    setAddError('')
    void select(entry.id).catch((e) => {
      console.error('[ModelSelector] select failed:', e)
    })
    onComplete(entry)
  }

  const handleCancel = () => {
    void cancel(false).catch((e) => {
      console.error('[ModelSelector] cancel failed:', e)
    })
  }

  const activeId = status?.active?.id ?? null
  const lastSelectedId = status?.lastSelectedId ?? null

  return (
    <div className="min-h-screen bg-white flex items-center justify-start pl-14 relative overflow-hidden font-sans">
      {/* Top-right geometric blocks */}
      <div className="absolute top-0 right-[180px] w-[200px] h-[160px] bg-brand-teal z-[1]" />
      <div className="absolute top-0 right-0 w-[180px] h-[80px] bg-brand-blue z-[3]" />
      <div className="absolute top-[80px] right-0 w-[320px] h-[240px] bg-brand-blue z-[2]" />
      {/* Teal left-edge accent */}
      <div className="absolute bottom-0 left-0 w-1 h-[100px] bg-brand-teal z-[5]" />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[10] bg-white border border-brand-border w-full max-w-[420px] overflow-hidden"
      >
        <TealBar />

        <div className="px-8 pt-7 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Wordmark />
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase">
              Private & On-Device AI
            </span>
          </div>

          {isLoading ? (
            <div className="text-center py-10">
              <span className="font-mono text-xs text-brand-muted tracking-wide2">
                LOADING MODELS…
              </span>
            </div>
          ) : showAddForm ? (
            <AddCustomModelForm
              onComplete={handleAdd}
              onCancel={() => {
                setShowAddForm(false)
                setAddError('')
              }}
            />
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-wider2 text-brand-muted uppercase mb-2 m-0">
                Models
              </p>
              <h1 className="font-sans text-2xl font-light text-brand-navy mb-6 leading-tight m-0">
                Choose a <strong className="font-medium">model</strong>
                <br />
                to load
              </h1>

              {error && (
                <div className="py-2.5 px-3 bg-brand-errBg border border-brand-errBorder rounded-md mb-3">
                  <p className="font-mono text-[10px] text-brand-err uppercase tracking-wide2 m-0 mb-1">
                    {error.code}
                  </p>
                  <p className="font-sans text-xs text-brand-errDark m-0">
                    {error.message}
                  </p>
                </div>
              )}

              {addError && (
                <p className="font-sans text-xs text-brand-err mb-3 mt-0">
                  {addError}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {localEntries.length === 0 && (
                  <p className="text-[13px] text-brand-muted mb-2 font-sans m-0">
                    No models in your registry yet — add one to get started.
                  </p>
                )}

                {localEntries.map((entry) => {
                  const st = statusForEntry(entry, {
                    activeId,
                    lastSelectedId,
                    progress: progress
                      ? { phase: progress.phase, percentage: progress.percentage }
                      : null,
                    error: error ?? null,
                  })
                  return (
                    <ModelCard
                      key={entry.id}
                      entry={entry}
                      isLastSelected={entry.id === lastSelectedId}
                      status={st}
                      submitting={submitting}
                      onSelect={() => handlePick(entry)}
                      onCancel={handleCancel}
                      onRemove={entry.builtin ? undefined : () => void handleRemove(entry)}
                    />
                  )
                })}

                {/* Add custom model pseudo-card */}
                <motion.button
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-3.5 p-3 bg-white border-2 border-dashed border-brand-teal rounded-md cursor-pointer text-left w-full mt-1"
                  style={{ borderColor: '#3EC4C0' }}
                >
                  <div className="w-[34px] h-[34px] bg-brand-teal flex items-center justify-center font-mono font-bold text-lg text-white flex-shrink-0">
                    +
                  </div>
                  <span className="font-mono text-xs tracking-wide2 text-brand-tealAccent uppercase">
                    Add custom model
                  </span>
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
