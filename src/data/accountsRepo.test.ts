import { beforeEach, describe, expect, it } from 'vitest'
import { createAccount, deleteAccount, listAccounts, updateAccount, ValidationError } from './accountsRepo'
import { initDatabase } from './init'

describe('accountsRepo', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  it('يضيف حساباً بعد تنظيف الاسم، ويعيده بترتيب الإنشاء', async () => {
    const bank = await createAccount({ name: '  بنك فلسطين ', type: 'bank', currency: 'USD', openingBalanceMinor: 100000 })
    expect(bank.name).toBe('بنك فلسطين')
    expect(bank.id).toBeTruthy()

    const names = (await listAccounts()).map((a) => a.name)
    expect(names).toEqual(['نقد', 'بنك فلسطين'])
  })

  it('يرفض الاسم المكرر بالعملة نفسها', async () => {
    await expect(
      createAccount({ name: 'نقد', type: 'cash', currency: 'ILS', openingBalanceMinor: 0 }),
    ).rejects.toBeInstanceOf(ValidationError)
    // بعملة مختلفة مسموح.
    await createAccount({ name: 'نقد', type: 'cash', currency: 'USD', openingBalanceMinor: 0 })
    expect(await listAccounts()).toHaveLength(2)
  })

  it('يعدّل الحساب ويحدّث وقت التعديل، ويسمح بإبقاء الاسم نفسه', async () => {
    const [cash] = await listAccounts()
    await updateAccount(cash.id, { name: 'نقد', type: 'cash', currency: 'ILS', openingBalanceMinor: -5000 })
    const [updated] = await listAccounts()
    expect(updated.openingBalanceMinor).toBe(-5000)
    expect(updated.updatedAt >= cash.updatedAt).toBe(true)
  })

  it('يحذف الحساب، لكنه يمنع حذف آخر حساب', async () => {
    const [cash] = await listAccounts()
    await expect(deleteAccount(cash.id)).rejects.toThrow('لا يمكن حذف آخر حساب')

    const palpay = await createAccount({ name: 'بال باي', type: 'palpay', currency: 'ILS', openingBalanceMinor: 0 })
    await deleteAccount(cash.id)
    expect((await listAccounts()).map((a) => a.id)).toEqual([palpay.id])
  })
})
