import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { Card } from '../../components/Card'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import { listDebtPayments, listDebts } from '../../data/debtsRepo'
import { formatDate } from '../../domain/dates'
import { debtStatus, type Debt, type DebtDirection, type DebtStatus } from '../../domain/debts'
import { CURRENCIES, currencyLabels } from '../../domain/money'

const directionOptions: { value: DebtDirection; label: string }[] = [
  { value: 'owed_to_me', label: 'لي عند الآخرين' },
  { value: 'owed_by_me', label: 'عليّ للآخرين' },
]

function DebtRow({ debt, status }: { debt: Debt; status: DebtStatus }) {
  return (
    <Link to={`/debts/${debt.id}`} className="list-item">
      <span className="list-item__main">
        <span className="list-item__title">{debt.counterparty}</span>
        <span className="list-item__meta">
          {status.settled ? (
            <>مسدَّد بالكامل · {formatDate(debt.date)}</>
          ) : (
            <>
              {status.paidMinor > 0 ? (
                <>
                  سُدّد <Money minor={status.paidMinor} currency={debt.currency} /> من{' '}
                  <Money minor={debt.amountMinor} currency={debt.currency} />
                </>
              ) : (
                <>لم يُسدَّد شيء بعد</>
              )}
              {debt.dueDate && <> · السداد {formatDate(debt.dueDate)}</>}
            </>
          )}
        </span>
        {status.overdue && <span className="tag tag--danger">فات موعد السداد</span>}
      </span>
      {status.settled ? (
        <span className="tag tag--success">مسدَّد</span>
      ) : (
        <Money minor={status.remainingMinor} currency={debt.currency} className="list-item__amount" />
      )}
    </Link>
  )
}

export function DebtsScreen() {
  const flash = useFlash()
  const debts = useLiveQuery(listDebts)
  const payments = useLiveQuery(listDebtPayments)
  const [params, setParams] = useSearchParams()
  const direction: DebtDirection = params.get('dir') === 'owed_by_me' ? 'owed_by_me' : 'owed_to_me'

  if (!debts || !payments) return null

  const withStatus = debts
    .filter((d) => d.direction === direction)
    .map((debt) => ({ debt, status: debtStatus(debt, payments) }))
  // غير المسدَّدة: المتأخرة أولاً، ثم الأقرب موعداً، ثم الأحدث.
  const open = withStatus
    .filter((x) => !x.status.settled)
    .sort(
      (a, b) =>
        Number(b.status.overdue) - Number(a.status.overdue) ||
        (a.debt.dueDate ?? '9999').localeCompare(b.debt.dueDate ?? '9999') ||
        b.debt.date.localeCompare(a.debt.date),
    )
  const settled = withStatus.filter((x) => x.status.settled).sort((a, b) => b.debt.date.localeCompare(a.debt.date))
  const totals = CURRENCIES.map((currency) => ({
    currency,
    minor: open.filter((x) => x.debt.currency === currency).reduce((sum, x) => sum + x.status.remainingMinor, 0),
  })).filter((t) => t.minor > 0)

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="page-title">الديون</h1>
        <Link to={`/debts/new?dir=${direction}`} className="btn btn--primary btn--md">
          <Icon name="plus" size={20} />
          إضافة دين
        </Link>
      </div>
      {flash && <Alert tone="success">{flash}</Alert>}

      <ChoiceGroup legend="النوع" options={directionOptions} value={direction} onChange={(v) => setParams({ dir: v }, { replace: true })} />

      <p className="muted small">سجل للمتابعة فقط: الديون ودفعاتها لا تغيّر أرصدة حساباتك.</p>

      {totals.length > 0 && (
        <div className="totals">
          {totals.map((t) => (
            <Card key={t.currency} className="total">
              <p className="total__label">
                {direction === 'owed_to_me' ? 'المتبقي لك' : 'المتبقي عليك'} بال{currencyLabels[t.currency]}
              </p>
              <Money minor={t.minor} currency={t.currency} className="total__value" />
            </Card>
          ))}
        </div>
      )}

      {withStatus.length === 0 ? (
        <EmptyState
          title={direction === 'owed_to_me' ? 'لا ديون لك عند أحد' : 'لا ديون عليك'}
          description="سجّل الدين واسم الشخص والمبلغ، ثم سجّل الدفعات عند السداد لتعرف المتبقي."
        />
      ) : (
        <>
          {open.length > 0 ? (
            <ul className="list" aria-label="ديون غير مسدَّدة">
              {open.map((x) => (
                <li key={x.debt.id}>
                  <DebtRow {...x} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">كل الديون في هذا القسم مسدَّدة.</p>
          )}
          {settled.length > 0 && (
            <section className="stack stack--tight">
              <h2 className="section-title section-title--flush">مسدَّدة</h2>
              <ul className="list" aria-label="ديون مسدَّدة">
                {settled.map((x) => (
                  <li key={x.debt.id}>
                    <DebtRow {...x} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
