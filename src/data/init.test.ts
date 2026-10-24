import { describe, expect, it } from 'vitest'
import { db, QirshDB } from './db'
import { initDatabase } from './init'

describe('initDatabase', () => {
  it('ينشئ الإعدادات وحساب «نقد» بالشيكل عند أول تشغيل', async () => {
    const settings = await initDatabase()
    expect(settings).toMatchObject({ id: 'app', onboardedAt: null, lastBackupAt: null })

    const accounts = await db.accounts.toArray()
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({ name: 'نقد', type: 'cash', currency: 'ILS', openingBalanceMinor: 0 })
  })

  it('آمن للتكرار: لا يكرر الحساب الافتراضي ولا يعيد ضبط الإعدادات', async () => {
    await initDatabase()
    await db.settings.update('app', { onboardedAt: '2026-01-01T00:00:00.000Z' })
    await initDatabase()
    await initDatabase()

    expect(await db.accounts.count()).toBe(1)
    expect((await db.settings.get('app'))?.onboardedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('لا يعيد إنشاء «نقد» إذا حذفه المستخدم بعد أن أضاف حساباً آخر', async () => {
    await initDatabase()
    const [cash] = await db.accounts.toArray()
    await db.accounts.add({ ...cash, id: 'bank', name: 'البنك', type: 'bank' })
    await db.accounts.delete(cash.id)

    await initDatabase()
    expect((await db.accounts.toArray()).map((a) => a.name)).toEqual(['البنك'])
  })

  it('ينقل علامة الترحيب من المرحلة 1 (localStorage) ثم يحذفها', async () => {
    localStorage.setItem('qirsh.onboarded', '1')
    const settings = await initDatabase()
    expect(settings.onboardedAt).not.toBeNull()
    expect(localStorage.getItem('qirsh.onboarded')).toBeNull()
  })

  it('البيانات تبقى بعد إغلاق قاعدة البيانات وإعادة فتحها (كإغلاق التطبيق)', async () => {
    await initDatabase()
    await db.accounts.add({
      id: 'jp',
      name: 'جوال باي',
      type: 'jawwalpay',
      currency: 'ILS',
      openingBalanceMinor: 15050,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    db.close()

    const reopened = new QirshDB()
    try {
      expect(await reopened.accounts.get('jp')).toMatchObject({ name: 'جوال باي', openingBalanceMinor: 15050 })
      expect(await reopened.accounts.count()).toBe(2)
    } finally {
      reopened.close()
    }
  })
})
