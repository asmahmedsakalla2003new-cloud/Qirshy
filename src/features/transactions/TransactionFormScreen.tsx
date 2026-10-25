import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import { listAccounts } from '../../data/accountsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { ValidationError } from '../../data/errors'
import { listBudgets } from '../../data/budgetsRepo'
import { createTransaction, getTransaction, listTransactions, updateTransaction } from '../../data/transactionsRepo'
import { levelCrossings } from '../../domain/budgets'
import { currentMonth } from '../../domain/months'
import { alertMessage, budgetLabel } from '../budgets/budgetLabels'
import type { Account } from '../../domain/accounts'
import type { Category } from '../../domain/categories'
import { todayISO } from '../../domain/dates'
import { currencyLabels, parseAmount, toInputValue } from '../../domain/money'
import {
  DESCRIPTION_MAX,
  TRANSACTION_TYPES,
  transactionTypeLabels,
  validateTransaction,
  type Transaction,
  type TransactionErrors,
  type TransactionType,
} from '../../domain/transactions'

const typeOptions = TRANSACTION_TYPES.map((value) => ({ value, label: transactionTypeLabels[value] }))
const currencySymbol = { ILS: '₪', USD: '$' } as const

/** /transactions/new?type=expense لإضافة عملية، و /transactions/:id/edit لتعديلها. */
export function TransactionFormScreen() {
  const { id } = useParams()
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  // null: العملية غير موجودة. undefined: جارٍ التحميل.
  const transaction = useLiveQuery(async () => (id ? ((await getTransaction(id)) ?? null) : null), [id])

  if (!accounts || !categories || (id && transaction === undefined)) return null
  if (id && transaction === null) {
    return (
      <EmptyState
        title="العملية غير موجودة"
        description="ربما حُذفت هذه العملية."
        action={<Link to="/transactions">العودة إلى العمليات</Link>}
      />
    )
  }
  return (
    <TransactionForm
      key={transaction?.id ?? 'new'}
      accounts={accounts}
      categories={categories}
      transaction={transaction ?? undefined}
    />
  )
}

/**
 * تنبيه فوري إذا رفعت العملية المحفوظة ميزانيةً من هذا الشهر إلى مستوى «اقتراب» أو «حد».
 * للشهر الحالي فقط، حتى لا تزعج تعديلات العمليات القديمة.
 */
async function budgetWarning(date: string, before: Awaited<ReturnType<typeof listTransactions>>) {
  const month = currentMonth()
  if (!date.startsWith(month)) return undefined
  const [budgets, after, categories] = await Promise.all([listBudgets(), listTransactions(), listCategories()])
  const crossings = levelCrossings(budgets, month, before, after)
  if (crossings.length === 0) return undefined
  const names = new Map(categories.map((c) => [c.id, c.name]))
  return crossings
    .map(({ budget, level }) => alertMessage(level, budgetLabel(budget, names.get(budget.categoryId ?? ''))))
    .join(' ')
}

type FormProps = { accounts: Account[]; categories: Category[]; transaction?: Transaction }

function TransactionForm({ accounts, categories, transaction }: FormProps) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = !!transaction

  const initialType: TransactionType = transaction?.type ?? (params.get('type') === 'income' ? 'income' : 'expense')
  const [type, setType] = useState<TransactionType>(initialType)
  const [amount, setAmount] = useState(transaction ? toInputValue(transaction.amountMinor) : '')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [errors, setErrors] = useState<TransactionErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const account = accounts.find((a) => a.id === accountId)
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} ${currencySymbol[a.currency]}` }))
  // فئات النوع المختار غير المؤرشفة، مع فئة العملية الحالية حتى لو أُرشفت.
  const categoryOptions = [
    { value: '', label: 'بلا فئة' },
    ...categories
      .filter((c) => c.kind === type && (!c.archived || c.id === transaction?.categoryId))
      .map((c) => ({ value: c.id, label: c.name })),
  ]

  function changeType(next: TransactionType) {
    // الفئة تخص نوعاً واحداً؛ عند تغيير النوع تُلغى فئة النوع الآخر.
    if (categories.find((c) => c.id === categoryId)?.kind !== next) setCategoryId('')
    setType(next)
  }

  function clearError(field: keyof TransactionErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return // يمنع الحفظ المكرر بضغطتين سريعتين.
    setFormError(undefined)

    const parsed = parseAmount(amount)
    const input = { type, amountMinor: parsed.ok ? parsed.minor : 0, accountId, date, categoryId: categoryId || null, description }
    const next = validateTransaction(input)
    if (!parsed.ok) next.amount = parsed.error
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      const before = await listTransactions()
      if (transaction) await updateTransaction(transaction.id, input)
      else await createTransaction(input)
      const warning = await budgetWarning(input.date, before)

      if (transaction) {
        navigate(`/transactions/${transaction.id}`, { replace: true, state: { flash: 'حُفظت التعديلات.', warning } })
      } else {
        const flash = type === 'income' ? 'أُضيف الدخل.' : 'أُضيف المصروف.'
        navigate('/transactions', { replace: true, state: { flash, warning } })
      }
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setFormError('تعذّر حفظ العملية على هذا الجهاز. حاول مرة أخرى.')
      setSaving(false)
    }
  }

  const title = isEdit ? 'تعديل العملية' : type === 'income' ? 'إضافة دخل' : 'إضافة مصروف'

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to={transaction ? `/transactions/${transaction.id}` : '/transactions'}>→ رجوع</Link>
      </p>
      <h1 className="page-title">{title}</h1>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <ChoiceGroup legend="نوع العملية" options={typeOptions} value={type} onChange={changeType} />

      <TextField
        label="المبلغ"
        className="field--amount"
        inputMode="decimal"
        dir="ltr"
        placeholder="0.00"
        autoComplete="off"
        autoFocus={!isEdit}
        hint={account ? `بعملة الحساب: ${currencyLabels[account.currency]}` : undefined}
        value={amount}
        error={errors.amount}
        onChange={(e) => {
          setAmount(e.target.value)
          clearError('amount')
        }}
        onBlur={() => {
          if (amount === '') return
          const parsed = parseAmount(amount)
          if (!parsed.ok) setErrors((prev) => ({ ...prev, amount: parsed.error }))
        }}
      />

      <ChoiceGroup
        legend={type === 'income' ? 'إلى حساب' : 'من حساب'}
        options={accountOptions}
        value={accountId}
        onChange={(v) => {
          setAccountId(v)
          clearError('accountId')
        }}
      />
      {errors.accountId && <p className="field__error">{errors.accountId}</p>}

      <ChoiceGroup legend="الفئة" options={categoryOptions} value={categoryId} onChange={setCategoryId} />
      {errors.categoryId && <p className="field__error">{errors.categoryId}</p>}

      <TextField
        label="التاريخ"
        type="date"
        max={todayISO()}
        value={date}
        error={errors.date}
        onChange={(e) => {
          setDate(e.target.value)
          clearError('date')
        }}
      />

      <TextField
        label="الوصف"
        hint="اختياري، مثل: بقالة، فاتورة كهرباء، راتب"
        maxLength={DESCRIPTION_MAX}
        value={description}
        error={errors.description}
        onChange={(e) => {
          setDescription(e.target.value)
          clearError('description')
        }}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          {isEdit ? 'حفظ التعديلات' : type === 'income' ? 'حفظ الدخل' : 'حفظ المصروف'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate(transaction ? `/transactions/${transaction.id}` : '/transactions')}
        >
          إلغاء
        </Button>
      </div>
    </form>
  )
}
