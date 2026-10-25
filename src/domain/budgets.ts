import type { Currency } from './money'
import { monthRange } from './months'
import type { Transaction } from './transactions'

/**
 * الميزانيات الشهرية. تتكرر تلقائياً كل شهر، ويمكن تغيير مبلغها:
 *  - لشهر واحد فقط (overrides)، أو
 *  - من شهر معيّن فصاعداً (schedule)، فتبقى الأشهر السابقة بمبالغها الأصلية.
 * لكل ميزانية عملة واحدة، ولا تُحتسب فيها إلا مصاريف تلك العملة.
 */
export type BudgetScope = 'overall' | 'category'

export type Budget = {
  id: string
  scope: BudgetScope
  /** للميزانية الخاصة بفئة مصروف؛ null للعامة. */
  categoryId: string | null
  currency: Currency
  /** المبلغ الشهري بدءاً من كل شهر، مرتباً تصاعدياً حسب الشهر (YYYY-MM). */
  schedule: { from: string; amountMinor: number }[]
  /** مبالغ خاصة بأشهر بعينها، تتقدّم على schedule. */
  overrides: Record<string, number>
  /** آخر مستوى تنبيه أغلقه المستخدم في كل شهر، حتى لا يتكرر. */
  dismissedAlerts: Record<string, AlertLevel>
  createdAt: string
  updatedAt: string
}

export type BudgetInput = Pick<Budget, 'scope' | 'categoryId' | 'currency'> & { amountMinor: number }

/** عتبة التنبيه بالاقتراب (80%). التجاوز عند 100%. */
export const NEAR_PERCENT = 80

export type AlertLevel = 'near' | 'over'
export type BudgetLevel = 'ok' | AlertLevel

/** مبلغ الميزانية في شهر معيّن، أو null إن لم تكن قد بدأت بعد. */
export function amountFor(budget: Pick<Budget, 'schedule' | 'overrides'>, month: string): number | null {
  if (month in budget.overrides) return budget.overrides[month]
  let amount: number | null = null
  for (const step of budget.schedule) {
    if (step.from <= month) amount = step.amountMinor
  }
  return amount
}

export type AmountChangeMode = 'month' | 'onward'

/**
 * يغيّر مبلغ الميزانية:
 *  - 'month': لهذا الشهر فقط.
 *  - 'onward': لهذا الشهر وما بعده؛ تُلغى التغييرات المستقبلية السابقة لأنها صارت قديمة،
 *    وتبقى الأشهر الماضية كما كانت.
 */
export function changeAmount(
  budget: Pick<Budget, 'schedule' | 'overrides'>,
  month: string,
  amountMinor: number,
  mode: AmountChangeMode,
): Pick<Budget, 'schedule' | 'overrides'> {
  if (mode === 'month') {
    return { schedule: budget.schedule, overrides: { ...budget.overrides, [month]: amountMinor } }
  }
  const schedule = [...budget.schedule.filter((s) => s.from < month), { from: month, amountMinor }]
  const overrides = Object.fromEntries(Object.entries(budget.overrides).filter(([m]) => m < month))
  return { schedule, overrides }
}

/** يلغي المبلغ الخاص بشهر، فيعود إلى المبلغ المعتاد. */
export function clearOverride(budget: Pick<Budget, 'schedule' | 'overrides'>, month: string) {
  const overrides = { ...budget.overrides }
  delete overrides[month]
  return { schedule: budget.schedule, overrides }
}

export type BudgetStatus = {
  limitMinor: number
  spentMinor: number
  /** سالب عند التجاوز. */
  remainingMinor: number
  /** النسبة المئوية المستهلكة (للعرض فقط؛ المستوى يُحسب بأعداد صحيحة). */
  percent: number
  level: BudgetLevel
}

/** المستوى بأعداد صحيحة لتجنّب أخطاء الكسور عند الحدود (79.99% ليست 80%). */
export function levelFor(spentMinor: number, limitMinor: number): BudgetLevel {
  if (spentMinor >= limitMinor) return 'over'
  if (spentMinor * 100 >= limitMinor * NEAR_PERCENT) return 'near'
  return 'ok'
}

/**
 * حالة الميزانية في شهر: المصروف هو مصاريف الشهر بعملة الميزانية
 * (كلها للعامة، أو فئتها فقط). الدخل والتحويلات لا تُحتسب.
 */
export function budgetStatus(
  budget: Budget,
  month: string,
  transactions: Pick<Transaction, 'type' | 'currency' | 'categoryId' | 'date' | 'amountMinor'>[],
): BudgetStatus | null {
  const limitMinor = amountFor(budget, month)
  if (limitMinor === null) return null
  const { from, to } = monthRange(month)
  const spentMinor = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.currency === budget.currency &&
        t.date >= from &&
        t.date <= to &&
        (budget.scope === 'overall' || t.categoryId === budget.categoryId),
    )
    .reduce((sum, t) => sum + t.amountMinor, 0)

  return {
    limitMinor,
    spentMinor,
    remainingMinor: limitMinor - spentMinor,
    percent: limitMinor > 0 ? (spentMinor / limitMinor) * 100 : 0,
    level: levelFor(spentMinor, limitMinor),
  }
}

/** هل يجب عرض تنبيه؟ يُعرض لكل مستوى مرة واحدة: إغلاق «اقتراب» لا يُخفي «تجاوز» لاحقاً. */
export function shouldAlert(budget: Pick<Budget, 'dismissedAlerts'>, month: string, level: BudgetLevel): boolean {
  if (level === 'ok') return false
  const dismissed = budget.dismissedAlerts[month]
  return !(dismissed === level || dismissed === 'over')
}

export function validateBudget(
  input: BudgetInput,
  others: Pick<Budget, 'scope' | 'categoryId' | 'currency'>[],
): Partial<Record<'amount' | 'categoryId', string>> {
  const errors: Partial<Record<'amount' | 'categoryId', string>> = {}
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    errors.amount = 'يجب أن يكون مبلغ الميزانية أكبر من صفر.'
  }
  if (input.scope === 'category' && !input.categoryId) errors.categoryId = 'اختر الفئة.'
  const duplicate = others.some(
    (b) =>
      b.currency === input.currency &&
      b.scope === input.scope &&
      (input.scope === 'overall' || b.categoryId === input.categoryId),
  )
  if (duplicate) {
    errors.categoryId =
      input.scope === 'overall'
        ? 'توجد ميزانية عامة بهذه العملة. عدّلها بدل إضافة أخرى.'
        : 'توجد ميزانية لهذه الفئة بهذه العملة. عدّلها بدل إضافة أخرى.'
  }
  return errors
}

const levelRank: Record<BudgetLevel, number> = { ok: 0, near: 1, over: 2 }

/**
 * الميزانيات التي ارتفع مستواها بين حالتين (قبل حفظ عملية وبعده)،
 * لعرض تنبيه فوري عند الاقتراب أو التجاوز.
 */
export function levelCrossings(
  budgets: Budget[],
  month: string,
  before: Parameters<typeof budgetStatus>[2],
  after: Parameters<typeof budgetStatus>[2],
): { budget: Budget; level: AlertLevel }[] {
  const crossings: { budget: Budget; level: AlertLevel }[] = []
  for (const budget of budgets) {
    const was = budgetStatus(budget, month, before)?.level ?? 'ok'
    const now = budgetStatus(budget, month, after)?.level ?? 'ok'
    if (now !== 'ok' && levelRank[now] > levelRank[was]) crossings.push({ budget, level: now })
  }
  return crossings
}
