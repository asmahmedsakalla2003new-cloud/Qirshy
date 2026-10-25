import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { MonthNav } from '../../components/MonthNav'
import { listBudgets } from '../../data/budgetsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { budgetStatus } from '../../domain/budgets'
import { CURRENCIES, currencyLabels } from '../../domain/money'
import { currentMonth } from '../../domain/months'
import { BudgetMeter } from './BudgetMeter'

export function BudgetsScreen() {
  const flash = useFlash()
  const budgets = useLiveQuery(listBudgets)
  const transactions = useLiveQuery(listTransactions)
  const categories = useLiveQuery(listCategories)
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonth()
  const requested = params.get('month') ?? ''
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : thisMonth

  if (!budgets || !transactions || !categories) return null
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const setMonth = (next: string) => setParams(next === thisMonth ? {} : { month: next }, { replace: true })

  const header = (
    <div className="page-header">
      <h1 className="page-title">الميزانيات</h1>
      <Link to="/budgets/new" className="btn btn--primary btn--md">
        <Icon name="plus" size={20} />
        إضافة ميزانية
      </Link>
    </div>
  )

  if (budgets.length === 0) {
    return (
      <div className="stack">
        {header}
        {flash && <Alert tone="success">{flash}</Alert>}
        <EmptyState
          title="لم تُحدَّد ميزانية بعد"
          description="حدّد ميزانية شهرية عامة أو لفئة معيّنة، وسينبّهك قِرْش عند الوصول إلى 80% منها وعند بلوغ حدها."
          action={
            <Link to="/budgets/new" className="btn btn--primary btn--md">
              إضافة أول ميزانية
            </Link>
          }
        />
      </div>
    )
  }

  // لكل عملة قسم: العامة أولاً، ثم الفئات من الأعلى استهلاكاً.
  const sections = CURRENCIES.map((currency) => ({
    currency,
    items: budgets
      .filter((b) => b.currency === currency)
      .map((budget) => ({ budget, status: budgetStatus(budget, month, transactions) }))
      .filter((x) => x.status !== null)
      .sort((a, b) =>
        a.budget.scope !== b.budget.scope
          ? a.budget.scope === 'overall'
            ? -1
            : 1
          : (b.status?.percent ?? 0) - (a.status?.percent ?? 0),
      ),
  })).filter((s) => s.items.length > 0)

  return (
    <div className="stack">
      {header}
      {flash && <Alert tone="success">{flash}</Alert>}
      <MonthNav month={month} onChange={setMonth} />

      {sections.length === 0 && <p className="muted">لا توجد ميزانيات في هذا الشهر؛ الميزانيات تبدأ من شهر إنشائها.</p>}

      {sections.map((section) => (
        <section key={section.currency} className="stack stack--tight" aria-label={`ميزانيات ${currencyLabels[section.currency]}`}>
          <h2 className="section-title section-title--flush">بال{currencyLabels[section.currency]}</h2>
          <ul className="budget-list">
            {section.items.map(({ budget, status }) => (
              <li key={budget.id}>
                <Link to={`/budgets/${budget.id}?month=${month}`} className="card budget-card">
                  <span className="budget-card__title">
                    {budget.scope === 'overall' ? 'الميزانية العامة' : (names.get(budget.categoryId ?? '') ?? 'فئة محذوفة')}
                    {month in budget.overrides && <span className="tag">مبلغ خاص بهذا الشهر</span>}
                  </span>
                  {status && <BudgetMeter status={status} currency={budget.currency} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="muted small">
        الميزانيات تتكرر كل شهر تلقائياً. لتغيير مبلغ شهر معيّن افتح الميزانية من ذلك الشهر.
      </p>
    </div>
  )
}
