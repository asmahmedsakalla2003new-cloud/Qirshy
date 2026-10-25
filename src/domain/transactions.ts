import { isValidISODate, todayISO } from './dates'
import { CURRENCIES, type Currency } from './money'

/**
 * العمليات المالية. في المرحلة 3: مصروف ودخل. التحويلات تُضاف في المرحلة 6
 * ولن تُحتسب دخلاً ولا مصروفاً.
 */
export const TRANSACTION_TYPES = ['expense', 'income'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const transactionTypeLabels: Record<TransactionType, string> = {
  expense: 'مصروف',
  income: 'دخل',
}

export type Transaction = {
  id: string
  type: TransactionType
  /** موجب دائماً، بأصغر وحدة. النوع يحدد الإشارة. */
  amountMinor: number
  /** عملة الحساب وقت التسجيل، محفوظة مع العملية حتى لا تُخلط العملات. */
  currency: Currency
  accountId: string
  /** YYYY-MM-DD بالتوقيت المحلي. */
  date: string
  /** فئة من نوع العملية نفسه، أو null. */
  categoryId: string | null
  description: string
  createdAt: string
  updatedAt: string
}

export type TransactionInput = Pick<
  Transaction,
  'type' | 'amountMinor' | 'accountId' | 'date' | 'categoryId' | 'description'
>

export const DESCRIPTION_MAX = 200

export type TransactionErrors = Partial<Record<'type' | 'amount' | 'accountId' | 'categoryId' | 'date' | 'description', string>>

/** يتحقق من العملية. المبلغ يُقرأ ويُتحقق منه في parseAmount قبل الوصول إلى هنا. */
export function validateTransaction(input: TransactionInput, today = todayISO()): TransactionErrors {
  const errors: TransactionErrors = {}
  if (!TRANSACTION_TYPES.includes(input.type)) errors.type = 'اختر نوع العملية.'
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    errors.amount = 'يجب أن يكون المبلغ أكبر من صفر.'
  }
  if (!input.accountId) errors.accountId = 'اختر الحساب.'
  if (!isValidISODate(input.date)) errors.date = 'أدخل تاريخاً صحيحاً.'
  else if (input.date > today) errors.date = 'لا يمكن أن يكون التاريخ في المستقبل.'
  if (input.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `الوصف طويل؛ الحد ${DESCRIPTION_MAX} حرف.`
  }
  return errors
}

/** أثر العملية على رصيد حسابها: الدخل يزيد والمصروف ينقص. */
export function signedAmount(t: Pick<Transaction, 'type' | 'amountMinor'>): number {
  return t.type === 'income' ? t.amountMinor : -t.amountMinor
}

/** قيمة تصفية للعمليات التي بلا فئة. */
export const NO_CATEGORY = 'none'

export type TransactionFilter = {
  query?: string
  /** 'transfer' يعرض التحويلات فقط (ولا يطابق أي مصروف أو دخل). */
  type?: TransactionType | 'transfer'
  accountId?: string
  /** معرّف فئة، أو NO_CATEGORY. */
  categoryId?: string
  /** YYYY-MM-DD شاملاً. */
  from?: string
  to?: string
}

/** يطبّع النص للبحث: أرقام عربية إلى غربية، وتوحيد الهمزات والتاء المربوطة والياء. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '') // التشكيل
    .trim()
}

export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter,
  /** أسماء الحسابات والفئات حسب المعرّف، ليشملها البحث. */
  names: Record<string, string> = {},
): Transaction[] {
  const query = normalizeSearch(filter.query ?? '')
  return transactions.filter((t) => {
    if (filter.type && t.type !== filter.type) return false
    if (filter.accountId && t.accountId !== filter.accountId) return false
    if (filter.categoryId && (t.categoryId ?? NO_CATEGORY) !== filter.categoryId) return false
    if (filter.from && t.date < filter.from) return false
    if (filter.to && t.date > filter.to) return false
    if (query) {
      const amount = (t.amountMinor / 100).toFixed(2)
      const category = t.categoryId ? (names[t.categoryId] ?? '') : ''
      const haystack = normalizeSearch(`${t.description} ${names[t.accountId] ?? ''} ${category} ${amount}`)
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

/** الأحدث أولاً: بالتاريخ، ثم بوقت الإنشاء لعمليات اليوم نفسه. */
export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export type CurrencySummary = { currency: Currency; incomeMinor: number; expenseMinor: number; netMinor: number }

/** مجموع الدخل والمصروف لكل عملة على حدة. لا تُعاد عملة ليس لها عمليات. */
export function summarize(transactions: Transaction[]): CurrencySummary[] {
  return CURRENCIES.filter((currency) => transactions.some((t) => t.currency === currency)).map((currency) => {
    const inCurrency = transactions.filter((t) => t.currency === currency)
    const incomeMinor = inCurrency.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinor, 0)
    const expenseMinor = inCurrency.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinor, 0)
    return { currency, incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor }
  })
}

/** يجمع العناصر المرتبة حسب اليوم، مع الحفاظ على الترتيب. */
export function groupByDate<T extends { date: string }>(items: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = []
  for (const t of items) {
    const last = groups.at(-1)
    if (last?.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }
  return groups
}
