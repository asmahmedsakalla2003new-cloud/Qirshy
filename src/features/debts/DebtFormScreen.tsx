import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import { createDebt, getDebtWithPayments, updateDebt } from '../../data/debtsRepo'
import { ValidationError } from '../../data/errors'
import { todayISO } from '../../domain/dates'
import { COUNTERPARTY_MAX, validateDebt, type Debt, type DebtDirection, type DebtErrors } from '../../domain/debts'
import { CURRENCIES, currencyLabels, parseAmount, toInputValue, type Currency } from '../../domain/money'

const directionOptions: { value: DebtDirection; label: string }[] = [
  { value: 'owed_to_me', label: 'لي (أقرضتُ شخصاً)' },
  { value: 'owed_by_me', label: 'عليّ (استدنتُ من شخص)' },
]
const currencyOptions = CURRENCIES.map((value) => ({ value, label: currencyLabels[value] }))

/** /debts/new لإضافة دين، و /debts/:id/edit لتعديله. */
export function DebtFormScreen() {
  const { id } = useParams()
  const data = useLiveQuery(async () => (id ? await getDebtWithPayments(id) : null), [id])
  if (id && data === undefined) return null
  if (id && data === null) {
    return (
      <EmptyState title="الدين غير موجود" description="ربما حُذف هذا الدين." action={<Link to="/debts">العودة إلى الديون</Link>} />
    )
  }
  return <DebtForm key={data?.debt.id ?? 'new'} debt={data?.debt} hasPayments={(data?.payments.length ?? 0) > 0} />
}

function DebtForm({ debt, hasPayments }: { debt?: Debt; hasPayments: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [direction, setDirection] = useState<DebtDirection>(
    debt?.direction ?? (params.get('dir') === 'owed_by_me' ? 'owed_by_me' : 'owed_to_me'),
  )
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [amount, setAmount] = useState(debt ? toInputValue(debt.amountMinor) : '')
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? 'ILS')
  const [date, setDate] = useState(debt?.date ?? todayISO())
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '')
  const [notes, setNotes] = useState(debt?.notes ?? '')
  const [errors, setErrors] = useState<DebtErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const back = debt ? `/debts/${debt.id}` : `/debts?dir=${direction}`

  function clear(field: keyof DebtErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(undefined)
    const parsed = parseAmount(amount)
    const input = {
      direction,
      counterparty,
      amountMinor: parsed.ok ? parsed.minor : 0,
      currency,
      date,
      dueDate: dueDate || null,
      notes,
    }
    const next = validateDebt(input)
    if (!parsed.ok) next.amount = parsed.error
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      if (debt) {
        await updateDebt(debt.id, input)
        navigate(`/debts/${debt.id}`, { replace: true, state: { flash: 'حُفظت التعديلات.' } })
      } else {
        const created = await createDebt(input)
        navigate(`/debts/${created.id}`, { replace: true, state: { flash: 'أُضيف الدين.' } })
      }
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setFormError('تعذّر حفظ الدين. حاول مرة أخرى.')
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to={back}>→ رجوع</Link>
      </p>
      <h1 className="page-title">{debt ? 'تعديل الدين' : 'إضافة دين'}</h1>
      {formError && <Alert tone="danger">{formError}</Alert>}

      <ChoiceGroup legend="نوع الدين" options={directionOptions} value={direction} onChange={setDirection} />

      <TextField
        label={direction === 'owed_to_me' ? 'اسم المدين (الذي عليه المبلغ)' : 'اسم الدائن (صاحب المبلغ)'}
        value={counterparty}
        maxLength={COUNTERPARTY_MAX}
        autoComplete="off"
        error={errors.counterparty}
        onChange={(e) => {
          setCounterparty(e.target.value)
          clear('counterparty')
        }}
      />

      <TextField
        label="المبلغ"
        className="field--amount"
        inputMode="decimal"
        dir="ltr"
        placeholder="0.00"
        autoComplete="off"
        value={amount}
        error={errors.amount}
        onChange={(e) => {
          setAmount(e.target.value)
          clear('amount')
        }}
      />

      {hasPayments ? (
        <p className="muted small">العملة: {currencyLabels[currency]} (لا تتغيّر بعد تسجيل دفعات).</p>
      ) : (
        <ChoiceGroup legend="العملة" options={currencyOptions} value={currency} onChange={setCurrency} />
      )}

      <div className="row-2">
        <TextField
          label="تاريخ الدين"
          type="date"
          max={todayISO()}
          value={date}
          error={errors.date}
          onChange={(e) => {
            setDate(e.target.value)
            clear('date')
          }}
        />
        <TextField
          label="موعد السداد"
          type="date"
          hint="اختياري"
          value={dueDate}
          error={errors.dueDate}
          onChange={(e) => {
            setDueDate(e.target.value)
            clear('dueDate')
          }}
        />
      </div>

      <TextField
        label="ملاحظات"
        hint="اختياري"
        maxLength={200}
        value={notes}
        error={errors.notes}
        onChange={(e) => {
          setNotes(e.target.value)
          clear('notes')
        }}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          {debt ? 'حفظ التعديلات' : 'حفظ الدين'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate(back)}>
          إلغاء
        </Button>
      </div>
    </form>
  )
}
