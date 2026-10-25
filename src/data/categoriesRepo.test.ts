import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayISO } from '../domain/dates'
import { listAccounts } from './accountsRepo'
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  setCategoryArchived,
} from './categoriesRepo'
import { db, QirshDB } from './db'
import { ValidationError } from './errors'
import { initDatabase } from './init'
import { createTransaction } from './transactionsRepo'

const namesOf = async (kind: 'expense' | 'income') =>
  (await listCategories()).filter((c) => c.kind === kind && !c.archived).map((c) => c.name)

describe('الفئات الافتراضية', () => {
  it('تُنشأ مرة واحدة عند أول تشغيل، و«أخرى» آخرها', async () => {
    await initDatabase()
    await initDatabase()
    const expense = await namesOf('expense')
    expect(expense).toHaveLength(10)
    expect(expense[0]).toBe('بقالة وطعام')
    expect(expense.at(-1)).toBe('أخرى')
    expect(await namesOf('income')).toEqual(['راتب', 'عمل حر', 'هدية', 'أخرى'])
  })

  it('لا تعود الفئة الافتراضية إذا حذفها المستخدم', async () => {
    await initDatabase()
    const gift = (await listCategories()).find((c) => c.name === 'هدية')!
    await deleteCategory(gift.id)
    await initDatabase()
    expect(await namesOf('income')).not.toContain('هدية')
  })
})

describe('categoriesRepo', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  it('الفئة الخاصة تُضاف قبل «أخرى»', async () => {
    await createCategory({ name: ' رياضة ', kind: 'expense' })
    const expense = await namesOf('expense')
    expect(expense.slice(-2)).toEqual(['رياضة', 'أخرى'])

    await createCategory({ name: 'إيجار عقار', kind: 'income' })
    expect(await namesOf('income')).toEqual(['راتب', 'عمل حر', 'هدية', 'إيجار عقار', 'أخرى'])
  })

  it('يمنع تكرار الاسم في النوع نفسه عند الإضافة وإعادة التسمية', async () => {
    await expect(createCategory({ name: 'مواصلات', kind: 'expense' })).rejects.toBeInstanceOf(ValidationError)
    const transport = (await listCategories()).find((c) => c.name === 'مواصلات')!
    await expect(renameCategory(transport.id, 'تعليم')).rejects.toThrow('توجد فئة بهذا الاسم')
    await renameCategory(transport.id, 'مواصلات عامة')
    expect(await namesOf('expense')).toContain('مواصلات عامة')
  })

  it('الفئة المستخدمة لا تُحذف لكن تُؤرشف وتُعاد', async () => {
    const [cash] = await listAccounts()
    const food = (await listCategories()).find((c) => c.name === 'بقالة وطعام')!
    await createTransaction({
      type: 'expense',
      amountMinor: 100,
      accountId: cash.id,
      date: todayISO(),
      categoryId: food.id,
      description: '',
    })

    await expect(deleteCategory(food.id)).rejects.toThrow('يمكنك أرشفتها')
    await setCategoryArchived(food.id, true)
    expect(await namesOf('expense')).not.toContain('بقالة وطعام')
    await setCategoryArchived(food.id, false)
    expect(await namesOf('expense')).toContain('بقالة وطعام')
  })

  it('العملية لا تقبل فئة من النوع الآخر', async () => {
    const [cash] = await listAccounts()
    const salary = (await listCategories()).find((c) => c.name === 'راتب')!
    await expect(
      createTransaction({
        type: 'expense',
        amountMinor: 100,
        accountId: cash.id,
        date: todayISO(),
        categoryId: salary.id,
        description: '',
      }),
    ).rejects.toThrow('الفئة المختارة لا تناسب نوع العملية')
  })
})

describe('الترقية من المرحلة 3 (الإصدار 2) إلى الإصدار 3', () => {
  it('تحافظ على العمليات وتضيف الفئات الافتراضية لمستخدم موجود', async () => {
    db.close()
    await Dexie.delete('qirsh-v2')
    const v2 = new Dexie('qirsh-v2')
    v2.version(1).stores({ settings: 'id', accounts: 'id, type, currency' })
    v2.version(2).stores({ transactions: 'id, date, accountId, type' })
    await v2.table('settings').add({ id: 'app', onboardedAt: 'x', lastBackupAt: null, createdAt: 'x' })
    await v2.table('transactions').add({ id: 't1', type: 'expense', amountMinor: 500, categoryId: null })
    v2.close()

    const v3 = new QirshDB('qirsh-v2')
    try {
      await v3.open()
      expect(v3.verno).toBe(3)
      expect(await v3.transactions.get('t1')).toMatchObject({ amountMinor: 500 })
      expect(await v3.categories.count()).toBe(0) // الترقية لا تُنشئ بيانات؛ initDatabase تفعل.
    } finally {
      v3.close()
      await Dexie.delete('qirsh-v2')
    }
  })

  it('initDatabase يضيف الفئات لمن لم تُنشأ لهم بعد', async () => {
    await initDatabase()
    await db.categories.clear()
    await db.settings.update('app', { categoriesSeeded: undefined })
    await initDatabase()
    expect(await db.categories.count()).toBe(14)
  })
})
