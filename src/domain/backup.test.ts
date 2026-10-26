import { describe, expect, it } from 'vitest'
import { shouldRemindBackup } from './backup'

describe('تذكير النسخ الاحتياطي', () => {
  const now = new Date('2026-10-26T12:00:00.000Z')
  const never = { lastBackupAt: null }

  it('لا يذكّر قبل تسجيل 5 عمليات', () => {
    expect(shouldRemindBackup(never, 4, now)).toBe(false)
    expect(shouldRemindBackup(never, 5, now)).toBe(true)
  })

  it('يذكّر إذا مرّ أكثر من 30 يوماً على آخر نسخة', () => {
    expect(shouldRemindBackup({ lastBackupAt: '2026-10-01T12:00:00.000Z' }, 50, now)).toBe(false)
    expect(shouldRemindBackup({ lastBackupAt: '2026-09-25T12:00:00.000Z' }, 50, now)).toBe(true)
  })

  it('«لاحقاً» يؤجّله حتى الموعد', () => {
    expect(shouldRemindBackup({ ...never, backupReminderSnoozedUntil: '2026-11-01T00:00:00.000Z' }, 50, now)).toBe(false)
    expect(shouldRemindBackup({ ...never, backupReminderSnoozedUntil: '2026-10-20T00:00:00.000Z' }, 50, now)).toBe(true)
  })
})
