import { useState } from 'react'
import { CanvasPage } from '../CanvasPage'

export function FlowBuilderPage() {
  const [view, setView] = useState<'list' | 'canvas'>('list')
  return (
    <div className={view === 'canvas' ? '-mt-[56px] -ml-8 -mr-8 -mb-8' : ''}>
      <CanvasPage onViewChange={setView} />
    </div>
  )
}

export default FlowBuilderPage
