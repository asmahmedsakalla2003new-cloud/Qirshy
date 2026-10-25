import { debtStatus, validateDebt, validatePayment, type Debt, type DebtInput, type DebtPayment } from '../domain/debts'
import { db } from './db'
import { ValidationError } from './errors'

export function listDebts(): Promise<Debt[]> {
  return db.debts.toArray()
}

export function listDebtPayments(): Promise<DebtPayment[]> {
  return db.debtPayments.toArray()
}

export async function getDebtWithPayments(id: string): Promise<{ debt: Debt; payments: DebtPayment[] } | null> {
  const debt = await db.debts.get(id)
  if (!debt) return null
  const payments = await db.debtPayments.where('debtId').equals(id).toArray()
  payments.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  return { debt, payments }
}

function clean(input: DebtInput): DebtInput {
  return { ...input, counterparty: input.counterparty.trim(), notes: input.notes.trim() }
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const errors = validateDebt(input)
  if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)
  const now = new Date().toISOString()
  const debt: Debt = { ...clean(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
  await db.debts.add(debt)
  return debt
}

export async function updateDebt(id: string, input: DebtInput): Promise<void> {
  await db.transaction('rw', db.debts, db.debtPayments, async () => {
    const debt = await db.debts.get(id)
    if (!debt) throw new Error('الدين غير موجود.')
    // عملة الدين ثابتة بعد تسجيل دفعات، لأن الدفعات بعملته.
    const payments = await db.debtPayments.where('debtId').equals(id).toArray()
    if (payments.length > 0 && input.currency !== debt.currency) {
      throw new ValidationError({ amount: 'لا يمكن تغيير عملة دين له دفعات.' })
    }
    const paid = payments.reduce((sum, p) => sum + p.amountMinor, 0)
    const errors = validateDebt(input, paid)
    if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)
    await db.debts.update(id, { ...clean(input), updatedAt: new Date().toISOString() })
  })
}

/** يحذف الدين ودفعاته معاً. */
export async function deleteDebt(id: string): Promise<void> {
  await db.transaction('rw', db.debts, db.debtPayments, async () => {
    await db.debtPayments.where('debtId').equals(id).delete()
    await db.debts.delete(id)
  })
}

/** دفعة جزئية أو كاملة؛ لا تتجاوز المتبقي. */
export async function addDebtPayment(debtId: string, amountMinor: number, date: string): Promise<DebtPayment> {
  return db.transaction('rw', db.debts, db.debtPayments, async () => {
    const debt = await db.debts.get(debtId)
    if (!debt) throw new Error('الدين غير موجود.')
    const payments = await db.debtPayments.where('debtId').equals(debtId).toArray()
    const { remainingMinor } = debtStatus(debt, payments)
    const errors = validatePayment(amountMinor, remainingMinor, date)
    if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)
    const payment: DebtPayment = { id: crypto.randomUUID(), debtId, amountMinor, date, createdAt: new Date().toISOString() }
    await db.debtPayments.add(payment)
    return payment
  })
}

export async function deleteDebtPayment(id: string): Promise<void> {
  await db.debtPayments.delete(id)
}
