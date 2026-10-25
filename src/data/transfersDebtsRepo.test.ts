import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountBalance } from '../domain/accounts'
import { todayISO } from '../domain/dates'
import { debtStatus } from '../domain/debts'
import { createAccount, deleteAccount, listAccounts, updateAccount } from './accountsRepo'
import { db, QirshDB } from './db'
import { addDebtPayment, createDebt, deleteDebt, getDebtWithPayments, listDebtPayments, updateDebt } from './debtsRepo'
import { initDatabase } from './init'
import { listTransactions } from './transactionsRepo'
import { createTransfer, deleteTransfer, listTransfers, updateTransfer } from './transfersRepo'

async function balances() {
  const [accounts, transactions, transfers] = await Promise.all([listAccounts(), listTransactions(), listTransfers()])
  return Object.fromEntries(accounts.map((a) => [a.name, accountBalance(a, transactions, transfers)]))
}

describe('transfersRepo', () => {
  let cash: string, bank: string, usd: string
  beforeEach(async () => {
    await initDatabase()
    cash = (await listAccounts())[0].id
    await updateAccount(cash, { name: 'نقد', type: 'cash', currency: 'ILS', openingBalanceMinor: 100000 })
    bank = (await createAccount({ name: 'البنك', type: 'bank', currency: 'ILS', openingBalanceMinor: 0 })).id
    usd = (await createAccount({ name: 'دولار', type: 'bank', currency: 'USD', openingBalanceMinor: 50000 })).id
  })

  const input = (p = {}) => ({
    fromAccountId: cash,
    toAccountId: bank,
    fromAmountMinor: 30000,
    toAmountMinor: 30000,
    date: todayISO(),
    description: ' إيداع ',
    ...p,
  })

  it('التحويل بالعملة نفسها ينقل الرصيد ويحفظ العملتين', async () => {
    const t = await createTransfer(input())
    expect(t).toMatchObject({ fromCurrency: 'ILS', toCurrency: 'ILS', description: 'إيداع' })
    expect(await balances()).toMatchObject({ نقد: 70000, البنك: 30000, دولار: 50000 })
  })

  it('بين عملتين: كل حساب بعملته', async () => {
    await createTransfer(input({ fromAccountId: usd, toAccountId: cash, fromAmountMinor: 10000, toAmountMinor: 36500 }))
    expect(await balances()).toMatchObject({ نقد: 136500, دولار: 40000 })
  })

  it('التعديل والحذف يعيدان الحساب', async () => {
    const t = await createTransfer(input())
    await updateTransfer(t.id, input({ fromAmountMinor: 10000, toAmountMinor: 10000 }))
    expect(await balances()).toMatchObject({ نقد: 90000, البنك: 10000 })
    await deleteTransfer(t.id)
    expect(await balances()).toMatchObject({ نقد: 100000, البنك: 0 })
  })

  it('يرفض المبلغين المختلفين بالعملة نفسها والحساب نفسه', async () => {
    await expect(createTransfer(input({ toAmountMinor: 29000 }))).rejects.toThrow('يتساوى')
    await expect(createTransfer(input({ toAccountId: cash }))).rejects.toThrow('حساباً مختلفاً')
    expect(await listTransfers()).toHaveLength(0)
  })

  it('لا يُحذف حساب له تحويلات ولا تتغيّر عملته', async () => {
    await createTransfer(input())
    await expect(deleteAccount(bank)).rejects.toThrow('له عمليات أو تحويلات')
    await expect(updateAccount(bank, { name: 'البنك', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).rejects.toThrow(
      'لا يمكن تغيير عملة',
    )
  })
})

describe('debtsRepo', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  const input = {
    direction: 'owed_to_me' as const,
    counterparty: ' أحمد ',
    amountMinor: 50000,
    currency: 'ILS' as const,
    date: todayISO(),
    dueDate: null,
    notes: '',
  }

  it('دفعات جزئية حتى التسديد الكامل، ولا تتجاوز المتبقي', async () => {
    const debt = await createDebt(input)
    expect(debt.counterparty).toBe('أحمد')
    await addDebtPayment(debt.id, 20000, todayISO())
    await expect(addDebtPayment(debt.id, 30001, todayISO())).rejects.toThrow('أكبر من المتبقي')
    await addDebtPayment(debt.id, 30000, todayISO())
    const data = (await getDebtWithPayments(debt.id))!
    expect(debtStatus(data.debt, data.payments)).toMatchObject({ remainingMinor: 0, settled: true })
    await expect(addDebtPayment(debt.id, 1, todayISO())).rejects.toThrow('أكبر من المتبقي')
  })

  it('الديون لا تغيّر أرصدة الحسابات', async () => {
    const before = await balances()
    const debt = await createDebt({ ...input, amountMinor: 99999 })
    await addDebtPayment(debt.id, 5000, todayISO())
    expect(await balances()).toEqual(before)
  })

  it('لا يصير الأصل أقل مما سُدّد، ولا تتغيّر العملة بعد الدفعات', async () => {
    const debt = await createDebt(input)
    await addDebtPayment(debt.id, 30000, todayISO())
    await expect(updateDebt(debt.id, { ...input, amountMinor: 20000 })).rejects.toThrow('أقل مما سُدّد')
    await expect(updateDebt(debt.id, { ...input, currency: 'USD' })).rejects.toThrow('لا يمكن تغيير عملة')
    await updateDebt(debt.id, { ...input, amountMinor: 30000, notes: 'سُدّد' })
    const data = (await getDebtWithPayments(debt.id))!
    expect(debtStatus(data.debt, data.payments).settled).toBe(true)
  })

  it('حذف الدين يحذف دفعاته', async () => {
    const debt = await createDebt(input)
    await addDebtPayment(debt.id, 100, todayISO())
    await deleteDebt(debt.id)
    expect(await getDebtWithPayments(debt.id)).toBeNull()
    expect(await listDebtPayments()).toHaveLength(0)
  })
})

describe('الترقية من الإصدار 4 إلى أحدث إصدار', () => {
  it('تحافظ على البيانات وتضيف التحويلات والديون', async () => {
    db.close()
    await Dexie.delete('qirsh-v4')
    const v4 = new Dexie('qirsh-v4')
    v4.version(1).stores({ settings: 'id', accounts: 'id, type, currency' })
    v4.version(2).stores({ transactions: 'id, date, accountId, type' })
    v4.version(3).stores({ categories: 'id, kind', transactions: 'id, date, accountId, type, categoryId' })
    v4.version(4).stores({ budgets: 'id, categoryId, currency' })
    await v4.table('budgets').add({ id: 'b1', scope: 'overall', currency: 'ILS' })
    v4.close()

    const latest = new QirshDB('qirsh-v4')
    try {
      await latest.open()
      expect(latest.verno).toBe(db.verno)
      expect(await latest.budgets.get('b1')).toMatchObject({ scope: 'overall' })
      expect(await latest.transfers.count()).toBe(0)
      expect(await latest.debts.count()).toBe(0)
    } finally {
      latest.close()
      await Dexie.delete('qirsh-v4')
    }
  })
})
