// `/flows/new` route — Flow Builder sidebar entry point.
//
// Lands here when the user clicks "Flow Builder" in the sidebar. We
// look up the latest existing flow (most-recent `updatedAt`) and
// navigate straight into it — clicking Flow Builder should always
// land the user on a real canvas, never spin up a fresh draft that
// they then have to clean up. We only fall back to creating a new
// flow when the user genuinely has none yet (first-time use).
//
// A short "Opening flow builder…" placeholder is shown while we
// wait for `useFlows().loadStatus` to settle so the user has
// feedback rather than a blank white flash on a slow disk.

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFlows } from '../context/FlowContext'

const DEFAULT_NAME = 'Untitled flow'

/**
 * `/flows/new` can be reached two ways:
 *
 * 1. **Sidebar "Flow Builder" entry** (NavLink, no state) — land on
 *    the most-recently-saved flow. The user's "give me my canvas back"
 *    intent doesn't justify spinning up a fresh draft they'll then
 *    have to clean up.
 *
 * 2. **Active Flows "New Flow" button** (`navigate(..., { state: { create: true } })`)
 *    — ALWAYS create a new draft. The user is explicitly asking for a
 *    blank canvas here, so reusing the latest flow would defeat the
 *    affordance.
 *
 * The boolean on `useLocation().state.create` drives the branch.
 */

export default function NewFlow() {
  const { flows, loadStatus, save, error } = useFlows()
  const navigate = useNavigate()
  const location = useLocation()
  // `state` is `unknown` from React Router — narrow to a typed shape
  // so we don't have to `any` it.
  const forceCreate =
    (location.state as { create?: boolean } | null)?.create === true
  const [failed, setFailed] = useState(false)
  // Guard against React StrictMode's double-invoke in dev — the second
  // pass would otherwise navigate twice (or create twice) before the
  // first navigation completed.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    // Wait for the flow list to settle before deciding. `loading` is
    // the initial in-flight fetch; `absent` means we've finished and
    // the list is empty; `present` means we've finished and there's
    // at least one flow. We act on both `present` and `absent` — only
    // `loading` (and `error`) are reason to keep waiting / surface a
    // banner.
    if (loadStatus === 'loading' || loadStatus === 'error') return
    started.current = true

    // Active Flows "New Flow" button — skip the latest-flow fallback
    // and always create a fresh draft. We still need to wait for the
    // load above so the create's optimistic push-channel update lands
    // on a settled list (and we don't fight an in-flight list refresh).
    if (forceCreate) {
      void (async () => {
        try {
          const file = await save({
            name: DEFAULT_NAME,
            status: 'draft',
            cards: [],
            connections: [],
          })
          navigate(`/flows/${file.flow.id}`, { replace: true })
        } catch (e) {
          console.error('[NewFlow] create failed:', e)
          setFailed(true)
        }
      })()
      return
    }

    // Sidebar "Flow Builder" entry — open the most-recent flow. Sort
    // by `updatedAt` descending and pick the head — same "latest
    // saved" rule the ActiveFlows list uses to order its rows.
    if (flows.length > 0) {
      const latest = [...flows].sort((a, b) => {
        const ta = new Date(a.updatedAt).getTime()
        const tb = new Date(b.updatedAt).getTime()
        return tb - ta
      })[0]
      navigate(`/flows/${latest.id}`, { replace: true })
      return
    }

    // No flows at all — first-time use. Create a fresh draft and
    // navigate to it.
    void (async () => {
      try {
        const file = await save({
          name: DEFAULT_NAME,
          status: 'draft',
          cards: [],
          connections: [],
        })
        navigate(`/flows/${file.flow.id}`, { replace: true })
      } catch (e) {
        console.error('[NewFlow] create failed:', e)
        setFailed(true)
      }
    })()
  }, [loadStatus, flows, save, navigate, forceCreate])

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
    <div className="flex flex-col items-center justify-center gap-4 min-h-[100vh] w-full">
      <div className="w-12 h-12 rounded-full border-[3px] border-brand-light border-t-brand-blue animate-spin" />
      <div className="text-center">
        <p className="font-mono text-[11px] tracking-wider2 uppercase text-brand-navy m-0 font-semibold">
          Opening flow builder
        </p>
        <p className="font-sans text-xs text-brand-muted m-0 mt-1">
          Loading your latest flow…
        </p>
      </div>
    </div>
  )
}