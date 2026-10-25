import { describe, expect, it } from 'vitest'
import { countLabel, transactionForms } from './arabic'
import { categoryBreakdown, validateCategory } from './categories'
import { currentMonth, formatMonth, monthRange, shiftMonth } from './months'
import { filterTransactions, NO_CATEGORY, type Transaction } from './transactions'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    amountMinor: 1000,
    currency: 'ILS',
    accountId: 'cash',
    date: '2026-10-20',
    categoryId: null,
    description: '',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    ...partial,
  }
}

const categories = [
  { id: 'food', name: 'بقالة وطعام' },
  { id: 'transport', name: 'مواصلات' },
  { id: 'salary', name: 'راتب' },
]

describe('validateCategory', () => {
  const existing = [{ name: 'مواصلات', kind: 'expense' as const }]

  it('يقبل اسماً جديداً، ويسمح بالاسم نفسه في النوع الآخر', () => {
    expect(validateCategory({ name: 'رياضة', kind: 'expense' }, existing)).toEqual({})
    expect(validateCategory({ name: 'مواصلات', kind: 'income' }, existing)).toEqual({})
  })

  it('يرفض الفارغ والطويل والمكرر في النوع نفسه', () => {
    expect(validateCategory({ name: '  ', kind: 'expense' }, existing).name).toBe('أدخل اسم الفئة.')
    expect(validateCategory({ name: 'ا'.repeat(31), kind: 'expense' }, existing).name).toMatch('الاسم طويل')
    expect(validateCategory({ name: ' مواصلات ', kind: 'expense' }, existing).name).toBe('توجد فئة بهذا الاسم.')
  })
})

describe('categoryBreakdown', () => {
  const list = [
    tx({ categoryId: 'food', amountMinor: 30000 }),
    tx({ categoryId: 'food', amountMinor: 10000 }),
    tx({ categoryId: 'transport', amountMinor: 10000 }),
    tx({ categoryId: null, amountMinor: 50 }),
    tx({ categoryId: 'food', amountMinor: 99999, currency: 'USD' }),
    tx({ categoryId: 'salary', amountMinor: 500000, type: 'income' }),
  ]

  it('يجمع المصاريف حسب الفئة لعملة واحدة، من الأكبر، مع «بلا فئة»', () => {
    const result = categoryBreakdown(list, categories, 'ILS')
    expect(result.map((r) => [r.categoryId, r.name, r.amountMinor])).toEqual([
      ['food', 'بقالة وطعام', 40000],
      ['transport', 'مواصلات', 10000],
      [null, 'بلا فئة', 50],
    ])
    expect(result.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1)
    expect(result[0].share).toBeCloseTo(40000 / 50050)
  })

  it('لا يخلط العملات ولا يحسب الدخل مع المصروف', () => {
    expect(categoryBreakdown(list, categories, 'USD')).toEqual([
      { categoryId: 'food', name: 'بقالة وطعام', amountMinor: 99999, share: 1 },
    ])
    expect(categoryBreakdown(list, categories, 'ILS', 'income').map((r) => r.name)).toEqual(['راتب'])
  })

  it('يعيد قائمة فارغة إن لم توجد مصاريف', () => {
    expect(categoryBreakdown([], categories, 'ILS')).toEqual([])
  })
})

describe('filterTransactions حسب الفئة', () => {
  const list = [
    tx({ id: 'a', categoryId: 'food' }),
    tx({ id: 'b', categoryId: null }),
    tx({ id: 'c', categoryId: 'transport', description: 'باص' }),
  ]

  it('يصفّي بفئة محددة أو «بلا فئة»', () => {
    expect(filterTransactions(list, { categoryId: 'food' }).map((t) => t.id)).toEqual(['a'])
    expect(filterTransactions(list, { categoryId: NO_CATEGORY }).map((t) => t.id)).toEqual(['b'])
  })

  it('البحث يشمل اسم الفئة', () => {
    const names = { food: 'بقالة وطعام', transport: 'مواصلات' }
    expect(filterTransactions(list, { query: 'بقاله' }, names).map((t) => t.id)).toEqual(['a'])
  })
})

describe('months', () => {
  it('يحسب الشهر الحالي والتنقل بين الأشهر عبر السنوات', () => {
    expect(currentMonth(new Date(2026, 9, 25))).toBe('2026-10')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('حدود الشهر شاملة، مع شباط في السنة الكبيسة', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthRange('2026-02').to).toBe('2026-02-28')
  })

  it('يعرض اسم الشهر بالتسمية الشامية', () => {
    expect(formatMonth('2026-10')).toBe('تشرين الأول 2026')
  })
})

describe('countLabel', () => {
  it.each([
    [0, '0 عمليات'],
    [1, 'عملية واحدة'],
    [2, 'عمليتان'],
    [3, '3 عمليات'],
    [10, '10 عمليات'],
    [11, '11 عملية'],
    [100, '100 عملية'],
  ])('%i ← %s', (n, label) => {
    expect(countLabel(n, transactionForms)).toBe(label)
  })
})
