import { useEffect } from 'react'
import { useAI } from '../context/AIContext'
import { LOADING_COMPLETE_DELAY_MS, WORDMARK } from '../theme'
import Logomark from '../components/Logomark'

/**
 * LoadingScreen — listens to `progress` / `isReady` from the AI
 * context and shows a real progress bar that mirrors the SDK's
 * download + load phases. When the model reports `isReady = true`
 * we wait a short delay (so the user sees "100%" / "Ready") and
 * then call `onComplete` to advance the boot flow.
 */
export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const { isReady, progress, error, activeModel, reload, resetCache, setError } = useAI()

  // When the model finishes loading, advance after a short delay.
  useEffect(() => {
    if (!isReady) return
    const t = setTimeout(() => onComplete(), LOADING_COMPLETE_DELAY_MS)
    return () => clearTimeout(t)
  }, [isReady, onComplete])

  const percent = Math.max(0, Math.min(100, Math.round(progress?.percentage ?? 0)))
  const modelLabel = activeModel?.name ?? 'Model'
  const statusText = error
    ? 'Error loading model'
    : progress?.phase === 'downloading'
      ? `Downloading ${modelLabel}…`
      : progress?.phase === 'loading'
        ? `Loading ${modelLabel}…`
        : isReady
          ? 'Ready'
          : 'Preparing model…'

  return (
    <div className="min-h-screen bg-white relative overflow-hidden flex items-center pl-14">
      {/* Teal block — top-right, behind blue */}
      <div className="absolute top-0 right-[180px] w-[240px] h-[200px] bg-brand-teal z-[1]" />
      {/* Small blue cap — top-right corner */}
      <div className="absolute top-0 right-0 w-[180px] h-[100px] bg-brand-blue z-[3]" />
      {/* Large blue block — steps forward and down */}
      <div className="absolute top-[100px] right-0 w-[360px] h-[280px] bg-brand-blue z-[2]" />
      {/* Teal left-edge accent bar */}
      <div className="absolute bottom-0 left-0 w-1 h-[80px] bg-brand-teal z-[5]" />

      {/* Content */}
      <div className="relative z-[10]">
        {/* Brand lockup */}
        <div className="flex items-center gap-2.5 mb-12">
          <Logomark size={36} />
          <p className="font-mono font-bold text-2xl tracking-wide text-brand-blue m-0">
            <span className="text-brand-navy">{WORDMARK.prefix}</span>
            <span className="text-brand-blue">{WORDMARK.suffix}</span>
          </p>
        </div>

        {/* App label */}
        <p className="text-[11px] font-medium tracking-wider3 text-brand-muted uppercase mb-2.5 m-0">
          AI Auto-Payroll on Canton
        </p>

        {/* App title */}
        <h1 className="text-[32px] font-light text-brand-navy tracking-tight leading-[1.15] mb-10 m-0">
          Preparing
          <br />
          <strong className="font-medium">Local AI</strong>
        </h1>

        {/* Progress bar or Error state */}
        <div className="w-[260px]">
          {error ? (
            <div>
              <div className="p-4 bg-brand-errBg border border-brand-errBorder rounded-lg mb-4">
                <p className="font-mono text-[11px] text-brand-err uppercase tracking-wide2 mb-2 m-0">
                  Error · {error.code}
                </p>
                <p className="font-sans text-[13px] text-brand-errDark m-0">
                  {error.message || 'Failed to load AI model'}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    void reload()
                  }}
                  className="px-6 py-3 bg-brand-blue text-white border-0 rounded-md font-mono text-xs font-medium cursor-pointer uppercase tracking-wide2 hover:opacity-90"
                >
                  Reload Model
                </button>
                {activeModel && activeModel.sourceKind !== 'registry' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await resetCache(activeModel.id)
                      if (r.success) {
                        alert('Cache deleted. Please close and reopen the app to complete the process.')
                        void reload()
                      } else {
                        setError({
                          code: 'RESET_CACHE_FAILED',
                          message: r.error ?? 'Failed to clear cache',
                          retryable: true,
                        })
                      }
                    }}
                    className="px-6 py-3 bg-white text-brand-blue border border-brand-blue rounded-md font-mono text-xs font-medium cursor-pointer uppercase tracking-wide2 hover:bg-brand-light"
                  >
                    Delete Cache
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="w-full h-[2px] bg-[#e8e8f0] relative mb-3.5">
                <div
                  className="absolute left-0 top-0 h-full bg-brand-blue transition-all duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-brand-muted tracking-wide">
                  {statusText}
                </span>
                <span className="font-mono text-[13px] font-bold text-brand-blue">
                  {percent}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
