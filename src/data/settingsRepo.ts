import { db, type AppSettings } from './db'
import { requestPersistentStorage } from './storage'

export function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.get('app')
}

export async function completeOnboarding(): Promise<void> {
  await db.settings.update('app', { onboardedAt: new Date().toISOString() })
  // بعد ضغطة المستخدم مباشرةً، حين يكون طلب الحماية من الحذف التلقائي مفهوماً.
  void requestPersistentStorage()
}
