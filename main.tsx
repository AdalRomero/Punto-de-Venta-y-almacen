import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/css/index.css'
import './app/css/login.css'
import Login from './app/layout/auth/login'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Login />
  </StrictMode>,
)

