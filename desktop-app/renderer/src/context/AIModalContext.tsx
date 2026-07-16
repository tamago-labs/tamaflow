import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface AIModalContextValue {
  aiModalOpen: boolean
  openAIModel: () => void
  closeAIModel: () => void
}

const AIModalContext = createContext<AIModalContextValue | null>(null)

export function AIModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openAIModel = useCallback(() => setOpen(true), [])
  const closeAIModel = useCallback(() => setOpen(false), [])

  return (
    <AIModalContext.Provider value={{ aiModalOpen: open, openAIModel, closeAIModel }}>
      {children}
    </AIModalContext.Provider>
  )
}

export function useAIModal(): AIModalContextValue {
  const ctx = useContext(AIModalContext)
  if (!ctx) throw new Error('useAIModal must be used inside <AIModalProvider>')
  return ctx
}
