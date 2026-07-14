import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

type FlowView = 'list' | 'canvas'

interface FlowViewContextValue {
  view: FlowView
  setView: (v: FlowView) => void
}

const FlowViewContext = createContext<FlowViewContextValue>({ view: 'list', setView: () => {} })

export function FlowViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<FlowView>('list')
  const value = useMemo(() => ({ view, setView }), [view])
  return (
    <FlowViewContext.Provider value={value}>
      {children}
    </FlowViewContext.Provider>
  )
}

export function useFlowView() {
  return useContext(FlowViewContext)
}
