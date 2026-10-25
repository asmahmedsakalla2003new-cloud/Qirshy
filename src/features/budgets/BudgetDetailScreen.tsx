import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { MonthNav } from '../../components/MonthNav'
import { TextField } from '../../components/TextField'
import { deleteBudget, getBudget, resetBudgetMonth, setBudgetAmount } from '../../data/budgetsRepo'
import { getCategory } from '../../data/categoriesRepo'
import { listTransactions } from '../../data/transactionsRepo'
import { amountFor, budgetStatus, type AmountChangeMode, type Budget } from '../../domain/budgets'
import { parseAmount, toInputValue } from '../../domain/money'
import { currentMonth, formatMonth } from '../../domain/months'
import { BudgetMeter } from './BudgetMeter'
import { budgetLabel } from './budgetLabels'

const modeOptions: { value: AmountChangeMode; label: string }[] = [
  { value: 'month', label: 'هذا الشهر فقط' },
  { value: 'onward', label: 'هذا الشهر والأشهر القادمة' },
]

export function BudgetDetailScreen() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const requested = params.get('month') ?? ''
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : currentMonth()

  const data = useLiveQuery(async () => {
    const budget = await getBudget(id)
    if (!budget) return null
    const category = budget.categoryId ? await getCategory(budget.categoryId) : undefined
    return { budget, categoryName: category?.name, transactions: await listTransactions() }
  }, [id])

  if (data === undefined) return null
  if (data === null) {
    return (
      <EmptyState
        title="الميزانية غير موجودة"
        description="ربما حُذفت هذه الميزانية."
        action={<Link to="/budgets">العودة إلى الميزانيات</Link>}
      />
    )
  }

  return (
    <BudgetDetail
      // يُعاد تهيئة النموذج عند الانتقال إلى شهر آخر.
      key={month}
      budget={data.budget}
      label={budgetLabel(data.budget, data.categoryName)}
      transactions={data.transactions}
      month={month}
      onMonthChange={(m) => setParams({ month: m }, { replace: true })}
    />
  )
}

type Props = {
  budget: Budget
  label: string
  transactions: Awaited<ReturnType<typeof listTransactions>>
  month: string
  onMonthChange: (month: string) => void
}

function BudgetDetail({ budget, label, transactions, month, onMonthChange }: Props) {
  const navigate = useNavigate()
  const current = amountFor(budget, month)
  const status = budgetStatus(budget, month, transactions)
  const hasOverride = month in budget.overrides
  const usual = amountFor({ schedule: budget.schedule, overrides: {} }, currentMonth())
  const [amount, setAmount] = useState(current !== null ? toInputValue(current) : '')
  const [mode, setMode] = useState<AmountChangeMode>('month')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const parsed = parseAmount(amount)
    if (!parsed.ok) return setError(parsed.error)
    try {
      await setBudgetAmount(budget.id, month, parsed.minor, mode)
      setNotice(mode === 'month' ? `حُفظ مبلغ ${formatMonth(month)} فقط.` : `حُفظ المبلغ من ${formatMonth(month)} فصاعداً.`)
    } catch {
      setError('تعذّر حفظ المبلغ. حاول مرة أخرى.')
    }
  }

  async function resetMonth() {
    await resetBudgetMonth(budget.id, month)
    // المبلغ المعتاد لهذا الشهر بعد إلغاء التخصيص.
    const restored = amountFor({ schedule: budget.schedule, overrides: {} }, month)
    setAmount(restored !== null ? toInputValue(restored) : '')
    setNotice(`عاد ${formatMonth(month)} إلى المبلغ المعتاد.`)
  }

  async function remove() {
    setConfirmingDelete(false)
    await deleteBudget(budget.id)
    navigate('/budgets', { replace: true, state: { flash: 'حُذفت الميزانية.' } })
  }

  return (
    <div className="stack">
      <p>
        <Link to={`/budgets?month=${month}`}>→ الميزانيات</Link>
      </p>
      <h1 className="page-title">{label}</h1>

      <MonthNav month={month} onChange={onMonthChange} />

      {notice && <Alert tone="success">{notice}</Alert>}

      <Card>
        {status ? (
          <BudgetMeter status={status} currency={budget.currency} />
        ) : (
          <p className="muted">لم تكن هذه الميزانية قد بدأت في {formatMonth(month)}.</p>
        )}
      </Card>

      <form className="stack" onSubmit={save} noValidate>
        <h2 className="section-title section-title--flush">مبلغ {formatMonth(month)}</h2>
        {hasOverride && (
          <Alert tone="info">
            لهذا الشهر مبلغ خاص. المبلغ المعتاد للأشهر الأخرى لم يتغيّر.{' '}
            <button type="button" className="link-btn" onClick={resetMonth}>
              العودة إلى المبلغ المعتاد
            </button>
          </Alert>
        )}
        <TextField
          label="المبلغ"
          className="field--amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          autoComplete="off"
          value={amount}
          error={error}
          onChange={(e) => {
            setAmount(e.target.value)
            setError(undefined)
            setNotice(undefined)
          }}
        />
        <ChoiceGroup legend="تطبيق التعديل على" options={modeOptions} value={mode} onChange={setMode} />
        <Button type="submit" size="lg">
          حفظ المبلغ
        </Button>
      </form>

      <p className="muted small">
        المبلغ المعتاد الآن: {usual !== null ? <Money minor={usual} currency={budget.currency} /> : '—'}. تغيير «هذا الشهر والأشهر القادمة» لا يغيّر الأشهر السابقة.
      </p>

      <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirmingDelete(true)}>
        حذف الميزانية
      </Button>
      <ConfirmDialog
        open={confirmingDelete}
        title={`حذف ${label}؟`}
        confirmLabel="حذف الميزانية"
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      >
        ستُحذف الميزانية من كل الأشهر. العمليات نفسها لا تتأثر.
      </ConfirmDialog>
    </div>
  )
}
