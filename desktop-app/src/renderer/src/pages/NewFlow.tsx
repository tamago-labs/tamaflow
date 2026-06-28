// `/flows/new` route — the canvas builder IS the page. The NewFlow
// placeholder from earlier passes through to <FlowBuilder>.
//
// Phase 1 lives entirely in component state (no persistence); Phase 2
// will add the FlowContext-backed load/save/load-on-mount lifecycle.

import FlowBuilder from '../flow/FlowBuilder'

export default FlowBuilder