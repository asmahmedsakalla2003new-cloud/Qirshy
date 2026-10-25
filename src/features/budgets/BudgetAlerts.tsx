import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { dismissBudgetAlert } from '../../data/budgetsRepo'
import { budgetStatus, shouldAlert, type Budget } from '../../domain/budgets'
import type { Transaction } from '../../domain/transactions'
import { alertMessage, budgetLabel } from './budgetLabels'

type Props = {
  budgets: Budget[]
  transactions: Transaction[]
  categoryNames: Map<string, string>
  month: string
}

/**
 * تنبيهات الميزانية للشهر: تظهر عند 80% وعند بلوغ الحد. «حسناً» يُخفي التنبيه
 * لهذا المستوى في هذا الشهر، فلا يتكرر؛ لكن تنبيه «الحد» يظهر لاحقاً حتى لو أُغلق «الاقتراب».
 */
export function BudgetAlerts({ budgets, transactions, categoryNames, month }: Props) {
  const alerts = budgets.flatMap((budget) => {
    const status = budgetStatus(budget, month, transactions)
    if (!status || status.level === 'ok' || !shouldAlert(budget, month, status.level)) return []
    return [{ budget, level: status.level }]
  })
  if (alerts.length === 0) return null

  return (
    <section className="stack stack--tight" aria-label="تنبيهات الميزانية">
      {alerts.map(({ budget, level }) => (
        <Alert key={budget.id} tone={level === 'over' ? 'danger' : 'warning'} title="تنبيه الميزانية">
          <p>{alertMessage(level, budgetLabel(budget, categoryNames.get(budget.categoryId ?? '')))}</p>
          <div className="alert__actions">
            <Link to={`/budgets/${budget.id}?month=${month}`} className="btn btn--secondary btn--md">
              عرض الميزانية
            </Link>
            <Button variant="ghost" onClick={() => dismissBudgetAlert(budget.id, month, level)}>
              حسناً
            </Button>
          </div>
        </Alert>
      ))}
    </section>
  )
}
