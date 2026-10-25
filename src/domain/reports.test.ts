import { describe, expect, it } from 'vitest'
import { accountBreakdown, buildCsv, csvCell, monthlyTotals, monthsBetween, periodRange } from './reports'
import type { Transaction } from './transactions'
import type { Transfer } from './transfers'

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    amountMinor: 1000,
    currency: 'ILS',
    accountId: 'cash',
    date: '2026-10-10',
    categoryId: null,
    description: '',
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: 'x',
    ...p,
  }
}

describe('الفترات', () => {
  it('هذا الشهر، وآخر 3 و6 أشهر عبر حدود السنة، وهذه السنة', () => {
    expect(periodRange('month', '2026-10-25')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('3months', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-28' })
    expect(periodRange('6months', '2026-10-25')).toEqual({ from: '2026-05-01', to: '2026-10-31' })
    expect(periodRange('year', '2026-10-25')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('الفترة المخصصة، وقيمها الافتراضية', () => {
    expect(periodRange('custom', '2026-10-25', { from: '2026-03-05', to: '2026-04-20' })).toEqual({ from: '2026-03-05', to: '2026-04-20' })
    expect(periodRange('custom', '2026-10-25')).toEqual({ from: '2026-10-01', to: '2026-10-25' })
  })

  it('monthsBetween', () => {
    expect(monthsBetween('2025-11-15', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsBetween('2026-10-01', '2026-10-31')).toEqual(['2026-10'])
  })
})

describe('monthlyTotals', () => {
  it('لكل شهر بعملة واحدة، والأشهر الفارغة أصفار، وما خارج الفترة لا يُحتسب', () => {
    const list = [
      tx({ date: '2026-08-05', type: 'income', amountMinor: 500000 }),
      tx({ date: '2026-08-20', amountMinor: 12000 }),
      tx({ date: '2026-10-01', amountMinor: 3000 }),
      tx({ date: '2026-10-01', amountMinor: 9999, currency: 'USD' }),
      tx({ date: '2026-07-31', amountMinor: 77777 }), // قبل الفترة
    ]
    expect(monthlyTotals(list, 'ILS', '2026-08-01', '2026-10-31')).toEqual([
      { month: '2026-08', incomeMinor: 500000, expenseMinor: 12000, netMinor: 488000 },
      { month: '2026-09', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
      { month: '2026-10', incomeMinor: 0, expenseMinor: 3000, netMinor: -3000 },
    ])
  })

  it('يحترم حدود الفترة المخصصة داخل الشهر', () => {
    const list = [tx({ date: '2026-10-02' }), tx({ date: '2026-10-20' })]
    expect(monthlyTotals(list, 'ILS', '2026-10-10', '2026-10-31')[0].expenseMinor).toBe(1000)
  })
})

describe('accountBreakdown', () => {
  it('المصاريف حسب الحساب لعملة واحدة، من الأكبر', () => {
    const list = [
      tx({ accountId: 'cash', amountMinor: 3000 }),
      tx({ accountId: 'jp', amountMinor: 7000 }),
      tx({ accountId: 'jp', amountMinor: 5000, type: 'income' }),
      tx({ accountId: 'usd', amountMinor: 1, currency: 'USD' }),
    ]
    const result = accountBreakdown(list, [{ id: 'cash', name: 'نقد' }, { id: 'jp', name: 'جوال باي' }], 'ILS')
    expect(result).toEqual([
      { id: 'jp', name: 'جوال باي', amountMinor: 7000, share: 0.7 },
      { id: 'cash', name: 'نقد', amountMinor: 3000, share: 0.3 },
    ])
  })
})

describe('CSV', () => {
  it('csvCell يحيط بالتنصيص عند الحاجة ويعطّل الصيغ', () => {
    expect(csvCell('بقالة')).toBe('بقالة')
    expect(csvCell('خبز، حليب, بيض')).toBe('"خبز، حليب, بيض"')
    expect(csvCell('قال "مرحبا"')).toBe('"قال ""مرحبا"""')
    expect(csvCell('سطر\nثانٍ')).toBe('"سطر\nثانٍ"')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+972')).toBe("'+972")
    expect(csvCell('@sum')).toBe("'@sum")
  })

  it('buildCsv: BOM وعنوان، العمليات والتحويلات في الفترة، الأقدم أولاً', () => {
    const transfer: Transfer = {
      id: 'tr',
      fromAccountId: 'usd',
      toAccountId: 'cash',
      fromAmountMinor: 10000,
      toAmountMinor: 36500,
      fromCurrency: 'USD',
      toCurrency: 'ILS',
      date: '2026-10-05',
      description: 'صرف',
      createdAt: '2026-10-05T09:00:00.000Z',
      updatedAt: 'x',
    }
    const csv = buildCsv(
      [
        tx({ date: '2026-10-12', amountMinor: 12550, categoryId: 'food', description: 'خبز، حليب' }),
        tx({ date: '2026-10-01', type: 'income', amountMinor: 500000, description: 'راتب' }),
        tx({ date: '2026-11-01', description: 'خارج الفترة' }),
      ],
      [transfer],
      { cash: 'نقد', usd: 'البنك $', food: 'بقالة وطعام' },
      '2026-10-01',
      '2026-10-31',
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines).toEqual([
      'التاريخ,النوع,المبلغ,العملة,الحساب,إلى حساب,المبلغ الواصل,عملة الوصول,الفئة,الوصف',
      '2026-10-01,دخل,5000.00,ILS,نقد,,,,,راتب',
      '2026-10-05,تحويل,100.00,USD,البنك $,نقد,365.00,ILS,,صرف',
      // الفاصلة العربية «،» ليست فاصل CSV فلا تحتاج تنصيصاً.
      '2026-10-12,مصروف,125.50,ILS,نقد,,,,بقالة وطعام,خبز، حليب',
    ])
  })
})
