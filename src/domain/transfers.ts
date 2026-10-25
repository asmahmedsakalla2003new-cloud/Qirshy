import { isValidISODate, todayISO } from './dates'
import type { Currency } from './money'
import { normalizeSearch, type TransactionFilter } from './transactions'

/**
 * التحويل بين حسابين: ينقص رصيد المصدر ويزيد رصيد الوجهة، ولا يُحتسب دخلاً
 * ولا مصروفاً ولا يدخل في الميزانيات. بين عملتين يُدخل المستخدم المبلغين،
 * ويُشتق سعر الصرف منهما (لا يُجلب من الإنترنت).
 */
export type Transfer = {
  id: string
  fromAccountId: string
  toAccountId: string
  fromAmountMinor: number
  toAmountMinor: number
  /** عملتا الحسابين وقت التسجيل. */
  fromCurrency: Currency
  toCurrency: Currency
  /** YYYY-MM-DD محلي. */
  date: string
  description: string
  createdAt: string
  updatedAt: string
}

export type TransferInput = Pick<
  Transfer,
  'fromAccountId' | 'toAccountId' | 'fromAmountMinor' | 'toAmountMinor' | 'date' | 'description'
>

export type TransferErrors = Partial<Record<'toAccountId' | 'fromAmount' | 'toAmount' | 'date' | 'description', string>>

export function validateTransfer(
  input: TransferInput,
  currencies: { from?: Currency; to?: Currency },
  today = todayISO(),
): TransferErrors {
  const errors: TransferErrors = {}
  if (!input.fromAccountId || !input.toAccountId) errors.toAccountId = 'اختر الحسابين.'
  else if (input.fromAccountId === input.toAccountId) errors.toAccountId = 'اختر حساباً مختلفاً للتحويل إليه.'
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0
  if (!positive(input.fromAmountMinor)) errors.fromAmount = 'يجب أن يكون المبلغ أكبر من صفر.'
  if (!positive(input.toAmountMinor)) errors.toAmount = 'يجب أن يكون المبلغ أكبر من صفر.'
  else if (currencies.from && currencies.from === currencies.to && input.toAmountMinor !== input.fromAmountMinor) {
    // بالعملة نفسها يصل المبلغ كما هو.
    errors.toAmount = 'بالعملة نفسها يجب أن يتساوى المبلغان.'
  }
  if (!isValidISODate(input.date)) errors.date = 'أدخل تاريخاً صحيحاً.'
  else if (input.date > today) errors.date = 'لا يمكن أن يكون التاريخ في المستقبل.'
  if (input.description.trim().length > 200) errors.description = 'الوصف طويل؛ الحد 200 حرف.'
  return errors
}

/** أثر التحويلات على رصيد حساب: الوارد موجب والصادر سالب. */
export function transferEffect(accountId: string, transfers: Pick<Transfer, 'fromAccountId' | 'toAccountId' | 'fromAmountMinor' | 'toAmountMinor'>[]): number {
  let effect = 0
  for (const t of transfers) {
    if (t.fromAccountId === accountId) effect -= t.fromAmountMinor
    if (t.toAccountId === accountId) effect += t.toAmountMinor
  }
  return effect
}

/**
 * سعر الصرف المشتق للعرض فقط: كم وحدة من عملة الوجهة مقابل وحدة من عملة المصدر.
 * يُقرّب لأربع خانات؛ المبالغ المحفوظة هي المرجع لا السعر.
 */
export function exchangeRate(t: Pick<Transfer, 'fromAmountMinor' | 'toAmountMinor'>): number {
  return Math.round((t.toAmountMinor / t.fromAmountMinor) * 10_000) / 10_000
}

/**
 * تصفية التحويلات بمعايير سجل العمليات نفسها: لا تظهر عند التصفية بنوع
 * «مصروف» أو «دخل» أو بفئة، وتطابق الحساب إن كان مصدراً أو وجهة.
 */
export function filterTransfers(
  transfers: Transfer[],
  filter: TransactionFilter,
  names: Record<string, string> = {},
): Transfer[] {
  if ((filter.type && filter.type !== 'transfer') || filter.categoryId) return []
  const query = normalizeSearch(filter.query ?? '')
  return transfers.filter((t) => {
    if (filter.accountId && t.fromAccountId !== filter.accountId && t.toAccountId !== filter.accountId) return false
    if (filter.from && t.date < filter.from) return false
    if (filter.to && t.date > filter.to) return false
    if (query) {
      const amounts = `${(t.fromAmountMinor / 100).toFixed(2)} ${(t.toAmountMinor / 100).toFixed(2)}`
      const haystack = normalizeSearch(`تحويل ${t.description} ${names[t.fromAccountId] ?? ''} ${names[t.toAccountId] ?? ''} ${amounts}`)
      if (!haystack.includes(query)) return false
    }
    return true
  })
}
