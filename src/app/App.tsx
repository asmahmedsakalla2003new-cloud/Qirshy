import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { initDatabase } from '../data/init'
import { routes } from './routes'
import { SplashScreen } from './SplashScreen'
import { StartupError } from './StartupError'

const router = createBrowserRouter(routes)

/** مدة ظهور شاشة البداية كحد أدنى، حتى لا تومض بسرعة. */
const SPLASH_MIN_MS = 700

export function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    // انتظار الخط العربي المضمَّن لتجنّب قفزة النص عند ظهوره.
    const fonts = document.fonts?.ready ?? Promise.resolve()
    let cancelled = false
    Promise.all([minDelay, fonts, initDatabase()]).then(
      () => !cancelled && setStatus('ready'),
      (error: unknown) => {
        console.error('تعذّر فتح قاعدة البيانات', error)
        if (!cancelled) setStatus('error')
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'error') return <StartupError />
  return status === 'ready' ? <RouterProvider router={router} /> : <SplashScreen />
}
