import { describe, expect, it } from 'vitest'
import { accountBalance } from './accounts'
import {
  filterTransactions,
  groupByDate,
  sortTransactions,
  summarize,
  validateTransaction,
  type Transaction,
  type TransactionInput,
} from './transactions'

let seq = 0
function tx(partial: Partial<Transaction>): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    type: 'expense',
    amountMinor: 1000,
    currency: 'ILS',
    accountId: 'cash',
    date: '2026-10-20',
    categoryId: null,
    description: '',
    createdAt: `2026-10-20T10:00:${String(seq).padStart(2, '0')}.000Z`,
    updatedAt: `2026-10-20T10:00:${String(seq).padStart(2, '0')}.000Z`,
    ...partial,
  }
}

const valid: TransactionInput = {
  type: 'expense',
  amountMinor: 12550,
  accountId: 'cash',
  date: '2026-10-20',
  categoryId: null,
  description: 'بقالة',
}

describe('validateTransaction', () => {
  const today = '2026-10-25'

  it('يقبل عملية صحيحة، وتاريخ اليوم', () => {
    expect(validateTransaction(valid, today)).toEqual({})
    expect(validateTransaction({ ...valid, date: today }, today)).toEqual({})
  })

  it.each([
    [{ amountMinor: 0 }, 'amount'],
    [{ amountMinor: -5 }, 'amount'],
    [{ amountMinor: 1.5 }, 'amount'],
    [{ accountId: '' }, 'accountId'],
    [{ date: '2026-02-30' }, 'date'],
    [{ date: '2026-10-26' }, 'date'],
    [{ description: 'ا'.repeat(201) }, 'description'],
    [{ type: 'transfer' as never }, 'type'],
  ])('يرفض %o في الحقل %s', (patch, field) => {
    expect(validateTransaction({ ...valid, ...patch }, today)).toHaveProperty(field)
  })
})

describe('accountBalance', () => {
  it('الرصيد = الافتتاحي + الدخل − المصروف، لعمليات الحساب فقط', () => {
    const transactions = [
      tx({ type: 'income', amountMinor: 500000 }),
      tx({ type: 'expense', amountMinor: 12550 }),
      tx({ type: 'expense', amountMinor: 99 }),
      tx({ type: 'income', amountMinor: 777, accountId: 'bank' }),
    ]
    expect(accountBalance({ id: 'cash', openingBalanceMinor: 10000 }, transactions)).toBe(10000 + 500000 - 12550 - 99)
    expect(accountBalance({ id: 'bank', openingBalanceMinor: 0 }, transactions)).toBe(777)
    expect(accountBalance({ id: 'empty', openingBalanceMinor: -300 }, transactions)).toBe(-300)
  })
})

describe('summarize', () => {
  it('يجمع كل عملة وحدها ولا يخلط الشيكل بالدولار', () => {
    const result = summarize([
      tx({ type: 'income', amountMinor: 100000, currency: 'ILS' }),
      tx({ type: 'expense', amountMinor: 2550, currency: 'ILS' }),
      tx({ type: 'expense', amountMinor: 1000, currency: 'USD' }),
    ])
    expect(result).toEqual([
      { currency: 'ILS', incomeMinor: 100000, expenseMinor: 2550, netMinor: 97450 },
      { currency: 'USD', incomeMinor: 0, expenseMinor: 1000, netMinor: -1000 },
    ])
  })

  it('لا يعيد شيئاً عند عدم وجود عمليات', () => {
    expect(summarize([])).toEqual([])
  })

  it('يجمع الكسور بدقة دون أخطاء الأعداد العائمة', () => {
    const many = Array.from({ length: 10 }, () => tx({ amountMinor: 10, type: 'income' }))
    expect(summarize(many)[0].incomeMinor).toBe(100) // 10 × 0.10 = 1.00 بالضبط
  })
})

describe('filterTransactions', () => {
  const list = [
    tx({ id: 'a', description: 'بقالة الأمانة', amountMinor: 12550, date: '2026-10-01' }),
    tx({ id: 'b', description: 'راتب', type: 'income', amountMinor: 500000, accountId: 'bank', date: '2026-10-10' }),
    tx({ id: 'c', description: 'فاتورة كهرباء', amountMinor: 30000, date: '2026-10-20' }),
  ]
  const ids = (f: Parameters<typeof filterTransactions>[1], names = {}) =>
    filterTransactions(list, f, names).map((t) => t.id)

  it('بلا تصفية يعيد الكل', () => {
    expect(ids({})).toEqual(['a', 'b', 'c'])
  })

  it('يصفّي حسب النوع والحساب والفترة (شاملة للحدّين)', () => {
    expect(ids({ type: 'income' })).toEqual(['b'])
    expect(ids({ accountId: 'cash' })).toEqual(['a', 'c'])
    expect(ids({ from: '2026-10-10', to: '2026-10-20' })).toEqual(['b', 'c'])
    expect(ids({ from: '2026-10-02', to: '2026-10-09' })).toEqual([])
  })

  it('البحث يتجاهل الهمزات والتاء المربوطة ويقبل الأرقام العربية', () => {
    expect(ids({ query: 'الامانه' })).toEqual(['a'])
    expect(ids({ query: 'كهرباء' })).toEqual(['c'])
    expect(ids({ query: '١٢٥' })).toEqual(['a'])
    expect(ids({ query: '125.50' })).toEqual(['a'])
  })

  it('البحث يشمل اسم الحساب', () => {
    expect(ids({ query: 'بنك' }, { bank: 'بنك فلسطين', cash: 'نقد' })).toEqual(['b'])
  })
})

describe('sortTransactions و groupByDate', () => {
  it('الأحدث تاريخاً أولاً، ثم الأحدث إضافة في اليوم نفسه', () => {
    const first = tx({ id: 'old-day', date: '2026-10-01' })
    const morning = tx({ id: 'morning', date: '2026-10-05' })
    const evening = tx({ id: 'evening', date: '2026-10-05' })
    const sorted = sortTransactions([first, morning, evening])
    expect(sorted.map((t) => t.id)).toEqual(['evening', 'morning', 'old-day'])
    expect(groupByDate(sorted).map((g) => [g.date, g.items.length])).toEqual([
      ['2026-10-05', 2],
      ['2026-10-01', 1],
    ])
  })
})
