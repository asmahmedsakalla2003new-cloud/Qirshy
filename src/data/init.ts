import type { Account } from '../domain/accounts'
import { defaultAccountNames } from '../domain/accounts'
import { DEFAULT_CATEGORIES, type Category } from '../domain/categories'
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

function defaultCategories(now: string): Category[] {
  return (['expense', 'income'] as const).flatMap((kind) =>
    DEFAULT_CATEGORIES[kind].map((name, order) => ({
      id: crypto.randomUUID(),
      name,
      kind,
      archived: false,
      order,
      createdAt: now,
      updatedAt: now,
    })),
  )
}

/**
 * يفتح قاعدة البيانات ويجهّزها عند أول تشغيل: سجل الإعدادات وحساب «نقد» الافتراضي والفئات الافتراضية.
 * آمن للتكرار: لا يضيف شيئاً إذا كانت البيانات موجودة.
 */
export async function initDatabase(): Promise<AppSettings> {
  await db.open()
  const legacyOnboarded = readLegacyOnboarded()

  const settings = await db.transaction('rw', db.settings, db.accounts, db.categories, async () => {
    const now = new Date().toISOString()
    let current = await db.settings.get('app')

    if (!current) {
      current = {
        id: 'app',
        onboardedAt: legacyOnboarded ? now : null,
        lastBackupAt: null,
        createdAt: now,
      }
      await db.settings.add(current)

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
    }

    // للمستخدم الجديد ولمن جاء من المرحلة 3 (قبل وجود الفئات).
    if (!current.categoriesSeeded) {
      await db.categories.bulkAdd(defaultCategories(now))
      current = { ...current, categoriesSeeded: true }
      await db.settings.put(current)
    }
    return current
  })

  clearLegacyOnboarded()
  if (settings.onboardedAt) void requestPersistentStorage()
  return settings
}
