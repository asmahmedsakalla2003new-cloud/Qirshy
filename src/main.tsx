import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/cairo/wght.css'
import './core/theme/tokens.css'
import './core/theme/base.css'
import './components/components.css'
import './app/app.css'
import { App } from './app/App'

// تسجيل الـ Service Worker ليعمل التطبيق دون إنترنت.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
