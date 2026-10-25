import { isValidISODate, todayISO } from './dates'
import type { Currency } from './money'

/**
 * الديون: سجل مستقل لا يؤثر على أرصدة الحسابات ولا يُحتسب دخلاً أو مصروفاً
 * (قرار صاحب المشروع). لكل دين دفعات جزئية، والمتبقي = الأصل − مجموع الدفعات.
 */
export type DebtDirection = 'owed_to_me' | 'owed_by_me'

export const directionLabels: Record<DebtDirection, string> = {
  owed_to_me: 'لي (دين عند غيري)',
  owed_by_me: 'عليّ (دين لغيري)',
}

export type Debt = {
  id: string
  direction: DebtDirection
  counterparty: string
  amountMinor: number
  currency: Currency
  /** تاريخ الدين YYYY-MM-DD. */
  date: string
  dueDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export type DebtPayment = {
  id: string
  debtId: string
  amountMinor: number
  date: string
  createdAt: string
}

export type DebtInput = Pick<Debt, 'direction' | 'counterparty' | 'amountMinor' | 'currency' | 'date' | 'dueDate' | 'notes'>

export const COUNTERPARTY_MAX = 60

export type DebtErrors = Partial<Record<'counterparty' | 'amount' | 'date' | 'dueDate' | 'notes', string>>

/** paidMinor: مجموع الدفعات الحالية، حتى لا يصير الأصل أقل مما سُدّد. */
export function validateDebt(input: DebtInput, paidMinor = 0, today = todayISO()): DebtErrors {
  const errors: DebtErrors = {}
  const name = input.counterparty.trim()
  if (!name) errors.counterparty = 'أدخل اسم الشخص أو الجهة.'
  else if (name.length > COUNTERPARTY_MAX) errors.counterparty = `الاسم طويل؛ الحد ${COUNTERPARTY_MAX} حرفاً.`
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) errors.amount = 'يجب أن يكون المبلغ أكبر من صفر.'
  else if (input.amountMinor < paidMinor) errors.amount = 'المبلغ أقل مما سُدّد منه. احذف دفعات أولاً.'
  if (!isValidISODate(input.date)) errors.date = 'أدخل تاريخاً صحيحاً.'
  else if (input.date > today) errors.date = 'لا يمكن أن يكون التاريخ في المستقبل.'
  if (input.dueDate !== null) {
    if (!isValidISODate(input.dueDate)) errors.dueDate = 'أدخل تاريخاً صحيحاً.'
    else if (isValidISODate(input.date) && input.dueDate < input.date) errors.dueDate = 'موعد السداد قبل تاريخ الدين.'
  }
  if (input.notes.trim().length > 200) errors.notes = 'الملاحظات طويلة؛ الحد 200 حرف.'
  return errors
}

export type DebtStatus = {
  paidMinor: number
  remainingMinor: number
  settled: boolean
  /** لم يُسدَّد وفات موعده. */
  overdue: boolean
}

export function debtStatus(debt: Pick<Debt, 'id' | 'amountMinor' | 'dueDate'>, payments: Pick<DebtPayment, 'debtId' | 'amountMinor'>[], today = todayISO()): DebtStatus {
  const paidMinor = payments.filter((p) => p.debtId === debt.id).reduce((sum, p) => sum + p.amountMinor, 0)
  const remainingMinor = debt.amountMinor - paidMinor
  const settled = remainingMinor <= 0
  return { paidMinor, remainingMinor, settled, overdue: !settled && debt.dueDate !== null && debt.dueDate < today }
}

/** الدفعة موجبة ولا تتجاوز المتبقي. */
export function validatePayment(amountMinor: number, remainingMinor: number, date: string, today = todayISO()): Partial<Record<'amount' | 'date', string>> {
  const errors: Partial<Record<'amount' | 'date', string>> = {}
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) errors.amount = 'يجب أن يكون المبلغ أكبر من صفر.'
  else if (amountMinor > remainingMinor) errors.amount = 'الدفعة أكبر من المتبقي من الدين.'
  if (!isValidISODate(date)) errors.date = 'أدخل تاريخاً صحيحاً.'
  else if (date > today) errors.date = 'لا يمكن أن يكون التاريخ في المستقبل.'
  return errors
}
