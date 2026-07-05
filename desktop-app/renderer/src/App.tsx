// App — the top-level router. Two phases:
//
//   splash  → SplashPage (the Tamaflow boot screen). Stays mounted
//             until the room worker reports `ready` (for guests) or
//             until the host dismisses the invite code reveal.
//
//   app     → AppShell (sidebar + topbar + page routing). Default
//             page is 'employees' (the locked-in home surface).
//             Flow Builder is one click away in the Payroll Flow
//             category; the canvas + toolbar + right drawer move
//             into that page.

import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { SplashPage } from './components/SplashPage'
import { AppShell } from './components/AppShell'
import { EmployeeProvider } from './context/EmployeeContext'
import { useRoom, type RoomRole } from './hooks/useRoom'
import { useWorkerStatus } from './hooks/useWorkerStatus'

type Phase = 'splash' | 'app'

export function App() {
  const status = useWorkerStatus()
  const room = useRoom()
  const [phase, setPhase] = useState<Phase>('splash')
  const [hostDismissed, setHostDismissed] = useState(false)

  // Auto-transition once the room is writable. In a host scenario
  // the user may want to copy the invite code from the splash first,
  // so we expose a manual "Open workspace" affordance in SplashPage
  // via the `hostDismissed` flag instead of forcing a timer.
  useEffect(() => {
    if (phase !== 'splash') return
    if (status !== 'running') return
    if (room.status !== 'ready') return
    if (room.role === 'host' && !hostDismissed) return
    setPhase('app')
  }, [phase, status, room.status, room.role, hostDismissed])

  return (
    <EmployeeProvider>
      <AnimatePresence mode='wait'>
        {phase === 'splash' ? (
          <SplashPage
            role={room.role as RoomRole | null}
            invite={room.invite}
            writable={room.writable}
            me={room.me}
            error={room.error ?? (status === 'error' ? 'Updater worker exited unexpectedly.' : null)}
            onOpenCanvas={() => {
              setHostDismissed(true)
              setPhase('app')
            }}
            onJoinInvite={room.joinInvite}
            onRenameSelf={room.renameSelf}
          />
        ) : (
          <AppShell initialPage='employees' />
        )}
      </AnimatePresence>
    </EmployeeProvider>
  )
}
