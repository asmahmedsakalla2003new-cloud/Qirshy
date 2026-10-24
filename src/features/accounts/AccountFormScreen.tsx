import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import {
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
  ValidationError,
} from '../../data/accountsRepo'
import {
  ACCOUNT_TYPES,
  accountTypeLabels,
  defaultAccountNames,
  validateAccount,
  type Account,
  type AccountType,
} from '../../domain/accounts'
import { CURRENCIES, currencyLabels, parseAmount, toInputValue, type Currency } from '../../domain/money'

const typeOptions = ACCOUNT_TYPES.map((value) => ({ value, label: accountTypeLabels[value] }))
const currencyOptions = CURRENCIES.map((value) => ({ value, label: currencyLabels[value] }))

/** /accounts/new لإضافة حساب، و /accounts/:id لتعديله. */
export function AccountFormScreen() {
  const { id } = useParams()
  // null: الحساب غير موجود. undefined: جارٍ التحميل.
  const account = useLiveQuery(async () => (id ? ((await getAccount(id)) ?? null) : null), [id])

  if (id && account === undefined) return null
  if (id && account === null) {
    return (
      <EmptyState
        title="الحساب غير موجود"
        description="ربما حُذف هذا الحساب."
        action={<Link to="/settings/accounts">العودة إلى الحسابات</Link>}
      />
    )
  }
  return <AccountForm key={account?.id ?? 'new'} account={account ?? undefined} />
}

function AccountForm({ account }: { account?: Account }) {
  const navigate = useNavigate()
  const isEdit = !!account

  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const [name, setName] = useState(account?.name ?? defaultAccountNames.bank)
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ILS')
  const [balance, setBalance] = useState(account ? toInputValue(account.openingBalanceMinor) : '')
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  function changeType(next: AccountType) {
    // اقترح اسم النوع الجديد ما دام المستخدم لم يكتب اسماً خاصاً به.
    if (name.trim() === '' || name === defaultAccountNames[type]) setName(defaultAccountNames[next])
    setType(next)
  }

  function checkBalance(value: string) {
    const parsed = parseAmount(value, { allowNegative: true, allowZero: true })
    return parsed.ok ? undefined : parsed.error
  }

  async function checkName() {
    const others = (await listAccounts()).filter((a) => a.id !== account?.id)
    return validateAccount({ name, type, currency, openingBalanceMinor: 0 }, others).name
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(undefined)

    const parsed = parseAmount(balance, { allowNegative: true, allowZero: true })
    const next = { name: await checkName(), balance: parsed.ok ? undefined : parsed.error }
    setErrors(next)
    if (next.name || !parsed.ok) return

    const input = { name, type, currency, openingBalanceMinor: parsed.minor }
    setSaving(true)
    try {
      if (account) await updateAccount(account.id, input)
      else await createAccount(input)
      navigate('/settings/accounts', { replace: true })
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setFormError('تعذّر حفظ الحساب على هذا الجهاز. حاول مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!account) return
    setConfirmingDelete(false)
    try {
      await deleteAccount(account.id)
      navigate('/settings/accounts', { replace: true })
    } catch (err) {
      setFormError(err instanceof ValidationError ? err.message : 'تعذّر حذف الحساب. حاول مرة أخرى.')
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to="/settings/accounts">→ الحسابات</Link>
      </p>
      <h1 className="page-title">{isEdit ? 'تعديل الحساب' : 'إضافة حساب'}</h1>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <ChoiceGroup legend="نوع الحساب" options={typeOptions} value={type} onChange={changeType} />

      <TextField
        label="اسم الحساب"
        value={name}
        maxLength={40}
        autoComplete="off"
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value)
          if (errors.name) setErrors({ ...errors, name: undefined })
        }}
        onBlur={async () => {
          const error = await checkName()
          setErrors((prev) => ({ ...prev, name: error }))
        }}
      />

      <ChoiceGroup legend="العملة" options={currencyOptions} value={currency} onChange={setCurrency} />

      <TextField
        label="الرصيد الافتتاحي"
        inputMode="decimal"
        dir="ltr"
        placeholder="0.00"
        autoComplete="off"
        hint="المبلغ الموجود في الحساب الآن. اكتب إشارة - قبله إذا كان الحساب مكشوفاً."
        value={balance}
        error={errors.balance}
        onChange={(e) => {
          setBalance(e.target.value)
          if (errors.balance) setErrors({ ...errors, balance: undefined })
        }}
        onBlur={() => balance !== '' && setErrors((prev) => ({ ...prev, balance: checkBalance(balance) }))}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          {isEdit ? 'حفظ التعديلات' : 'إضافة الحساب'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/settings/accounts')}>
          إلغاء
        </Button>
      </div>

      {account && (
        <>
          <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirmingDelete(true)}>
            حذف الحساب
          </Button>
          <ConfirmDialog
            open={confirmingDelete}
            title={`حذف حساب «${account.name}»؟`}
            confirmLabel="حذف الحساب"
            onConfirm={confirmDelete}
            onCancel={() => setConfirmingDelete(false)}
          >
            سيُحذف الحساب نهائياً من هذا الجهاز.
          </ConfirmDialog>
        </>
      )}
    </form>
  )
}
