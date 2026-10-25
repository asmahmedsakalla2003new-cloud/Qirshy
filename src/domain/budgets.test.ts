import { describe, expect, it } from 'vitest'
import {
  amountFor,
  budgetStatus,
  changeAmount,
  clearOverride,
  levelCrossings,
  levelFor,
  shouldAlert,
  validateBudget,
  type Budget,
} from './budgets'
import type { Transaction } from './transactions'

function budget(partial: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    scope: 'overall',
    categoryId: null,
    currency: 'ILS',
    schedule: [{ from: '2026-10', amountMinor: 100000 }],
    overrides: {},
    dismissedAlerts: {},
    createdAt: 'x',
    updatedAt: 'x',
    ...partial,
  }
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    amountMinor: 1000,
    currency: 'ILS',
    accountId: 'cash',
    date: '2026-10-15',
    categoryId: 'food',
    description: '',
    createdAt: 'x',
    updatedAt: 'x',
    ...partial,
  }
}

describe('مبلغ الميزانية في كل شهر', () => {
  it('تتكرر تلقائياً بعد شهر البداية، ولا تسري قبله', () => {
    const b = budget()
    expect(amountFor(b, '2026-09')).toBeNull()
    expect(amountFor(b, '2026-10')).toBe(100000)
    expect(amountFor(b, '2027-03')).toBe(100000)
  })

  it('تغيير «هذا الشهر فقط» لا يمس بقية الأشهر', () => {
    const b = { ...budget(), ...changeAmount(budget(), '2026-12', 150000, 'month') }
    expect(amountFor(b, '2026-11')).toBe(100000)
    expect(amountFor(b, '2026-12')).toBe(150000)
    expect(amountFor(b, '2027-01')).toBe(100000)
    expect(amountFor({ ...b, ...clearOverride(b, '2026-12') }, '2026-12')).toBe(100000)
  })

  it('تغيير «هذا الشهر والقادمة» يحفظ الأشهر السابقة كما كانت', () => {
    let b = budget()
    b = { ...b, ...changeAmount(b, '2026-11', 50000, 'month') } // مبلغ خاص لتشرين الثاني
    b = { ...b, ...changeAmount(b, '2027-02', 200000, 'month') } // ومبلغ خاص لشباط
    b = { ...b, ...changeAmount(b, '2027-01', 120000, 'onward') }

    expect(amountFor(b, '2026-10')).toBe(100000)
    expect(amountFor(b, '2026-11')).toBe(50000) // الماضي لا يتغيّر
    expect(amountFor(b, '2026-12')).toBe(100000)
    expect(amountFor(b, '2027-01')).toBe(120000)
    expect(amountFor(b, '2027-02')).toBe(120000) // التخصيص المستقبلي صار قديماً فأُلغي
    expect(amountFor(b, '2028-06')).toBe(120000)
  })
})

describe('حدود التنبيه (80% و100%) بأعداد صحيحة', () => {
  it.each([
    [0, 'ok'],
    [79_99, 'ok'], // 79.99%
    [80_00, 'near'], // 80% بالضبط
    [99_99, 'near'],
    [100_00, 'over'], // 100% بالضبط = بلوغ الحد
    [100_01, 'over'],
    [250_00, 'over'],
  ])('صُرف %i من 10000 ← %s', (spent, level) => {
    expect(levelFor(spent, 100_00)).toBe(level)
  })

  it('لا تنخدع بكسور الأعداد العائمة: 80% من مبلغ فردي', () => {
    // 80% من 333.33 = 266.664 ← 266.66 أقل من 80%، و266.67 فوقها.
    expect(levelFor(26666, 33333)).toBe('ok')
    expect(levelFor(26667, 33333)).toBe('near')
  })
})

describe('budgetStatus', () => {
  const list = [
    tx({ amountMinor: 30000, categoryId: 'food' }),
    tx({ amountMinor: 20000, categoryId: 'transport' }),
    tx({ amountMinor: 99999, type: 'income', categoryId: null }), // الدخل لا يُحتسب
    tx({ amountMinor: 50000, currency: 'USD' }), // عملة أخرى
    tx({ amountMinor: 70000, date: '2026-09-30' }), // شهر آخر
    tx({ amountMinor: 1000, date: '2026-10-31' }), // آخر يوم في الشهر يُحتسب
  ]

  it('العامة تجمع كل مصاريف الشهر بعملتها فقط', () => {
    expect(budgetStatus(budget(), '2026-10', list)).toMatchObject({
      limitMinor: 100000,
      spentMinor: 51000,
      remainingMinor: 49000,
      level: 'ok',
    })
  })

  it('ميزانية الفئة تحسب فئتها فقط', () => {
    const food = budget({ scope: 'category', categoryId: 'food', schedule: [{ from: '2026-10', amountMinor: 35000 }] })
    const status = budgetStatus(food, '2026-10', list)!
    expect(status.spentMinor).toBe(31000) // 300 + 10 في آخر يوم
    expect(status.level).toBe('near')
  })

  it('التجاوز يعطي متبقياً سالباً', () => {
    const small = budget({ schedule: [{ from: '2026-10', amountMinor: 40000 }] })
    expect(budgetStatus(small, '2026-10', list)).toMatchObject({ remainingMinor: -11000, level: 'over' })
  })

  it('تعديل عملية أو حذفها يعيد الحساب', () => {
    const b = budget()
    const edited = list.map((t, i) => (i === 0 ? { ...t, amountMinor: 90000 } : t))
    expect(budgetStatus(b, '2026-10', edited)?.level).toBe('over')
    expect(budgetStatus(b, '2026-10', list.slice(1))?.spentMinor).toBe(21000)
  })
})

describe('التنبيهات لا تتكرر', () => {
  it('يُخفى التنبيه بعد إغلاقه لنفس المستوى، ويظهر «الحد» بعد إغلاق «الاقتراب»', () => {
    expect(shouldAlert(budget(), '2026-10', 'ok')).toBe(false)
    expect(shouldAlert(budget(), '2026-10', 'near')).toBe(true)
    const nearDismissed = budget({ dismissedAlerts: { '2026-10': 'near' } })
    expect(shouldAlert(nearDismissed, '2026-10', 'near')).toBe(false)
    expect(shouldAlert(nearDismissed, '2026-10', 'over')).toBe(true)
    expect(shouldAlert(nearDismissed, '2026-11', 'near')).toBe(true) // شهر جديد
    const overDismissed = budget({ dismissedAlerts: { '2026-10': 'over' } })
    expect(shouldAlert(overDismissed, '2026-10', 'near')).toBe(false)
  })

  it('levelCrossings يلتقط الارتفاع فقط', () => {
    const b = budget()
    const before = [tx({ amountMinor: 70000 })]
    expect(levelCrossings([b], '2026-10', before, [...before, tx({ amountMinor: 10000 })])).toEqual([
      { budget: b, level: 'near' },
    ])
    expect(levelCrossings([b], '2026-10', before, [...before, tx({ amountMinor: 5000 })])).toEqual([])
    const near = [tx({ amountMinor: 85000 })]
    expect(levelCrossings([b], '2026-10', near, [...near, tx({ amountMinor: 1000 })])).toEqual([]) // بقي «اقتراب»
    expect(levelCrossings([b], '2026-10', near, [...near, tx({ amountMinor: 15000 })])[0].level).toBe('over')
    expect(levelCrossings([b], '2026-10', near, [])).toEqual([]) // الحذف لا ينبّه
  })
})

describe('validateBudget', () => {
  const existing = [
    { scope: 'overall' as const, categoryId: null, currency: 'ILS' as const },
    { scope: 'category' as const, categoryId: 'food', currency: 'ILS' as const },
  ]

  it('ميزانية عامة واحدة لكل عملة، وواحدة لكل فئة وعملة', () => {
    expect(validateBudget({ scope: 'overall', categoryId: null, currency: 'ILS', amountMinor: 1 }, existing).categoryId).toMatch(
      'توجد ميزانية عامة',
    )
    expect(validateBudget({ scope: 'overall', categoryId: null, currency: 'USD', amountMinor: 1 }, existing)).toEqual({})
    expect(validateBudget({ scope: 'category', categoryId: 'food', currency: 'ILS', amountMinor: 1 }, existing).categoryId).toMatch(
      'لهذه الفئة',
    )
    expect(validateBudget({ scope: 'category', categoryId: 'food', currency: 'USD', amountMinor: 1 }, existing)).toEqual({})
  })

  it('يرفض المبلغ غير الموجب والفئة المفقودة', () => {
    expect(validateBudget({ scope: 'overall', categoryId: null, currency: 'USD', amountMinor: 0 }, []).amount).toBeTruthy()
    expect(validateBudget({ scope: 'category', categoryId: null, currency: 'USD', amountMinor: 5 }, []).categoryId).toBe('اختر الفئة.')
  })
})
