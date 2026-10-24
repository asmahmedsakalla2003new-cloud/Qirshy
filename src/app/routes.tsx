import { Navigate, type RouteObject } from 'react-router'
import { DesignSystemScreen } from '../features/design-system/DesignSystemScreen'
import { BudgetsScreen, HomeScreen, SettingsScreen, TransactionsScreen } from '../features/placeholders'
import { AppLayout } from './AppLayout'
import { RequireOnboarding, WelcomeRoute } from './guards'

export const routes: RouteObject[] = [
  { path: '/welcome', element: <WelcomeRoute /> },
  {
    element: (
      <RequireOnboarding>
        <AppLayout />
      </RequireOnboarding>
    ),
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'transactions', element: <TransactionsScreen /> },
      { path: 'budgets', element: <BudgetsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'design', element: <DesignSystemScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
