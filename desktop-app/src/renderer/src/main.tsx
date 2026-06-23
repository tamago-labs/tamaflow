import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AIProvider } from './context/AIContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AIProvider>
      <App />
    </AIProvider>
  </StrictMode>
)
