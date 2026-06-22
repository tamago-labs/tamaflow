import { motion } from 'framer-motion'
import { useAI } from '../context/AIContext'
import { WORDMARK } from '../theme'
import { formatSize } from '../utils/modelDisplay'
import type { ModelEntry } from '../../../preload/index.d'

interface ReadyProps {
  onBackToPicker: () => void
  onUnload: () => void
}

/**
 * Terminal "AI is ready" landing page. Shown after the LoadingScreen
 * advances. Shows the loaded model's name, size, and quantization;
 * offers a "Change model" button to go back to the picker and an
 * "Unload" button to free memory.
 */
export default function Ready({ onBackToPicker, onUnload }: ReadyProps) {
  const { isReady, activeModel, status } = useAI()
  const model: ModelEntry | null = activeModel ?? (status?.active.id
    ? (status.available.find((m) => m.id === status.active.id) ?? null)
    : null)

  return (
    <div className="min-h-screen bg-white relative overflow-hidden flex items-center pl-14">
      {/* Same geometric blocks as ModelSelector / LoadingScreen for visual continuity */}
      <div className="absolute top-0 right-[180px] w-[200px] h-[160px] bg-brand-teal z-[1]" />
      <div className="absolute top-0 right-0 w-[180px] h-[80px] bg-brand-blue z-[3]" />
      <div className="absolute top-[80px] right-0 w-[320px] h-[240px] bg-brand-blue z-[2]" />
      <div className="absolute bottom-0 left-0 w-1 h-[100px] bg-brand-teal z-[5]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-[10] max-w-[480px]"
      >
        <p className="font-mono font-bold text-2xl tracking-wide text-brand-blue mb-12 m-0">
          <span className="text-brand-navy">{WORDMARK.prefix}</span>
          <span className="text-brand-blue">{WORDMARK.suffix}</span>
        </p>

        <p className="text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-2.5 m-0">
          {isReady ? 'Ready' : 'No model loaded'}
        </p>
        <h1 className="text-[32px] font-light text-brand-navy tracking-tight leading-[1.15] mb-10 m-0">
          {isReady ? (
            <>
              AI is <strong className="font-medium">ready</strong>
            </>
          ) : (
            <>
              Choose a model
              <br />
              to get started
            </>
          )}
        </h1>

        {model && (
          <div className="bg-white border border-brand-border rounded-md p-5 mb-6 max-w-[420px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-brand-teal" />
              <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
                Active model
              </p>
            </div>
            <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
              {model.name}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {model.params && (
                <span className="inline-flex items-center font-mono text-[10px] font-bold text-brand-navy bg-brand-light border border-brand-border rounded-full px-2 py-0.5 tracking-wide2 uppercase">
                  {model.params}
                </span>
              )}
              {model.quantization && (
                <span className="inline-flex items-center font-mono text-[10px] font-bold text-brand-navy bg-brand-light border border-brand-border rounded-full px-2 py-0.5 tracking-wide2 uppercase">
                  {model.quantization}
                </span>
              )}
              {formatSize(model.size) && (
                <span className="inline-flex items-center font-mono text-[10px] font-bold text-brand-navy bg-brand-light border border-brand-border rounded-full px-2 py-0.5 tracking-wide2 uppercase">
                  Size: {formatSize(model.size)}
                </span>
              )}
              {model.builtin && (
                <span className="inline-flex items-center font-mono text-[10px] font-bold text-brand-tealAccent bg-[#eafaf8] border border-brand-teal rounded-full px-2 py-0.5 tracking-wide2 uppercase">
                  Built-in
                </span>
              )}
            </div>
            {model.description && (
              <p className="font-sans text-xs text-brand-muted mt-3 mb-0 leading-relaxed">
                {model.description}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPicker}
            className="px-6 py-3 bg-brand-blue text-white border-0 rounded-md font-mono text-xs font-medium cursor-pointer uppercase tracking-wide2 hover:opacity-90"
          >
            Change model
          </button>
          {isReady && (
            <button
              type="button"
              onClick={onUnload}
              className="px-6 py-3 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-xs font-medium cursor-pointer uppercase tracking-wide2 hover:bg-brand-light"
            >
              Unload
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
