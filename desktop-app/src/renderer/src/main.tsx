import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AIProvider } from './context/AIContext'
import { CompanyProvider } from './context/CompanyContext'

// `WalletProvider` is mounted INSIDE `<App>` so it can read `appState`
// and gate the auto-fetch of holdings + pending transfers. The Canton
// SDK init + validator round-trips only need to happen once we're past
// the company / model gates — not during the boot splash or wizard.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AIProvider>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </AIProvider>
  </StrictMode>
)
