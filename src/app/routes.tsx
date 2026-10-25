import { Navigate, type RouteObject } from 'react-router'
import { DesignSystemScreen } from '../features/design-system/DesignSystemScreen'
import { AccountFormScreen } from '../features/accounts/AccountFormScreen'
import { AccountsScreen } from '../features/accounts/AccountsScreen'
import { CategoriesScreen } from '../features/categories/CategoriesScreen'
import { CategoryFormScreen } from '../features/categories/CategoryFormScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { BudgetsScreen } from '../features/placeholders'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TransactionDetailScreen } from '../features/transactions/TransactionDetailScreen'
import { TransactionFormScreen } from '../features/transactions/TransactionFormScreen'
import { TransactionsScreen } from '../features/transactions/TransactionsScreen'
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
      { path: 'transactions/new', element: <TransactionFormScreen /> },
      { path: 'transactions/:id', element: <TransactionDetailScreen /> },
      { path: 'transactions/:id/edit', element: <TransactionFormScreen /> },
      { path: 'budgets', element: <BudgetsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'settings/accounts', element: <AccountsScreen /> },
      { path: 'settings/accounts/new', element: <AccountFormScreen /> },
      { path: 'settings/accounts/:id', element: <AccountFormScreen /> },
      { path: 'settings/categories', element: <CategoriesScreen /> },
      { path: 'settings/categories/new', element: <CategoryFormScreen /> },
      { path: 'settings/categories/:id', element: <CategoryFormScreen /> },
      { path: 'design', element: <DesignSystemScreen /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
