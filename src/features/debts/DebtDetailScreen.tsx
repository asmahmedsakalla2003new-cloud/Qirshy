import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { TextField } from '../../components/TextField'
import { addDebtPayment, deleteDebt, deleteDebtPayment, getDebtWithPayments } from '../../data/debtsRepo'
import { ValidationError } from '../../data/errors'
import { formatDate, todayISO } from '../../domain/dates'
import { debtStatus, directionLabels, type Debt, type DebtPayment } from '../../domain/debts'
import { parseAmount } from '../../domain/money'

export function DebtDetailScreen() {
  const { id = '' } = useParams()
  const data = useLiveQuery(() => getDebtWithPayments(id), [id])
  if (data === undefined) return null
  if (data === null) {
    return (
      <EmptyState title="الدين غير موجود" description="ربما حُذف هذا الدين." action={<Link to="/debts">العودة إلى الديون</Link>} />
    )
  }
  return <DebtDetail debt={data.debt} payments={data.payments} />
}

function DebtDetail({ debt, payments }: { debt: Debt; payments: DebtPayment[] }) {
  const navigate = useNavigate()
  const flash = useFlash()
  const status = debtStatus(debt, payments)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [errors, setErrors] = useState<Partial<Record<'amount' | 'date', string>>>({})
  const [notice, setNotice] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<DebtPayment>()
  const back = `/debts?dir=${debt.direction}`

  async function pay(amountMinor: number) {
    setErrors({})
    try {
      await addDebtPayment(debt.id, amountMinor, date)
      setAmount('')
      setNotice(amountMinor === status.remainingMinor ? 'سُدّد الدين بالكامل.' : 'سُجّلت الدفعة.')
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else setErrors({ amount: 'تعذّر تسجيل الدفعة. حاول مرة أخرى.' })
    }
  }

  function submitPayment(e: FormEvent) {
    e.preventDefault()
    const parsed = parseAmount(amount)
    if (!parsed.ok) return setErrors({ amount: parsed.error })
    void pay(parsed.minor)
  }

  async function removeDebt() {
    setConfirmDelete(false)
    await deleteDebt(debt.id)
    navigate(back, { replace: true, state: { flash: 'حُذف الدين.' } })
  }

  async function removePayment() {
    if (!paymentToDelete) return
    await deleteDebtPayment(paymentToDelete.id)
    setPaymentToDelete(undefined)
    setNotice('حُذفت الدفعة.')
  }

  return (
    <div className="stack">
      <p>
        <Link to={back}>→ الديون</Link>
      </p>
      {flash && !notice && <Alert tone="success">{flash}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card className="tx-hero">
        <p className={`tag ${status.settled ? 'tag--success' : status.overdue ? 'tag--danger' : ''}`}>
          {status.settled ? 'مسدَّد بالكامل' : status.overdue ? 'فات موعد السداد' : 'غير مسدَّد'}
        </p>
        <h1 className="tx-hero__title-lg">{debt.counterparty}</h1>
        <p className="tx-hero__amount">
          <Money minor={status.remainingMinor} currency={debt.currency} />
        </p>
        <p className="muted">
          متبقٍ من <Money minor={debt.amountMinor} currency={debt.currency} /> · {directionLabels[debt.direction]}
        </p>
      </Card>

      <Card>
        <dl className="details">
          <div>
            <dt>المسدَّد</dt>
            <dd>
              <Money minor={status.paidMinor} currency={debt.currency} />
            </dd>
          </div>
          <div>
            <dt>تاريخ الدين</dt>
            <dd>{formatDate(debt.date)}</dd>
          </div>
          {debt.dueDate && (
            <div>
              <dt>موعد السداد</dt>
              <dd>{formatDate(debt.dueDate)}</dd>
            </div>
          )}
          {debt.notes && (
            <div>
              <dt>ملاحظات</dt>
              <dd>{debt.notes}</dd>
            </div>
          )}
        </dl>
      </Card>

      {!status.settled && (
        <form className="stack stack--tight" onSubmit={submitPayment} noValidate aria-label="تسجيل دفعة">
          <h2 className="section-title section-title--flush">تسجيل دفعة</h2>
          <div className="row-2">
            <TextField
              label="مبلغ الدفعة"
              inputMode="decimal"
              dir="ltr"
              placeholder="0.00"
              autoComplete="off"
              value={amount}
              error={errors.amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setErrors({})
                setNotice(undefined)
              }}
            />
            <TextField
              label="تاريخ الدفعة"
              type="date"
              max={todayISO()}
              value={date}
              error={errors.date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-actions form-actions--even">
            <Button type="submit">تسجيل الدفعة</Button>
            <Button variant="secondary" onClick={() => pay(status.remainingMinor)}>
              تسديد الكل
            </Button>
          </div>
        </form>
      )}

      <section className="stack stack--tight">
        <h2 className="section-title section-title--flush">الدفعات</h2>
        {payments.length === 0 ? (
          <p className="muted">لم تُسجَّل دفعات بعد.</p>
        ) : (
          <ul className="list" aria-label="الدفعات">
            {payments.map((p) => (
              <li key={p.id} className="list-item">
                <span className="list-item__main">
                  <span className="list-item__title">
                    <Money minor={p.amountMinor} currency={debt.currency} />
                  </span>
                  <span className="list-item__meta">{formatDate(p.date)}</span>
                </span>
                <Button variant="ghost" className="btn--danger-text" onClick={() => setPaymentToDelete(p)}>
                  حذف
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to={`/debts/${debt.id}/edit`} className="btn btn--secondary btn--md btn--full">
        تعديل الدين
      </Link>
      <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirmDelete(true)}>
        حذف الدين
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title={`حذف دين «${debt.counterparty}»؟`}
        confirmLabel="حذف الدين"
        onConfirm={removeDebt}
        onCancel={() => setConfirmDelete(false)}
      >
        سيُحذف الدين وكل دفعاته نهائياً.
      </ConfirmDialog>
      <ConfirmDialog
        open={!!paymentToDelete}
        title="حذف الدفعة؟"
        confirmLabel="حذف الدفعة"
        onConfirm={removePayment}
        onCancel={() => setPaymentToDelete(undefined)}
      >
        سيُعاد المبلغ إلى المتبقي من الدين.
      </ConfirmDialog>
    </div>
  )
}
