import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { Card } from '../../components/Card'
import { CurrencySummaryCard } from '../../components/CurrencySummaryCard'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import { listAccounts } from '../../data/accountsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { accountBalance } from '../../domain/accounts'
import { categoryBreakdown } from '../../domain/categories'
import { CURRENCIES, currencyLabels } from '../../domain/money'
import { currentMonth, formatMonth, monthRange, shiftMonth } from '../../domain/months'
import { filterTransactions, sortTransactions, summarize } from '../../domain/transactions'
import { TransactionRow } from '../transactions/TransactionRow'
import { CategoryBars } from './CategoryBars'

const RECENT_COUNT = 5

export function HomeScreen() {
  const transactions = useLiveQuery(listTransactions)
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  const [params, setParams] = useSearchParams()

  const thisMonth = currentMonth()
  const requested = params.get('month') ?? ''
  const month = /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth ? requested : thisMonth
  const { from, to } = monthRange(month)

  if (!transactions || !accounts || !categories) return null

  const names = Object.fromEntries([...accounts, ...categories].map((x) => [x.id, x.name]))

  if (transactions.length === 0) {
    return (
      <>
        <h1 className="page-title">الرئيسية</h1>
        <EmptyState
          title="ابدأ بتسجيل أول عملية"
          description="سجّل مصاريفك ودخلك، وسيظهر هنا ملخص الشهر وتوزيع المصاريف على الفئات."
          action={
            <div className="row-wrap row-wrap--center">
              <Link to="/transactions/new?type=expense" className="btn btn--primary btn--md">
                إضافة مصروف
              </Link>
              <Link to="/transactions/new?type=income" className="btn btn--secondary btn--md">
                إضافة دخل
              </Link>
            </div>
          }
        />
      </>
    )
  }

  const inMonth = filterTransactions(transactions, { from, to })
  const summary = summarize(inMonth)
  const recent = sortTransactions(transactions).slice(0, RECENT_COUNT)
  const balances = CURRENCIES.map((currency) => ({
    currency,
    accounts: accounts.filter((a) => a.currency === currency),
  }))
    .filter((b) => b.accounts.length > 0)
    .map((b) => ({ ...b, minor: b.accounts.reduce((sum, a) => sum + accountBalance(a, transactions), 0) }))

  const setMonth = (next: string) => setParams(next === thisMonth ? {} : { month: next }, { replace: true })
  const linkForCategory = (categoryId: string) =>
    `/transactions?type=expense&category=${categoryId}&from=${from}&to=${to}`

  return (
    <div className="stack">
      <h1 className="page-title page-title--flush">الرئيسية</h1>

      <div className="quick-actions">
        <Link to="/transactions/new?type=expense" className="btn btn--primary btn--md">
          <Icon name="plus" size={20} />
          مصروف
        </Link>
        <Link to="/transactions/new?type=income" className="btn btn--secondary btn--md">
          <Icon name="plus" size={20} />
          دخل
        </Link>
      </div>

      <section className="stack stack--tight" aria-labelledby="balances-title">
        <h2 id="balances-title" className="section-title">
          مجموع الأرصدة
        </h2>
        <div className="totals">
          {balances.map((b) => (
            <Link key={b.currency} to="/settings/accounts" className="card total total--link">
              <p className="total__label">بال{currencyLabels[b.currency]}</p>
              <Money minor={b.minor} currency={b.currency} className="total__value" />
            </Link>
          ))}
        </div>
      </section>

      <section className="stack stack--tight" aria-labelledby="month-title">
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => setMonth(shiftMonth(month, -1))}>
            <Icon name="chevronRight" size={20} />
          </button>
          <h2 id="month-title" className="month-nav__title">
            {formatMonth(month)}
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="الشهر التالي"
            disabled={month >= thisMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <Icon name="chevron" size={20} />
          </button>
        </div>

        {summary.length === 0 ? (
          <Card>
            <p className="muted">لا توجد عمليات في {formatMonth(month)}.</p>
          </Card>
        ) : (
          <div className="totals">
            {summary.map((s) => (
              <CurrencySummaryCard key={s.currency} summary={s} />
            ))}
          </div>
        )}
      </section>

      {summary.map((s) => {
        const shares = categoryBreakdown(inMonth, categories, s.currency)
        if (shares.length === 0) return null
        const title = `المصاريف حسب الفئة بال${currencyLabels[s.currency]}`
        return (
          <Card key={s.currency}>
            <h2 className="section-title">{title}</h2>
            <CategoryBars shares={shares} currency={s.currency} linkFor={linkForCategory} label={title} />
          </Card>
        )
      })}

      <section className="stack stack--tight" aria-labelledby="recent-title">
        <div className="page-header">
          <h2 id="recent-title" className="section-title section-title--flush">
            أحدث العمليات
          </h2>
          <Link to="/transactions" className="small">
            عرض الكل
          </Link>
        </div>
        <ul className="list">
          {recent.map((t) => (
            <li key={t.id}>
              <TransactionRow
                transaction={t}
                accountName={names[t.accountId] ?? '—'}
                categoryName={t.categoryId ? names[t.categoryId] : undefined}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
