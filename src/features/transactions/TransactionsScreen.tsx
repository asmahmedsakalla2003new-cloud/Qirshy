import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { CurrencySummaryCard } from '../../components/CurrencySummaryCard'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { SelectField } from '../../components/SelectField'
import { TextField } from '../../components/TextField'
import { listAccounts } from '../../data/accountsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { formatDayHeading, todayISO } from '../../domain/dates'
import { currencyLabels } from '../../domain/money'
import {
  filterTransactions,
  NO_CATEGORY,
  groupByDate,
  sortTransactions,
  summarize,
  type TransactionFilter,
  type TransactionType,
} from '../../domain/transactions'
import { TransactionRow } from './TransactionRow'

const typeOptions = [
  { value: '', label: 'الكل' },
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'دخل' },
] as const

type TypeOption = (typeof typeOptions)[number]['value']

const PARAM_KEYS = { query: 'q', type: 'type', accountId: 'account', categoryId: 'category', from: 'from', to: 'to' } as const

/**
 * التصفية في حالة محلية تستجيب فوراً للكتابة، وتُنسخ إلى الرابط بعدها
 * لتبقى عند الرجوع من تفاصيل العملية. (ربط الحقول بالرابط مباشرةً يُسقط أحرفاً
 * عند الكتابة السريعة لأن تحديث الرابط غير متزامن.)
 */
function useUrlFilter() {
  const [params, setParams] = useSearchParams()
  const [filter, setFilterState] = useState<TransactionFilter>(() => ({
    query: params.get('q') ?? '',
    type: (params.get('type') as TransactionType | null) ?? undefined,
    accountId: params.get('account') ?? undefined,
    categoryId: params.get('category') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  }))

  useEffect(() => {
    const next = new URLSearchParams()
    for (const [key, param] of Object.entries(PARAM_KEYS)) {
      const value = filter[key as keyof TransactionFilter]
      if (value) next.set(param, value)
    }
    setParams(next, { replace: true })
  }, [filter, setParams])

  const setFilter = (patch: Partial<TransactionFilter>) => setFilterState((prev) => ({ ...prev, ...patch }))
  const clearFilter = () => setFilterState({ query: '' })
  return [filter, setFilter, clearFilter] as const
}

export function TransactionsScreen() {
  const flash = useFlash()
  const warning = useFlash('warning')
  const transactions = useLiveQuery(listTransactions)
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  const [filter, setFilter, clearFilter] = useUrlFilter()
  const filtersActive = Object.values(filter).some(Boolean)
  // لوحة التصفية تُفتح تلقائياً إذا وُجدت تصفية عند فتح الشاشة، ثم يتحكم بها المستخدم وحده.
  const [filtersOpen, setFiltersOpen] = useState(() => !!(filter.type || filter.accountId || filter.categoryId || filter.from || filter.to))

  // أسماء الحسابات والفئات حسب المعرّف، للعرض وللبحث.
  const names = useMemo(
    () => Object.fromEntries([...(accounts ?? []), ...(categories ?? [])].map((x) => [x.id, x.name])),
    [accounts, categories],
  )

  if (!transactions || !accounts || !categories) return null

  const visible = sortTransactions(filterTransactions(transactions, filter, names))
  // فئات النوع المصفّى (أو الكل)، مع المؤرشفة لأنها قد تكون في عمليات قديمة.
  const categoryOptions = categories.filter((c) => !filter.type || c.kind === filter.type)
  const summary = summarize(visible)

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="page-title">العمليات</h1>
        <Link to="/transactions/new" className="btn btn--primary btn--md">
          <Icon name="plus" size={20} />
          إضافة عملية
        </Link>
      </div>

      {flash && <Alert tone="success">{flash}</Alert>}
      {warning && (
        <Alert tone="warning" title="تنبيه الميزانية">
          {warning} <Link to="/budgets">عرض الميزانيات</Link>
        </Alert>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title="لا توجد عمليات بعد"
          description="سجّل أول مصروف أو دخل، وسيظهر هنا مع رصيد كل حساب."
          action={
            <Link to="/transactions/new" className="btn btn--primary btn--md">
              إضافة أول عملية
            </Link>
          }
        />
      ) : (
        <>
          <div className="stack stack--tight">
            <TextField
              label="بحث"
              type="search"
              placeholder="الوصف أو المبلغ أو الحساب"
              value={filter.query}
              onChange={(e) => setFilter({ query: e.target.value })}
            />

            <details className="filters" open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
              <summary>التصفية</summary>
              <div className="stack stack--tight">
                <ChoiceGroup<TypeOption>
                  legend="النوع"
                  options={typeOptions}
                  value={(filter.type ?? '') as TypeOption}
                  onChange={(v) => {
                    // فئة النوع الآخر لا تطابق شيئاً؛ تُلغى عند تغيير النوع.
                    const keep = !v || categories.find((c) => c.id === filter.categoryId)?.kind === v
                    setFilter({ type: v || undefined, ...(keep ? {} : { categoryId: undefined }) })
                  }}
                />
                <SelectField
                  label="الحساب"
                  value={filter.accountId ?? ''}
                  onChange={(e) => setFilter({ accountId: e.target.value || undefined })}
                  options={[
                    { value: '', label: 'كل الحسابات' },
                    ...accounts.map((a) => ({ value: a.id, label: `${a.name} (${currencyLabels[a.currency]})` })),
                  ]}
                />
                <SelectField
                  label="الفئة"
                  value={filter.categoryId ?? ''}
                  onChange={(e) => setFilter({ categoryId: e.target.value || undefined })}
                  options={[
                    { value: '', label: 'كل الفئات' },
                    ...categoryOptions.map((c) => ({
                      value: c.id,
                      label: `${c.name}${filter.type ? '' : c.kind === 'income' ? ' (دخل)' : ' (مصروف)'}`,
                    })),
                    { value: NO_CATEGORY, label: 'بلا فئة' },
                  ]}
                />
                <div className="row-2">
                  <TextField
                    label="من تاريخ"
                    type="date"
                    max={todayISO()}
                    value={filter.from ?? ''}
                    onChange={(e) => setFilter({ from: e.target.value || undefined })}
                  />
                  <TextField
                    label="إلى تاريخ"
                    type="date"
                    max={todayISO()}
                    value={filter.to ?? ''}
                    onChange={(e) => setFilter({ to: e.target.value || undefined })}
                  />
                </div>
              </div>
            </details>

            {filtersActive && (
              <Button variant="ghost" onClick={clearFilter}>
                مسح البحث والتصفية
              </Button>
            )}
          </div>

          {summary.length > 0 && (
            <section className="totals" aria-label="ملخص العمليات المعروضة">
              {summary.map((s) => (
                <CurrencySummaryCard key={s.currency} summary={s} />
              ))}
            </section>
          )}

          {visible.length === 0 ? (
            <EmptyState
              title="لا توجد نتائج"
              description="لا توجد عمليات تطابق البحث أو التصفية الحالية."
              action={
                <Button variant="secondary" onClick={clearFilter}>
                  مسح البحث والتصفية
                </Button>
              }
            />
          ) : (
            groupByDate(visible).map((group) => (
              <section key={group.date} className="day-group" aria-label={formatDayHeading(group.date)}>
                <h2 className="day-group__title">{formatDayHeading(group.date)}</h2>
                <ul className="list">
                  {group.items.map((t) => (
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
            ))
          )}
        </>
      )}
    </div>
  )
}
