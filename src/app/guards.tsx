import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { hasCompletedOnboarding } from '../core/preferences'
import { WelcomeScreen } from '../features/welcome/WelcomeScreen'

/** يحوّل المستخدم الجديد إلى الشاشة الترحيبية قبل أي شاشة أخرى. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  return hasCompletedOnboarding() ? children : <Navigate to="/welcome" replace />
}

/** الشاشة الترحيبية تظهر مرة واحدة فقط. */
export function WelcomeRoute() {
  return hasCompletedOnboarding() ? <Navigate to="/" replace /> : <WelcomeScreen />
}
