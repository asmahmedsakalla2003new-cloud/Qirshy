import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountBalance } from '../domain/accounts'
import { todayISO } from '../domain/dates'
import type { TransactionInput } from '../domain/transactions'
import { createAccount, deleteAccount, listAccounts, updateAccount } from './accountsRepo'
import { db, QirshDB } from './db'
import { ValidationError } from './errors'
import { initDatabase } from './init'
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from './transactionsRepo'

let cashId: string

function input(patch: Partial<TransactionInput> = {}): TransactionInput {
  return {
    type: 'expense',
    amountMinor: 12550,
    accountId: cashId,
    date: todayISO(),
    categoryId: null,
    description: ' بقالة ',
    ...patch,
  }
}

async function balanceOf(accountId: string) {
  const account = (await listAccounts()).find((a) => a.id === accountId)!
  return accountBalance(account, await listTransactions())
}

describe('transactionsRepo', () => {
  beforeEach(async () => {
    await initDatabase()
    cashId = (await listAccounts())[0].id
  })

  it('يضيف العملية بعملة حسابها وينظّف الوصف، والرصيد يتحدّث', async () => {
    const t = await createTransaction(input())
    expect(t).toMatchObject({ currency: 'ILS', description: 'بقالة', amountMinor: 12550 })
    expect(await balanceOf(cashId)).toBe(-12550)

    await createTransaction(input({ type: 'income', amountMinor: 100000 }))
    expect(await balanceOf(cashId)).toBe(100000 - 12550)
  })

  it('العملة تُؤخذ من الحساب دائماً (دولار في حساب دولار)', async () => {
    const usd = await createAccount({ name: 'البنك', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })
    const t = await createTransaction(input({ accountId: usd.id }))
    expect(t.currency).toBe('USD')
  })

  it('يرفض العملية غير الصالحة أو لحساب غير موجود دون حفظ شيء', async () => {
    await expect(createTransaction(input({ amountMinor: 0 }))).rejects.toBeInstanceOf(ValidationError)
    await expect(createTransaction(input({ accountId: 'missing' }))).rejects.toThrow('الحساب المختار غير موجود')
    expect(await listTransactions()).toHaveLength(0)
  })

  it('تعديل العملية ينقل أثرها بين الحسابات ويغيّر عملتها مع الحساب', async () => {
    const usd = await createAccount({ name: 'البنك', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })
    const t = await createTransaction(input())
    await updateTransaction(t.id, input({ accountId: usd.id, amountMinor: 5000 }))

    expect(await balanceOf(cashId)).toBe(0)
    expect(await balanceOf(usd.id)).toBe(-5000)
    const [updated] = await listTransactions()
    expect(updated.currency).toBe('USD')
    expect(updated.createdAt).toBe(t.createdAt)
  })

  it('حذف العملية يعيد الرصيد', async () => {
    const t = await createTransaction(input())
    await deleteTransaction(t.id)
    expect(await balanceOf(cashId)).toBe(0)
  })

  it('لا يُحذف حساب له عمليات، ولا تتغيّر عملته', async () => {
    const extra = await createAccount({ name: 'بال باي', type: 'palpay', currency: 'ILS', openingBalanceMinor: 0 })
    await createTransaction(input())

    await expect(deleteAccount(cashId)).rejects.toThrow('لا يمكن حذف حساب له عمليات')
    await expect(
      updateAccount(cashId, { name: 'نقد', type: 'cash', currency: 'USD', openingBalanceMinor: 0 }),
    ).rejects.toThrow('لا يمكن تغيير عملة حساب له عمليات')
    // تعديل بقية الحقول مسموح.
    await updateAccount(cashId, { name: 'المحفظة', type: 'cash', currency: 'ILS', openingBalanceMinor: 500 })
    // حساب بلا عمليات يُحذف.
    await deleteAccount(extra.id)
    expect((await listAccounts()).map((a) => a.name)).toEqual(['المحفظة'])
  })
})

describe('ترحيل قاعدة البيانات من الإصدار 1 إلى أحدث إصدار', () => {
  it('يحافظ على الحسابات والإعدادات ويضيف جدول العمليات', async () => {
    db.close()
    await Dexie.delete('qirsh-migration')

    // قاعدة بالإصدار 1 فقط، كما عند مستخدم المرحلة 2.
    const v1 = new Dexie('qirsh-migration')
    v1.version(1).stores({ settings: 'id', accounts: 'id, type, currency' })
    await v1.table('settings').add({ id: 'app', onboardedAt: '2026-10-24T00:00:00.000Z', lastBackupAt: null, createdAt: 'x' })
    await v1.table('accounts').add({ id: 'jp', name: 'جوال باي', type: 'jawwalpay', currency: 'ILS', openingBalanceMinor: 15050, createdAt: 'x', updatedAt: 'x' })
    expect(v1.verno).toBe(1)
    v1.close()

    const v2 = new QirshDB('qirsh-migration')
    try {
      await v2.open()
      expect(v2.verno).toBe(db.verno)
      expect(await v2.accounts.get('jp')).toMatchObject({ name: 'جوال باي', openingBalanceMinor: 15050 })
      expect((await v2.settings.get('app'))?.onboardedAt).toBe('2026-10-24T00:00:00.000Z')
      expect(await v2.transactions.count()).toBe(0)
    } finally {
      v2.close()
      await Dexie.delete('qirsh-migration')
    }
  })
})
