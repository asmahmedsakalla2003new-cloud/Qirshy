import { Navigate, type RouteObject } from 'react-router'
import { DesignSystemScreen } from '../features/design-system/DesignSystemScreen'
import { AccountFormScreen } from '../features/accounts/AccountFormScreen'
import { AccountsScreen } from '../features/accounts/AccountsScreen'
import { BudgetsScreen, HomeScreen, TransactionsScreen } from '../features/placeholders'
import { SettingsScreen } from '../features/settings/SettingsScreen'
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
      { path: 'settings/accounts', element: <AccountsScreen /> },
      { path: 'settings/accounts/new', element: <AccountFormScreen /> },
      { path: 'settings/accounts/:id', element: <AccountFormScreen /> },
      { path: 'design', element: <DesignSystemScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
