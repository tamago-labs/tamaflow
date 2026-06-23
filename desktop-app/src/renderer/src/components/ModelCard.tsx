import { motion } from 'framer-motion'
import type { ModelEntry } from '../../../preload/index.d'
import {
  formatSize,
  type EntryStatus,
} from '../utils/modelDisplay'

interface ModelCardProps {
  entry: ModelEntry
  isLastSelected: boolean
  status: EntryStatus
  submitting: boolean
  onSelect: () => void
  onCancel: () => void
  onRemove?: () => void
}

/**
 * A single row in the model registry list. Renders the model name,
 * an optional size pill, an optional 2-line description, a status
 * dot, and a CANCEL button while the entry is in-flight. No avatar,
 * no status text — the card is intentionally minimal so the
 * description can breathe. The card itself does not draw a progress
 * fill — the App transitions to the full LoadingScreen once a model
 * is picked, so the per-row bar is unnecessary chrome.
 */
export function ModelCard({
  entry,
  isLastSelected,
  status,
  submitting,
  onSelect,
  onCancel,
  onRemove,
}: ModelCardProps) {
  const isInflight = status.tone === 'inflight'
  const sizeLabel = formatSize(entry.size)
  return (
    <div
      className={`relative rounded-md border ${
        isLastSelected
          ? 'bg-[#f0fafa] border-brand-border border-l-[3px] border-l-brand-teal'
          : 'bg-brand-light border-brand-border'
      }`}
    >
      <motion.button
        whileHover={!isInflight && !submitting ? { x: 4 } : undefined}
        whileTap={!isInflight && !submitting ? { scale: 0.98 } : undefined}
        onClick={onSelect}
        disabled={isInflight || submitting}
        className={`flex items-center gap-3.5 p-3 bg-transparent border-0 text-left w-full ${
          isInflight || submitting ? 'cursor-wait' : 'cursor-pointer'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-sm font-medium text-brand-navy whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
              {entry.name}
            </span>
            {sizeLabel && <Pill label={`Size: ${sizeLabel}`} />}
          </div>
          {entry.description && (
            <span className="block font-sans text-[11px] text-brand-muted mt-1 leading-snug line-clamp-2">
              {entry.description}
            </span>
          )}
        </div>
        {isInflight ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancel()
            }}
            className="bg-transparent border-0 text-brand-blue font-mono text-[10px] font-bold tracking-wide2 cursor-pointer py-0.5 px-1.5"
          >
            CANCEL
          </button>
        ) : (
          <span
            className="w-[7px] h-[7px] rounded-full flex-shrink-0"
            style={{ background: status.color }}
            title={status.label}
            aria-label={status.label}
          />
        )}
      </motion.button>
      {!entry.builtin && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 bg-transparent border-0 text-brand-muted font-mono text-base cursor-pointer px-1.5 leading-none hover:text-brand-err"
          title="Remove model"
          aria-label="Remove model"
        >
          ×
        </button>
      )}
    </div>
  )
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[9px] font-bold rounded-full px-2 py-0.5 tracking-wide2 uppercase whitespace-nowrap border text-brand-navy bg-white border-brand-border">
      {label}
    </span>
  )
}
