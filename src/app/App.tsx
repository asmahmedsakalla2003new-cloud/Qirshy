import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes'
import { SplashScreen } from './SplashScreen'

const router = createBrowserRouter(routes)

/** مدة ظهور شاشة البداية كحد أدنى، حتى لا تومض بسرعة. */
const SPLASH_MIN_MS = 700

export function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    // انتظار الخط العربي المضمَّن لتجنّب قفزة النص عند ظهوره.
    const fonts = document.fonts?.ready ?? Promise.resolve()
    let cancelled = false
    Promise.all([minDelay, fonts]).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ready ? <RouterProvider router={router} /> : <SplashScreen />
}
