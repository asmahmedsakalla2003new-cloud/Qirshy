import type { Account } from '../domain/accounts'
import { defaultAccountNames } from '../domain/accounts'
import { db, type AppSettings } from './db'
import { requestPersistentStorage } from './storage'

/** مفتاح المرحلة 1 في localStorage؛ يُنقل إلى قاعدة البيانات ثم يُحذف. */
const LEGACY_ONBOARDED_KEY = 'qirsh.onboarded'

function readLegacyOnboarded(): boolean {
  try {
    return localStorage.getItem(LEGACY_ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

function clearLegacyOnboarded() {
  try {
    localStorage.removeItem(LEGACY_ONBOARDED_KEY)
  } catch {
    // لا شيء: المفتاح غير موجود أو التخزين محجوب.
  }
}

/**
 * يفتح قاعدة البيانات ويجهّزها عند أول تشغيل: سجل الإعدادات وحساب «نقد» الافتراضي.
 * آمن للتكرار: لا يضيف شيئاً إذا كانت البيانات موجودة.
 */
export async function initDatabase(): Promise<AppSettings> {
  await db.open()
  const legacyOnboarded = readLegacyOnboarded()

  const settings = await db.transaction('rw', db.settings, db.accounts, async () => {
    const existing = await db.settings.get('app')
    if (existing) return existing

    const now = new Date().toISOString()
    const created: AppSettings = {
      id: 'app',
      onboardedAt: legacyOnboarded ? now : null,
      lastBackupAt: null,
      createdAt: now,
    }
    await db.settings.add(created)

    if ((await db.accounts.count()) === 0) {
      const cash: Account = {
        id: crypto.randomUUID(),
        name: defaultAccountNames.cash,
        type: 'cash',
        currency: 'ILS',
        openingBalanceMinor: 0,
        createdAt: now,
        updatedAt: now,
      }
      await db.accounts.add(cash)
    }
    return created
  })

  clearLegacyOnboarded()
  if (settings.onboardedAt) void requestPersistentStorage()
  return settings
}
