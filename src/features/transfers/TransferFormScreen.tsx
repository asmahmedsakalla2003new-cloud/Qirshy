import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import { listAccounts } from '../../data/accountsRepo'
import { ValidationError } from '../../data/errors'
import { createTransfer, getTransfer, updateTransfer } from '../../data/transfersRepo'
import type { Account } from '../../domain/accounts'
import { todayISO } from '../../domain/dates'
import { currencyLabels, parseAmount, toInputValue, currencySymbols } from '../../domain/money'
import { exchangeRate, validateTransfer, type Transfer, type TransferErrors } from '../../domain/transfers'

/** /transfers/new لإضافة تحويل، و /transfers/:id/edit لتعديله. */
export function TransferFormScreen() {
  const { id } = useParams()
  const accounts = useLiveQuery(listAccounts)
  const transfer = useLiveQuery(async () => (id ? ((await getTransfer(id)) ?? null) : null), [id])

  if (!accounts || (id && transfer === undefined)) return null
  if (id && transfer === null) {
    return (
      <EmptyState
        title="التحويل غير موجود"
        description="ربما حُذف هذا التحويل."
        action={<Link to="/transactions">العودة إلى العمليات</Link>}
      />
    )
  }
  if (accounts.length < 2) {
    return (
      <EmptyState
        title="تحتاج حسابين على الأقل"
        description="التحويل ينقل مبلغاً من حساب إلى آخر. أضف حساباً ثانياً، مثل البنك أو جوال باي."
        action={
          <Link to="/settings/accounts/new" className="btn btn--primary btn--md">
            إضافة حساب
          </Link>
        }
      />
    )
  }
  return <TransferForm key={transfer?.id ?? 'new'} accounts={accounts} transfer={transfer ?? undefined} />
}

function TransferForm({ accounts, transfer }: { accounts: Account[]; transfer?: Transfer }) {
  const navigate = useNavigate()
  const [fromAccountId, setFrom] = useState(transfer?.fromAccountId ?? accounts[0].id)
  const [toAccountId, setTo] = useState(transfer?.toAccountId ?? accounts[1].id)
  const [fromAmount, setFromAmount] = useState(transfer ? toInputValue(transfer.fromAmountMinor) : '')
  const [toAmount, setToAmount] = useState(transfer ? toInputValue(transfer.toAmountMinor) : '')
  const [date, setDate] = useState(transfer?.date ?? todayISO())
  const [description, setDescription] = useState(transfer?.description ?? '')
  const [errors, setErrors] = useState<TransferErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const from = accounts.find((a) => a.id === fromAccountId)
  const to = accounts.find((a) => a.id === toAccountId)
  const crossCurrency = !!from && !!to && from.currency !== to.currency
  const options = accounts.map((a) => ({ value: a.id, label: `${a.name} ${currencySymbols[a.currency]}` }))
  const back = transfer ? `/transfers/${transfer.id}` : '/transactions'

  const parsedFrom = parseAmount(fromAmount)
  const parsedTo = parseAmount(toAmount)
  const rate =
    crossCurrency && parsedFrom.ok && parsedTo.ok
      ? exchangeRate({ fromAmountMinor: parsedFrom.minor, toAmountMinor: parsedTo.minor })
      : null

  function clear(field: keyof TransferErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(undefined)
    // بالعملة نفسها يصل المبلغ كما هو، فلا يُطلب مرتين.
    const toParsed = crossCurrency ? parsedTo : parsedFrom
    const input = {
      fromAccountId,
      toAccountId,
      fromAmountMinor: parsedFrom.ok ? parsedFrom.minor : 0,
      toAmountMinor: toParsed.ok ? toParsed.minor : 0,
      date,
      description,
    }
    const next = validateTransfer(input, { from: from?.currency, to: to?.currency })
    if (!parsedFrom.ok) next.fromAmount = parsedFrom.error
    if (crossCurrency && !parsedTo.ok) next.toAmount = parsedTo.error
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      if (transfer) {
        await updateTransfer(transfer.id, input)
        navigate(`/transfers/${transfer.id}`, { replace: true, state: { flash: 'حُفظت التعديلات.' } })
      } else {
        await createTransfer(input)
        navigate('/transactions', { replace: true, state: { flash: 'أُضيف التحويل.' } })
      }
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setFormError('تعذّر حفظ التحويل. حاول مرة أخرى.')
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to={back}>→ رجوع</Link>
      </p>
      <h1 className="page-title">{transfer ? 'تعديل التحويل' : 'تحويل بين الحسابات'}</h1>
      <p className="muted small">التحويل ينقل المبلغ بين حساباتك، ولا يُحتسب دخلاً ولا مصروفاً.</p>
      {formError && <Alert tone="danger">{formError}</Alert>}

      <ChoiceGroup
        legend="من حساب"
        options={options}
        value={fromAccountId}
        onChange={(v) => {
          setFrom(v)
          clear('toAccountId')
        }}
      />
      <ChoiceGroup
        legend="إلى حساب"
        options={options}
        value={toAccountId}
        onChange={(v) => {
          setTo(v)
          clear('toAccountId')
        }}
      />
      {errors.toAccountId && <p className="field__error">{errors.toAccountId}</p>}

      <TextField
        label={crossCurrency ? `المبلغ المحوَّل (${currencyLabels[from!.currency]})` : 'المبلغ'}
        className="field--amount"
        inputMode="decimal"
        dir="ltr"
        placeholder="0.00"
        autoComplete="off"
        value={fromAmount}
        error={errors.fromAmount}
        onChange={(e) => {
          setFromAmount(e.target.value)
          clear('fromAmount')
        }}
      />

      {crossCurrency && (
        <TextField
          label={`المبلغ الواصل (${currencyLabels[to!.currency]})`}
          className="field--amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          autoComplete="off"
          hint={
            rate !== null ? (
              <>
                سعر الصرف المحسوب:{' '}
                <bdi dir="ltr" className="num">
                  1 {currencySymbols[from!.currency]} = {rate} {currencySymbols[to!.currency]}
                </bdi>
              </>
            ) : (
              'اكتب المبلغ الذي وصل فعلاً بعد الصرف؛ يُحسب سعر الصرف منه.'
            )
          }
          value={toAmount}
          error={errors.toAmount}
          onChange={(e) => {
            setToAmount(e.target.value)
            clear('toAmount')
          }}
        />
      )}

      <TextField
        label="التاريخ"
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
        label="الوصف"
        hint="اختياري، مثل: إيداع في البنك، شحن جوال باي"
        maxLength={200}
        value={description}
        error={errors.description}
        onChange={(e) => {
          setDescription(e.target.value)
          clear('description')
        }}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          {transfer ? 'حفظ التعديلات' : 'حفظ التحويل'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate(back)}>
          إلغاء
        </Button>
      </div>
    </form>
  )
}
