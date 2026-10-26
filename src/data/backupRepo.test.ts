import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupError, backupFilename, createBackupFile, parseBackup, summarizeBackup } from '../domain/backup'
import { todayISO } from '../domain/dates'
import { createAccount, listAccounts } from './accountsRepo'
import { exportBackup, markBackedUp, readBackupText, restoreBackup } from './backupRepo'
import { createBudget, setBudgetAmount } from './budgetsRepo'
import { createCategory, listCategories } from './categoriesRepo'
import { db } from './db'
import { addDebtPayment, createDebt } from './debtsRepo'
import { initDatabase } from './init'
import { createTransaction } from './transactionsRepo'
import { createTransfer } from './transfersRepo'

/** بيانات تجريبية تغطي كل الجداول (بيانات وهمية، لا شيء حقيقي). */
async function seed() {
  await initDatabase()
  await db.settings.update('app', { onboardedAt: '2026-10-01T00:00:00.000Z' })
  const [cash] = await listAccounts()
  const jp = await createAccount({ name: 'جوال باي', type: 'jawwalpay', currency: 'ILS', openingBalanceMinor: 15050 })
  const usd = await createAccount({ name: 'البنك', type: 'bank', currency: 'USD', openingBalanceMinor: 100000 })
  const custom = await createCategory({ name: 'رياضة', kind: 'expense' })
  const food = (await listCategories()).find((c) => c.name === 'بقالة وطعام')!
  await createTransaction({ type: 'expense', amountMinor: 12550, accountId: cash.id, date: todayISO(), categoryId: food.id, description: 'خبز، "حليب"\nوبيض' })
  await createTransaction({ type: 'expense', amountMinor: 3000, accountId: jp.id, date: todayISO(), categoryId: custom.id, description: '' })
  await createTransaction({ type: 'income', amountMinor: 500000, accountId: cash.id, date: todayISO(), categoryId: null, description: 'راتب' })
  await createTransfer({ fromAccountId: usd.id, toAccountId: cash.id, fromAmountMinor: 10000, toAmountMinor: 36500, date: todayISO(), description: 'صرف' })
  const budget = await createBudget({ scope: 'category', categoryId: food.id, currency: 'ILS', amountMinor: 80000 }, '2026-10')
  await setBudgetAmount(budget.id, '2026-12', 120000, 'month')
  const debt = await createDebt({ direction: 'owed_to_me', counterparty: 'أحمد', amountMinor: 50000, currency: 'ILS', date: todayISO(), dueDate: null, notes: '' })
  await addDebtPayment(debt.id, 20000, todayISO())
}

async function snapshot() {
  return (await exportBackup()).data
}

describe('النسخ الاحتياطي والاستعادة', () => {
  beforeEach(seed)
  afterEach(() => vi.restoreAllMocks())

  it('الملف يحمل الإصدار والتاريخ والبصمة، والاستعادة تعيد البيانات مطابقة تماماً', async () => {
    const file = await exportBackup()
    expect(file).toMatchObject({ app: 'qirsh', formatVersion: 1, schemaVersion: db.verno })
    expect(file.checksum).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(summarizeBackup(file).counts).toEqual({ accounts: 3, transactions: 3, transfers: 1, categories: 15, budgets: 1, debts: 1 })

    const original = await snapshot()
    // تغيير البيانات بعد النسخ: حذف كل شيء وإضافة غيره.
    await db.transactions.clear()
    await createAccount({ name: 'حساب جديد', type: 'palpay', currency: 'ILS', openingBalanceMinor: 1 })

    // عبر النص كما سيُحفظ في الملف ويُقرأ منه.
    const restored = await readBackupText(JSON.stringify(file, null, 2))
    await restoreBackup(restored)
    expect(await snapshot()).toEqual(original)
  })

  it('بعد الاستعادة لا تعود الشاشة الترحيبية ولا تُضاف الفئات الافتراضية فوق الفئات المستعادة', async () => {
    const file = await exportBackup()
    await restoreBackup(file)
    await initDatabase()
    expect((await db.settings.get('app'))?.onboardedAt).toBe('2026-10-01T00:00:00.000Z')
    expect(await db.categories.count()).toBe(15)
  })

  it('فشل الاستعادة في منتصفها لا يغيّر البيانات الحالية', async () => {
    const file = await exportBackup()
    await createAccount({ name: 'بعد النسخ', type: 'palpay', currency: 'ILS', openingBalanceMinor: 0 })
    const before = await snapshot()

    // فشل عند كتابة جدول الديون، بعد مسح الجداول وكتابة بعضها.
    const tableProto = Object.getPrototypeOf(db.debts) as { bulkAdd: (...args: unknown[]) => unknown }
    const original = tableProto.bulkAdd
    const spy = vi.spyOn(tableProto, 'bulkAdd').mockImplementation(function (this: { name: string }, ...args: unknown[]) {
      if (this.name === 'debts') return Promise.reject(new Error('انقطاع مفاجئ'))
      return original.apply(this, args)
    })
    await expect(restoreBackup(file)).rejects.toThrow('انقطاع مفاجئ')
    expect(spy).toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
  })

  it('يسجّل وقت آخر نسخة احتياطية', async () => {
    await markBackedUp('2026-10-26T10:00:00.000Z')
    expect((await db.settings.get('app'))?.lastBackupAt).toBe('2026-10-26T10:00:00.000Z')
  })
})

describe('رفض الملفات غير الصالحة قبل أي كتابة', () => {
  let valid: Awaited<ReturnType<typeof exportBackup>>
  beforeEach(async () => {
    await seed()
    valid = await exportBackup()
  })

  /** يعدّل البيانات ويعيد حساب البصمة، لاختبار التحقق من البنية لا من البصمة. */
  async function withData(mutate: (data: typeof valid.data) => void) {
    const data = structuredClone(valid.data)
    mutate(data)
    return JSON.stringify(await createBackupFile(data, valid.schemaVersion, valid.appVersion))
  }

  const rejects = (text: string, message: string) => expect(parseBackup(text, db.verno)).rejects.toThrow(message)

  it('ليس JSON، أو ليس من قِرْش', async () => {
    await rejects('<html>', 'لا يمكن قراءته')
    await rejects(JSON.stringify({ app: 'other', data: {} }), 'ليس نسخة احتياطية من قِرْش')
    await rejects('{}', 'ليس نسخة احتياطية من قِرْش')
  })

  it('من إصدار أحدث من التطبيق', async () => {
    await rejects(JSON.stringify({ ...valid, schemaVersion: db.verno + 1 }), 'إصدار أحدث')
    await rejects(JSON.stringify({ ...valid, formatVersion: 99 }), 'إصدار أحدث')
  })

  it('تالف أو عُدِّل يدوياً (البصمة لا تطابق)', async () => {
    const tampered = structuredClone(valid)
    tampered.data.transactions[0].amountMinor = 1
    await rejects(JSON.stringify(tampered), 'فشل التحقق من سلامته')
    // قصّ الملف (انقطاع أثناء الحفظ).
    const text = JSON.stringify(valid)
    await rejects(text.slice(0, text.length / 2), 'لا يمكن قراءته')
  })

  it('بيانات غير صالحة أو مترابطة بشكل خاطئ', async () => {
    await rejects(await withData((d) => (d.transactions[0].amountMinor = -5)), 'العمليات')
    await rejects(await withData((d) => (d.transactions[0].accountId = 'missing')), 'العمليات')
    await rejects(await withData((d) => (d.transactions[0].currency = 'EUR' as never)), 'العمليات')
    await rejects(await withData((d) => d.transactions.push(d.transactions[0])), 'معرّف مكرر')
    await rejects(await withData((d) => (d.transfers[0].toAccountId = d.transfers[0].fromAccountId)), 'التحويلات')
    await rejects(await withData((d) => (d.debtPayments[0].debtId = 'missing')), 'دفعات الديون')
    await rejects(await withData((d) => (d.accounts = [])), 'لا يوجد أي حساب')
    await rejects(await withData((d) => (d.settings = [])), 'إعدادات التطبيق مفقودة')
  })

  it('يقبل نسخة من إصدار أقدم ينقصها جداول أُضيفت لاحقاً', async () => {
    const old = await withData((d) => {
      const partial = d as Partial<typeof d>
      delete partial.transfers
      delete partial.budgets
      delete partial.debts
      delete partial.debtPayments
    })
    const parsed = await parseBackup(old.replace(`"schemaVersion":${db.verno}`, '"schemaVersion":3'), db.verno)
    expect(parsed.data.transfers).toEqual([])
    expect(parsed.data.transactions).toHaveLength(3)
  })

  it('الخطأ من نوع BackupError برسالة عربية', async () => {
    await expect(parseBackup('x', db.verno)).rejects.toBeInstanceOf(BackupError)
  })
})

describe('backupFilename', () => {
  it('بتاريخ اليوم المحلي', () => {
    expect(backupFilename('qirsh-backup', new Date(2026, 9, 6, 23, 30))).toBe('qirsh-backup-2026-10-06.json')
  })
})
