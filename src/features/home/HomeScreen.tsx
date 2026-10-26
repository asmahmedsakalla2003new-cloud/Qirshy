import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { CurrencySummaryCard } from '../../components/CurrencySummaryCard'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import { ShareBars } from '../../components/ShareBars'
import { MonthNav } from '../../components/MonthNav'
import { listAccounts } from '../../data/accountsRepo'
import { listBudgets } from '../../data/budgetsRepo'
import { listDebtPayments, listDebts } from '../../data/debtsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { getSettings, snoozeBackupReminder } from '../../data/settingsRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { listTransfers } from '../../data/transfersRepo'
import { accountBalance } from '../../domain/accounts'
import { shouldRemindBackup } from '../../domain/backup'
import { categoryBreakdown } from '../../domain/categories'
import { debtStatus } from '../../domain/debts'
import { CURRENCIES, currencyLabels } from '../../domain/money'
import { currentMonth, formatMonth, monthRange } from '../../domain/months'
import { filterTransactions, sortTransactions, summarize } from '../../domain/transactions'
import { BudgetAlerts } from '../budgets/BudgetAlerts'
import { TransactionRow } from '../transactions/TransactionRow'

const RECENT_COUNT = 5

export function HomeScreen() {
  const transactions = useLiveQuery(listTransactions)
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  const budgets = useLiveQuery(listBudgets)
  const transfers = useLiveQuery(listTransfers)
  const debts = useLiveQuery(listDebts)
  const debtPayments = useLiveQuery(listDebtPayments)
  const settings = useLiveQuery(getSettings)
  const [params, setParams] = useSearchParams()

  const thisMonth = currentMonth()
  const requested = params.get('month') ?? ''
  const month = /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth ? requested : thisMonth
  const { from, to } = monthRange(month)

  if (!transactions || !accounts || !categories || !budgets || !transfers || !debts || !debtPayments || !settings) return null

  const names = Object.fromEntries([...accounts, ...categories].map((x) => [x.id, x.name]))

  // الديون غير المسدَّدة: المتبقي لكل اتجاه وعملة.
  const openDebts = debts
    .map((debt) => ({ debt, status: debtStatus(debt, debtPayments) }))
    .filter((x) => !x.status.settled)
  const debtTotals = (['owed_to_me', 'owed_by_me'] as const).flatMap((direction) =>
    CURRENCIES.map((currency) => ({
      direction,
      currency,
      minor: openDebts
        .filter((x) => x.debt.direction === direction && x.debt.currency === currency)
        .reduce((sum, x) => sum + x.status.remainingMinor, 0),
    })).filter((t) => t.minor > 0),
  )

  const debtSummary = debtTotals.length > 0 && (
        <Link to="/debts" className="card debts-summary" aria-label="ملخص الديون">
          <span className="section-title section-title--flush">الديون غير المسدَّدة</span>
          {debtTotals.map((t) => (
            <span key={`${t.direction}-${t.currency}`} className="debts-summary__row">
              <span>{t.direction === 'owed_to_me' ? 'لك عند الآخرين' : 'عليك للآخرين'}</span>
              <Money minor={t.minor} currency={t.currency} />
            </span>
          ))}
        </Link>
  )

  if (transactions.length === 0 && transfers.length === 0) {
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
              <Link to="/transfers/new" className="btn btn--secondary btn--md">
                تحويل
              </Link>
            </div>
          }
        />
        {debtSummary}
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
    .map((b) => ({ ...b, minor: b.accounts.reduce((sum, a) => sum + accountBalance(a, transactions, transfers), 0) }))

  const setMonth = (next: string) => setParams(next === thisMonth ? {} : { month: next }, { replace: true })
  const linkForCategory = (categoryId: string) =>
    `/transactions?type=expense&category=${categoryId}&from=${from}&to=${to}`

  return (
    <div className="stack">
      <h1 className="page-title page-title--flush">الرئيسية</h1>

      {shouldRemindBackup(settings, transactions.length + transfers.length) && (
        <Alert tone="info" title="احفظ نسخة احتياطية">
          <p>
            {settings.lastBackupAt
              ? 'مرّ أكثر من شهر على آخر نسخة احتياطية.'
              : 'بياناتك محفوظة في هذا المتصفح فقط، ولم تُنشأ نسخة احتياطية بعد.'}
          </p>
          <div className="alert__actions">
            <Link to="/settings/backup" className="btn btn--secondary btn--md">
              إنشاء نسخة الآن
            </Link>
            <Button variant="ghost" onClick={() => snoozeBackupReminder()}>
              لاحقاً
            </Button>
          </div>
        </Alert>
      )}

      <BudgetAlerts
        budgets={budgets}
        transactions={transactions}
        categoryNames={new Map(categories.map((c) => [c.id, c.name]))}
        month={thisMonth}
      />

      <div className="quick-actions">
        <Link to="/transactions/new?type=expense" className="btn btn--primary btn--md">
          <Icon name="plus" size={20} />
          مصروف
        </Link>
        <Link to="/transactions/new?type=income" className="btn btn--secondary btn--md">
          <Icon name="plus" size={20} />
          دخل
        </Link>
        <Link to="/transfers/new" className="btn btn--secondary btn--md">
          <Icon name="swap" size={20} />
          تحويل
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
        <MonthNav month={month} onChange={setMonth} max={thisMonth} titleId="month-title" />
        <Link to="/reports" className="small reports-link">
          التقارير المفصّلة
        </Link>

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
            <ShareBars shares={shares} currency={s.currency} linkFor={linkForCategory} label={title} />
          </Card>
        )
      })}

      {debtSummary}

      {recent.length > 0 && (
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
      )}
    </div>
  )
}
