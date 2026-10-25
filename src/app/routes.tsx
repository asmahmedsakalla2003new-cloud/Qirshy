import { Navigate, type RouteObject } from 'react-router'
import { DesignSystemScreen } from '../features/design-system/DesignSystemScreen'
import { AccountFormScreen } from '../features/accounts/AccountFormScreen'
import { AccountsScreen } from '../features/accounts/AccountsScreen'
import { CategoriesScreen } from '../features/categories/CategoriesScreen'
import { CategoryFormScreen } from '../features/categories/CategoryFormScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TransactionDetailScreen } from '../features/transactions/TransactionDetailScreen'
import { TransactionFormScreen } from '../features/transactions/TransactionFormScreen'
import { TransactionsScreen } from '../features/transactions/TransactionsScreen'
import { BudgetDetailScreen } from '../features/budgets/BudgetDetailScreen'
import { BudgetFormScreen } from '../features/budgets/BudgetFormScreen'
import { BudgetsScreen } from '../features/budgets/BudgetsScreen'
import { DebtDetailScreen } from '../features/debts/DebtDetailScreen'
import { DebtFormScreen } from '../features/debts/DebtFormScreen'
import { DebtsScreen } from '../features/debts/DebtsScreen'
import { TransferDetailScreen } from '../features/transfers/TransferDetailScreen'
import { TransferFormScreen } from '../features/transfers/TransferFormScreen'
import { ReportsScreen } from '../features/reports/ReportsScreen'
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
      { path: 'transfers/new', element: <TransferFormScreen /> },
      { path: 'transfers/:id', element: <TransferDetailScreen /> },
      { path: 'transfers/:id/edit', element: <TransferFormScreen /> },
      { path: 'debts', element: <DebtsScreen /> },
      { path: 'debts/new', element: <DebtFormScreen /> },
      { path: 'debts/:id', element: <DebtDetailScreen /> },
      { path: 'debts/:id/edit', element: <DebtFormScreen /> },
      { path: 'reports', element: <ReportsScreen /> },
      { path: 'budgets', element: <BudgetsScreen /> },
      { path: 'budgets/new', element: <BudgetFormScreen /> },
      { path: 'budgets/:id', element: <BudgetDetailScreen /> },
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
