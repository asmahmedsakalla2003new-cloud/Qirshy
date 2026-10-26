import { BACKUP_TABLES, createBackupFile, parseBackup, type BackupData, type BackupFile } from '../domain/backup'
import { db } from './db'

/** كل بيانات التطبيق في كائن واحد. */
async function readAll(): Promise<BackupData> {
  return db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    const entries = await Promise.all(BACKUP_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const))
    return Object.fromEntries(entries) as BackupData
  })
}

export async function exportBackup(): Promise<BackupFile> {
  return createBackupFile(await readAll(), db.verno, __APP_VERSION__)
}

export function readBackupText(text: string): Promise<BackupFile> {
  return parseBackup(text, db.verno)
}

/** يسجّل وقت آخر نسخة احتياطية (بعد تسليم الملف للمستخدم). */
export async function markBackedUp(at = new Date().toISOString()): Promise<void> {
  await db.settings.update('app', { lastBackupAt: at })
}

/**
 * يستبدل كل البيانات ببيانات الملف داخل معاملة واحدة: إن فشل أي جزء
 * تُلغى العملية كلها وتبقى البيانات الحالية كما هي.
 */
export async function restoreBackup(file: BackupFile): Promise<void> {
  const tables = BACKUP_TABLES.map((t) => db.table(t))
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear()
    for (const name of BACKUP_TABLES) {
      const rows = file.data[name] as unknown[]
      if (rows.length) await db.table(name).bulkAdd(rows)
    }
    // من استعاد نسخة لا يُعاد إلى الشاشة الترحيبية، والفئات الافتراضية لا تُضاف فوق فئاته.
    const settings = await db.settings.get('app')
    await db.settings.update('app', {
      onboardedAt: settings?.onboardedAt ?? new Date().toISOString(),
      categoriesSeeded: true,
    })
  })
}
