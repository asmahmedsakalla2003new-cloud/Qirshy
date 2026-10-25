import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import { listAccounts } from '../../data/accountsRepo'
import { ValidationError } from '../../data/errors'
import { createTransaction, getTransaction, updateTransaction } from '../../data/transactionsRepo'
import type { Account } from '../../domain/accounts'
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
  // null: العملية غير موجودة. undefined: جارٍ التحميل.
  const transaction = useLiveQuery(async () => (id ? ((await getTransaction(id)) ?? null) : null), [id])

  if (!accounts || (id && transaction === undefined)) return null
  if (id && transaction === null) {
    return (
      <EmptyState
        title="العملية غير موجودة"
        description="ربما حُذفت هذه العملية."
        action={<Link to="/transactions">العودة إلى العمليات</Link>}
      />
    )
  }
  return <TransactionForm key={transaction?.id ?? 'new'} accounts={accounts} transaction={transaction ?? undefined} />
}

function TransactionForm({ accounts, transaction }: { accounts: Account[]; transaction?: Transaction }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = !!transaction

  const initialType: TransactionType = transaction?.type ?? (params.get('type') === 'income' ? 'income' : 'expense')
  const [type, setType] = useState<TransactionType>(initialType)
  const [amount, setAmount] = useState(transaction ? toInputValue(transaction.amountMinor) : '')
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '')
  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [errors, setErrors] = useState<TransactionErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const account = accounts.find((a) => a.id === accountId)
  const accountOptions = accounts.map((a) => ({ value: a.id, label: `${a.name} ${currencySymbol[a.currency]}` }))

  function clearError(field: keyof TransactionErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return // يمنع الحفظ المكرر بضغطتين سريعتين.
    setFormError(undefined)

    const parsed = parseAmount(amount)
    const input = { type, amountMinor: parsed.ok ? parsed.minor : 0, accountId, date, categoryId: transaction?.categoryId ?? null, description }
    const next = validateTransaction(input)
    if (!parsed.ok) next.amount = parsed.error
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      if (transaction) {
        await updateTransaction(transaction.id, input)
        navigate(`/transactions/${transaction.id}`, { replace: true, state: { flash: 'حُفظت التعديلات.' } })
      } else {
        await createTransaction(input)
        navigate('/transactions', { replace: true, state: { flash: type === 'income' ? 'أُضيف الدخل.' : 'أُضيف المصروف.' } })
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

      <ChoiceGroup legend="نوع العملية" options={typeOptions} value={type} onChange={setType} />

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
