import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { amountFor } from '../domain/budgets'
import { createBudget, deleteBudget, dismissBudgetAlert, getBudget, listBudgets, resetBudgetMonth, setBudgetAmount } from './budgetsRepo'
import { deleteCategory, listCategories } from './categoriesRepo'
import { db, QirshDB } from './db'
import { initDatabase } from './init'

const categoryId = async (name: string) => (await listCategories()).find((c) => c.name === name)!.id

describe('budgetsRepo', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  it('ينشئ ميزانية تبدأ من الشهر المحدد، ويمنع التكرار', async () => {
    const b = await createBudget({ scope: 'overall', categoryId: null, currency: 'ILS', amountMinor: 200000 }, '2026-10')
    expect(amountFor(b, '2026-10')).toBe(200000)
    expect(amountFor(b, '2026-09')).toBeNull()
    await expect(
      createBudget({ scope: 'overall', categoryId: null, currency: 'ILS', amountMinor: 1 }, '2026-10'),
    ).rejects.toThrow('توجد ميزانية عامة')
  })

  it('ميزانية الفئة لفئة مصروف فقط', async () => {
    await expect(
      createBudget({ scope: 'category', categoryId: await categoryId('راتب'), currency: 'ILS', amountMinor: 1 }),
    ).rejects.toThrow('لفئة مصروف فقط')
  })

  it('تغيير المبلغ لشهر واحد ثم العودة للمعتاد، وتغييره للقادم', async () => {
    const { id } = await createBudget({ scope: 'overall', categoryId: null, currency: 'USD', amountMinor: 1000 }, '2026-10')
    await setBudgetAmount(id, '2026-11', 3000, 'month')
    let b = (await getBudget(id))!
    expect([amountFor(b, '2026-10'), amountFor(b, '2026-11'), amountFor(b, '2026-12')]).toEqual([1000, 3000, 1000])

    await resetBudgetMonth(id, '2026-11')
    b = (await getBudget(id))!
    expect(amountFor(b, '2026-11')).toBe(1000)

    await setBudgetAmount(id, '2026-12', 5000, 'onward')
    b = (await getBudget(id))!
    expect([amountFor(b, '2026-11'), amountFor(b, '2026-12'), amountFor(b, '2027-05')]).toEqual([1000, 5000, 5000])

    await expect(setBudgetAmount(id, '2026-12', 0, 'month')).rejects.toThrow('أكبر من صفر')
  })

  it('يحفظ إغلاق التنبيه لكل شهر', async () => {
    const { id } = await createBudget({ scope: 'overall', categoryId: null, currency: 'ILS', amountMinor: 1000 })
    await dismissBudgetAlert(id, '2026-10', 'near')
    expect((await getBudget(id))!.dismissedAlerts).toEqual({ '2026-10': 'near' })
  })

  it('لا تُحذف فئة لها ميزانية، وتُحذف بعد حذف الميزانية', async () => {
    const fun = await categoryId('ترفيه ومطاعم')
    const { id } = await createBudget({ scope: 'category', categoryId: fun, currency: 'ILS', amountMinor: 1000 })
    await expect(deleteCategory(fun)).rejects.toThrow('لهذه الفئة ميزانية')
    await deleteBudget(id)
    await deleteCategory(fun)
    expect(await listBudgets()).toHaveLength(0)
  })
})

describe('الترقية من الإصدار 3 إلى أحدث إصدار', () => {
  it('تحافظ على البيانات وتضيف جدول الميزانيات', async () => {
    db.close()
    await Dexie.delete('qirsh-v3')
    const v3 = new Dexie('qirsh-v3')
    v3.version(1).stores({ settings: 'id', accounts: 'id, type, currency' })
    v3.version(2).stores({ transactions: 'id, date, accountId, type' })
    v3.version(3).stores({ categories: 'id, kind', transactions: 'id, date, accountId, type, categoryId' })
    await v3.table('categories').add({ id: 'c1', name: 'رياضة', kind: 'expense' })
    v3.close()

    const v4 = new QirshDB('qirsh-v3')
    try {
      await v4.open()
      expect(v4.verno).toBe(db.verno)
      expect(await v4.categories.get('c1')).toMatchObject({ name: 'رياضة' })
      expect(await v4.budgets.count()).toBe(0)
    } finally {
      v4.close()
      await Dexie.delete('qirsh-v3')
    }
  })
})
