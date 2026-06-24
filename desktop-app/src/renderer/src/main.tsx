import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AIProvider } from './context/AIContext'
import { WalletProvider } from './context/WalletContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AIProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </AIProvider>
  </StrictMode>
)
