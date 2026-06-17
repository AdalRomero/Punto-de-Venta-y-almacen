import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/css/index.css'
import './app/css/login.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
