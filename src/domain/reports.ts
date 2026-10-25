import type { Account } from './accounts'
import type { Share } from './categories'
import { todayISO } from './dates'
import type { Currency } from './money'
import { currentMonth, monthRange, shiftMonth } from './months'
import type { Transaction, TransactionType } from './transactions'
import type { Transfer } from './transfers'

/**
 * التقارير: كل الأرقام لعملة واحدة في كل مرة، والتحويلات والديون خارجها
 * (ليست دخلاً ولا مصروفاً).
 */
export const PERIODS = ['month', '3months', '6months', 'year', 'custom'] as const
export type Period = (typeof PERIODS)[number]

export const periodLabels: Record<Period, string> = {
  month: 'هذا الشهر',
  '3months': 'آخر 3 أشهر',
  '6months': 'آخر 6 أشهر',
  year: 'هذه السنة',
  custom: 'فترة مخصصة',
}

/** حدود الفترة YYYY-MM-DD شاملة. الأشهر الأخيرة تشمل الشهر الحالي. */
export function periodRange(period: Period, today = todayISO(), custom?: { from?: string; to?: string }) {
  const month = currentMonth(new Date(`${today}T12:00:00`))
  switch (period) {
    case 'month':
      return monthRange(month)
    case '3months':
      return { from: monthRange(shiftMonth(month, -2)).from, to: monthRange(month).to }
    case '6months':
      return { from: monthRange(shiftMonth(month, -5)).from, to: monthRange(month).to }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
    case 'custom':
      return { from: custom?.from || monthRange(month).from, to: custom?.to || today }
  }
}

/** الأشهر (YYYY-MM) التي تقع فيها الفترة، بالترتيب. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = []
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftMonth(m, 1)) months.push(m)
  return months
}

export type MonthTotals = { month: string; incomeMinor: number; expenseMinor: number; netMinor: number }

/** الدخل والمصروف لكل شهر في الفترة لعملة واحدة؛ الأشهر الفارغة تظهر بأصفار. */
export function monthlyTotals(
  transactions: Pick<Transaction, 'type' | 'currency' | 'date' | 'amountMinor'>[],
  currency: Currency,
  from: string,
  to: string,
): MonthTotals[] {
  return monthsBetween(from, to).map((month) => {
    const inMonth = transactions.filter(
      (t) => t.currency === currency && t.date.startsWith(month) && t.date >= from && t.date <= to,
    )
    const incomeMinor = inMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinor, 0)
    const expenseMinor = inMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountMinor, 0)
    return { month, incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor }
  })
}

/** توزيع المصروف (أو الدخل) على الحسابات لعملة واحدة، من الأكبر. */
export function accountBreakdown(
  transactions: Pick<Transaction, 'type' | 'currency' | 'accountId' | 'amountMinor'>[],
  accounts: Pick<Account, 'id' | 'name'>[],
  currency: Currency,
  kind: TransactionType = 'expense',
): Share[] {
  const relevant = transactions.filter((t) => t.type === kind && t.currency === currency)
  const total = relevant.reduce((s, t) => s + t.amountMinor, 0)
  if (total === 0) return []
  const byAccount = new Map<string, number>()
  for (const t of relevant) byAccount.set(t.accountId, (byAccount.get(t.accountId) ?? 0) + t.amountMinor)
  const names = new Map(accounts.map((a) => [a.id, a.name]))
  return [...byAccount]
    .map(([id, amountMinor]) => ({ id, name: names.get(id) ?? 'حساب محذوف', amountMinor, share: amountMinor / total }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}

// ===== تصدير CSV =====

/**
 * خلية CSV آمنة: تُحاط بعلامات تنصيص عند الحاجة، وتُعطَّل الصيغ
 * (النص الذي يبدأ بـ = + - @) حتى لا تُنفَّذ عند فتح الملف في Excel.
 */
export function csvCell(value: string): string {
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

const decimal = (minor: number) => (minor / 100).toFixed(2)

/**
 * ملف CSV للعمليات والتحويلات في الفترة، الأقدم أولاً. يبدأ بعلامة BOM
 * ليعرض Excel الحروف العربية بشكل صحيح. المبالغ موجبة بنقطة عشرية، والنوع في عمود مستقل.
 */
export function buildCsv(
  transactions: Transaction[],
  transfers: Transfer[],
  names: Record<string, string>,
  from: string,
  to: string,
): string {
  const header = ['التاريخ', 'النوع', 'المبلغ', 'العملة', 'الحساب', 'إلى حساب', 'المبلغ الواصل', 'عملة الوصول', 'الفئة', 'الوصف']
  const typeNames: Record<TransactionType, string> = { expense: 'مصروف', income: 'دخل' }
  const inRange = (date: string) => date >= from && date <= to

  const rows: { date: string; createdAt: string; cells: string[] }[] = [
    ...transactions.filter((t) => inRange(t.date)).map((t) => ({
      date: t.date,
      createdAt: t.createdAt,
      cells: [
        t.date,
        typeNames[t.type],
        decimal(t.amountMinor),
        t.currency,
        names[t.accountId] ?? '',
        '',
        '',
        '',
        t.categoryId ? (names[t.categoryId] ?? '') : '',
        t.description,
      ],
    })),
    ...transfers.filter((t) => inRange(t.date)).map((t) => ({
      date: t.date,
      createdAt: t.createdAt,
      cells: [
        t.date,
        'تحويل',
        decimal(t.fromAmountMinor),
        t.fromCurrency,
        names[t.fromAccountId] ?? '',
        names[t.toAccountId] ?? '',
        decimal(t.toAmountMinor),
        t.toCurrency,
        '',
        t.description,
      ],
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  const lines = [header, ...rows.map((r) => r.cells)].map((cells) => cells.map(csvCell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
