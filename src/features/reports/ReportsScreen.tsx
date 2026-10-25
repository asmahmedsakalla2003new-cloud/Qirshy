import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { useUrlState } from '../../app/useUrlState'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { CurrencySummaryCard } from '../../components/CurrencySummaryCard'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { ShareBars } from '../../components/ShareBars'
import { TextField } from '../../components/TextField'
import { downloadText } from '../../core/download'
import { listAccounts } from '../../data/accountsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { listTransfers } from '../../data/transfersRepo'
import { categoryBreakdown } from '../../domain/categories'
import { formatDate, isValidISODate, todayISO } from '../../domain/dates'
import { CURRENCIES, currencyLabels, type Currency } from '../../domain/money'
import { formatMonth } from '../../domain/months'
import { accountBreakdown, buildCsv, monthlyTotals, PERIODS, periodLabels, periodRange, type Period } from '../../domain/reports'
import { filterTransactions, summarize } from '../../domain/transactions'

const periodOptions = PERIODS.map((value) => ({ value, label: periodLabels[value] }))

export function ReportsScreen() {
  const transactions = useLiveQuery(listTransactions)
  const transfers = useLiveQuery(listTransfers)
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  const [query, setQuery] = useUrlState(['period', 'from', 'to', 'currency'] as const)
  const [exported, setExported] = useState<string>()

  const period: Period = (PERIODS as readonly string[]).includes(query.period) ? (query.period as Period) : 'month'
  const customFrom = query.from
  const customTo = query.to
  const { from, to } = periodRange(period, todayISO(), {
    from: isValidISODate(customFrom) ? customFrom : undefined,
    to: isValidISODate(customTo) ? customTo : undefined,
  })

  function update(patch: Parameters<typeof setQuery>[0]) {
    setExported(undefined)
    setQuery(patch)
  }

  if (!transactions || !transfers || !accounts || !categories) return null

  const inPeriod = filterTransactions(transactions, { from, to })
  const available = CURRENCIES.filter((c) => inPeriod.some((t) => t.currency === c))
  const requested = (query.currency || null) as Currency | null
  const currency: Currency = requested && available.includes(requested) ? requested : (available[0] ?? 'ILS')
  const summary = summarize(inPeriod).find((s) => s.currency === currency)
  const months = monthlyTotals(inPeriod, currency, from, to)
  const maxExpense = Math.max(...months.map((m) => m.expenseMinor), 0)
  const expenseByCategory = categoryBreakdown(inPeriod, categories, currency, 'expense')
  const incomeByCategory = categoryBreakdown(inPeriod, categories, currency, 'income')
  const expenseByAccount = accountBreakdown(inPeriod, accounts, currency, 'expense')
  const range = `from=${from}&to=${to}`

  function exportCsv() {
    const names = Object.fromEntries([...accounts!, ...categories!].map((x) => [x.id, x.name]))
    const csv = buildCsv(transactions!, transfers!, names, from, to)
    const filename = `qirsh-${from}_${to}.csv`
    downloadText(filename, csv, 'text/csv;charset=utf-8')
    setExported(filename)
  }

  return (
    <div className="stack">
      <p>
        <Link to="/">→ الرئيسية</Link>
      </p>
      <h1 className="page-title">التقارير</h1>

      <ChoiceGroup legend="الفترة" options={periodOptions} value={period} onChange={(v) => update({ period: v === 'month' ? undefined : v })} />
      {period === 'custom' && (
        <div className="row-2">
          <TextField label="من تاريخ" type="date" max={todayISO()} value={customFrom || from} onChange={(e) => update({ from: e.target.value })} />
          <TextField label="إلى تاريخ" type="date" value={customTo || to} onChange={(e) => update({ to: e.target.value })} />
        </div>
      )}
      <p className="muted small">
        من {formatDate(from)} إلى {formatDate(to)}. التحويلات بين الحسابات والديون لا تدخل في هذه التقارير.
      </p>

      {available.length > 1 && (
        <ChoiceGroup
          legend="العملة"
          options={available.map((value) => ({ value, label: currencyLabels[value] }))}
          value={currency}
          onChange={(v) => update({ currency: v })}
        />
      )}

      {!summary ? (
        <EmptyState title="لا توجد عمليات في هذه الفترة" description="اختر فترة أخرى، أو سجّل مصاريفك ودخلك لتظهر التقارير." />
      ) : (
        <>
          <CurrencySummaryCard summary={summary} />

          {months.length > 1 && (
            <Card>
              <h2 className="section-title section-title--flush">الدخل والمصروف حسب الشهر بال{currencyLabels[currency]}</h2>
              <p className="muted small month-rows__note">العمود تحت كل شهر يمثّل مصروفه مقارنةً بأعلى شهر.</p>
              <ul className="month-rows" aria-label="الدخل والمصروف حسب الشهر">
                {months.map((m) => (
                  <li key={m.month} className="month-row">
                    <span className="month-row__name">{formatMonth(m.month)}</span>
                    <dl className="month-row__values">
                      <div>
                        <dt>الدخل</dt>
                        <dd>
                          <Money minor={m.incomeMinor} currency={currency} />
                        </dd>
                      </div>
                      <div>
                        <dt>المصروف</dt>
                        <dd>
                          <Money minor={m.expenseMinor} currency={currency} />
                        </dd>
                      </div>
                      <div>
                        <dt>الصافي</dt>
                        <dd>
                          <Money minor={m.netMinor} currency={currency} signed />
                        </dd>
                      </div>
                    </dl>
                    {/* عمود المصروف نسبةً إلى أعلى شهر: لون واحد، والقيمة مكتوبة أعلاه. */}
                    <span className="bar-row__track" aria-hidden="true">
                      <span
                        className="bar-row__bar"
                        style={{ inlineSize: maxExpense ? `${(m.expenseMinor / maxExpense) * 100}%` : '0%' }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {expenseByCategory.length > 0 && (
            <Card>
              <h2 className="section-title">المصاريف حسب الفئة</h2>
              <ShareBars
                shares={expenseByCategory}
                currency={currency}
                label="المصاريف حسب الفئة"
                linkFor={(id) => `/transactions?type=expense&category=${id}&${range}`}
              />
            </Card>
          )}

          {incomeByCategory.length > 0 && (
            <Card>
              <h2 className="section-title">الدخل حسب الفئة</h2>
              <ShareBars
                shares={incomeByCategory}
                currency={currency}
                label="الدخل حسب الفئة"
                linkFor={(id) => `/transactions?type=income&category=${id}&${range}`}
              />
            </Card>
          )}

          {expenseByAccount.length > 0 && (
            <Card>
              <h2 className="section-title">المصاريف حسب الحساب</h2>
              <ShareBars
                shares={expenseByAccount}
                currency={currency}
                label="المصاريف حسب الحساب"
                linkFor={(id) => `/transactions?type=expense&account=${id}&${range}`}
              />
            </Card>
          )}
        </>
      )}

      <section className="stack stack--tight export-box" aria-labelledby="export-title">
        <h2 id="export-title" className="section-title section-title--flush">
          تصدير (اختياري)
        </h2>
        <p className="muted small">
          ملف CSV بكل العمليات والتحويلات في هذه الفترة وبالعملتين، يُفتح في Excel أو Google Sheets. للاحتفاظ بنسخة من
          سجلّك فقط، وليس نسخة احتياطية تُستعاد في التطبيق.
        </p>
        {exported && <Alert tone="success">نُزّل الملف {exported}.</Alert>}
        <Button variant="secondary" onClick={exportCsv}>
          تصدير ملف CSV
        </Button>
      </section>
    </div>
  )
}
