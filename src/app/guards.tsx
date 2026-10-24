import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { getSettings } from '../data/settingsRepo'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'

/** undefined أثناء القراءة (أجزاء من الثانية)، ثم true أو false. */
function useOnboarded(): boolean | undefined {
  return useLiveQuery(async () => !!(await getSettings())?.onboardedAt)
}

/** يحوّل المستخدم الجديد إلى الشاشة الترحيبية قبل أي شاشة أخرى. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return null
  return onboarded ? children : <Navigate to="/welcome" replace />
}

/** الشاشة الترحيبية تظهر مرة واحدة فقط. */
export function WelcomeRoute() {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return null
  return onboarded ? <Navigate to="/" replace /> : <WelcomeScreen />
}
