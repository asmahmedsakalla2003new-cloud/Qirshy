import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { SelectField } from '../../components/SelectField'
import { TextField } from '../../components/TextField'
import { createBudget, listBudgets } from '../../data/budgetsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { ValidationError } from '../../data/errors'
import { validateBudget, type BudgetScope } from '../../domain/budgets'
import { CURRENCIES, currencyLabels, parseAmount, type Currency } from '../../domain/money'
import { currentMonth, formatMonth } from '../../domain/months'

const scopeOptions: { value: BudgetScope; label: string }[] = [
  { value: 'overall', label: 'عامة لكل المصاريف' },
  { value: 'category', label: 'لفئة معيّنة' },
]
const currencyOptions = CURRENCIES.map((value) => ({ value, label: currencyLabels[value] }))

type Errors = Partial<Record<'amount' | 'categoryId', string>>

export function BudgetFormScreen() {
  const navigate = useNavigate()
  const categories = useLiveQuery(listCategories)
  const [scope, setScope] = useState<BudgetScope>('overall')
  const [categoryId, setCategoryId] = useState('')
  const [currency, setCurrency] = useState<Currency>('ILS')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  if (!categories) return null
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && !c.archived)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(undefined)
    const parsed = parseAmount(amount)
    const input = { scope, categoryId: scope === 'category' ? categoryId || null : null, currency, amountMinor: parsed.ok ? parsed.minor : 0 }
    const next: Errors = validateBudget(input, await listBudgets())
    if (!parsed.ok) next.amount = parsed.error
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      await createBudget(input)
      navigate('/budgets', { replace: true, state: { flash: 'أُضيفت الميزانية.' } })
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setFormError('تعذّر حفظ الميزانية. حاول مرة أخرى.')
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to="/budgets">→ الميزانيات</Link>
      </p>
      <h1 className="page-title">إضافة ميزانية</h1>
      {formError && <Alert tone="danger">{formError}</Alert>}

      <ChoiceGroup
        legend="نوع الميزانية"
        options={scopeOptions}
        value={scope}
        onChange={(v) => {
          setScope(v)
          setErrors((prev) => ({ ...prev, categoryId: undefined }))
        }}
      />

      {scope === 'category' && (
        <>
          <SelectField
            label="الفئة"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setErrors((prev) => ({ ...prev, categoryId: undefined }))
            }}
            options={[{ value: '', label: 'اختر فئة مصروف' }, ...expenseCategories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </>
      )}
      {errors.categoryId && <p className="field__error">{errors.categoryId}</p>}

      <ChoiceGroup
        legend="العملة"
        options={currencyOptions}
        value={currency}
        onChange={(v) => {
          setCurrency(v)
          setErrors((prev) => ({ ...prev, categoryId: undefined }))
        }}
      />

      <TextField
        label="المبلغ الشهري"
        className="field--amount"
        inputMode="decimal"
        dir="ltr"
        placeholder="0.00"
        autoComplete="off"
        hint={`تُحتسب فيها مصاريف ${currencyLabels[currency]} فقط، وتتكرر كل شهر بدءاً من ${formatMonth(currentMonth())}.`}
        value={amount}
        error={errors.amount}
        onChange={(e) => {
          setAmount(e.target.value)
          if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }))
        }}
        onBlur={() => {
          if (amount === '') return
          const parsed = parseAmount(amount)
          if (!parsed.ok) setErrors((prev) => ({ ...prev, amount: parsed.error }))
        }}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          إضافة الميزانية
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/budgets')}>
          إلغاء
        </Button>
      </div>
    </form>
  )
}
