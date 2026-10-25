import type { Currency } from './money'
import type { Transaction, TransactionType } from './transactions'

/**
 * الفئات: لكل نوع عملية (مصروف/دخل) فئاته. فئات افتراضية تُنشأ عند أول تشغيل،
 * ويضيف المستخدم فئاته الخاصة ويعدّلها. الفئة المستخدمة لا تُحذف بل تُؤرشف
 * (تختفي من الاختيار وتبقى في العمليات القديمة والتقارير).
 */
export type Category = {
  id: string
  name: string
  kind: TransactionType
  archived: boolean
  /** ترتيب العرض. */
  order: number
  createdAt: string
  updatedAt: string
}

export type CategoryInput = Pick<Category, 'name' | 'kind'>

export const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: [
    'بقالة وطعام',
    'مواصلات',
    'فواتير (كهرباء، ماء، إنترنت)',
    'اتصالات',
    'صحة وصيدلية',
    'سكن وإيجار',
    'تعليم',
    'ملابس',
    'ترفيه ومطاعم',
    'أخرى',
  ],
  income: ['راتب', 'عمل حر', 'هدية', 'أخرى'],
}

export const CATEGORY_NAME_MAX = 30

export function validateCategory(input: CategoryInput, others: Pick<Category, 'name' | 'kind'>[]): { name?: string } {
  const name = input.name.trim()
  if (name === '') return { name: 'أدخل اسم الفئة.' }
  if (name.length > CATEGORY_NAME_MAX) return { name: `الاسم طويل؛ الحد ${CATEGORY_NAME_MAX} حرفاً.` }
  if (others.some((c) => c.kind === input.kind && c.name.trim() === name)) {
    return { name: 'توجد فئة بهذا الاسم.' }
  }
  return {}
}

/** حصة عنصر (فئة أو حساب) من مجموع؛ تُعرض بأعمدة مرتبة. */
export type Share = {
  /** معرّف الفئة أو الحساب؛ null للعمليات التي بلا فئة. */
  id: string | null
  name: string
  amountMinor: number
  /** النسبة من مجموع النوع بهذه العملة، من 0 إلى 1. */
  share: number
}

/**
 * توزيع المصاريف (أو الدخل) على الفئات لعملة واحدة، من الأكبر إلى الأصغر.
 * لا تُخلط العملات: يُستدعى مرة لكل عملة.
 */
export function categoryBreakdown(
  transactions: Pick<Transaction, 'type' | 'currency' | 'categoryId' | 'amountMinor'>[],
  categories: Pick<Category, 'id' | 'name'>[],
  currency: Currency,
  kind: TransactionType = 'expense',
): Share[] {
  const relevant = transactions.filter((t) => t.type === kind && t.currency === currency)
  const total = relevant.reduce((sum, t) => sum + t.amountMinor, 0)
  if (total === 0) return []

  const byCategory = new Map<string | null, number>()
  for (const t of relevant) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amountMinor)

  const names = new Map(categories.map((c) => [c.id, c.name]))
  return [...byCategory]
    .map(([id, amountMinor]) => ({
      id,
      // فئة محذوفة نهائياً (غير متوقع) تُعرض كـ«بلا فئة» بدل أن تختفي.
      name: (id && names.get(id)) || 'بلا فئة',
      amountMinor,
      share: amountMinor / total,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}
