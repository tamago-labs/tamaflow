import { CanvasPage } from '../CanvasPage'
import { useFlowView } from '../../context/FlowViewContext'

export function FlowBuilderPage() {
  const { setView } = useFlowView()
  return <CanvasPage onViewChange={setView} />
}

export default FlowBuilderPage
