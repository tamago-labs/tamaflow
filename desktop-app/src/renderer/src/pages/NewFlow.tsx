// `/flows/new` route — instant new-flow entry point.
//
// Lands here when the user clicks "Flow Builder" in the sidebar. We
// immediately create an empty flow via `FlowContext.save` and replace
// the URL with `/flows/:id` so <FlowDetail> mounts the canvas. A brief
// "Creating flow…" placeholder is shown during the IPC round-trip —
// usually a single frame on DevNet, but long enough on a slow disk
// that the user gets feedback rather than a blank white flash.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlows } from '../context/FlowContext'

const DEFAULT_NAME = 'Untitled flow'

export default function NewFlow() {
  const { save, error } = useFlows()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  // Guard against React StrictMode's double-invoke in dev — the second
  // pass would otherwise create a second empty flow before the first
  // navigation completed.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      try {
        const file = await save({
          name: DEFAULT_NAME,
          cards: [],
          connections: [],
        })
        navigate(`/flows/${file.flow.id}`, { replace: true })
      } catch (e) {
        console.error('[NewFlow] create failed:', e)
        setFailed(true)
      }
    })()
  }, [save, navigate])

  // Fail-open state — we couldn't create the flow. Show a brief error
  // and a manual retry rather than a blank page. The user can also hit
  // the sidebar to try again.
  if (failed) {
    return (
      <div className="font-sans text-sm text-brand-navy p-8">
        <p className="m-0 mb-2">Couldn't create a new flow.</p>
        {error && (
          <p role="alert" className="font-mono text-xs text-[#c83030] m-0">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="font-sans text-sm text-brand-muted p-8">
      Creating flow…
    </div>
  )
}