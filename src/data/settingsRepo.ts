import { db, type AppSettings } from './db'
import { requestPersistentStorage } from './storage'

export function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.get('app')
}

export async function snoozeBackupReminder(days = 7): Promise<void> {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  await db.settings.update('app', { backupReminderSnoozedUntil: until })
}

export async function completeOnboarding(): Promise<void> {
  await db.settings.update('app', { onboardedAt: new Date().toISOString() })
  // بعد ضغطة المستخدم مباشرةً، حين يكون طلب الحماية من الحذف التلقائي مفهوماً.
  void requestPersistentStorage()
}
