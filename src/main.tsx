import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { consumeAuthFromUrl } from './auth'

// If the backend redirected back with auth params in the URL, store them and
// clean the address bar before React reads the auth state / parses the route.
consumeAuthFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
