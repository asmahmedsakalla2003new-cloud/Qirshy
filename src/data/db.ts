import { Dexie, type EntityTable } from 'dexie'
import type { Account } from '../domain/accounts'
import type { Transaction } from '../domain/transactions'

/** إعدادات التطبيق: سجل واحد بالمعرّف 'app'. */
export type AppSettings = {
  id: 'app'
  /** وقت إكمال الشاشة الترحيبية، أو null إن لم تكتمل. */
  onboardedAt: string | null
  /** وقت آخر نسخة احتياطية أنشأها المستخدم (تُستخدم في المرحلة 8). */
  lastBackupAt: string | null
  createdAt: string
}

export class QirshDB extends Dexie {
  settings!: EntityTable<AppSettings, 'id'>
  accounts!: EntityTable<Account, 'id'>
  transactions!: EntityTable<Transaction, 'id'>

  constructor(name = 'qirsh') {
    super(name)

    /*
     * إصدارات قاعدة البيانات (الترحيلات).
     * لا تعدّل إصداراً منشوراً: أضف db.version(n + 1) بالجداول الجديدة أو المعدّلة،
     * ومعه .upgrade() إن احتاجت البيانات الموجودة إلى تحويل.
     * الحقول المذكورة هنا هي الفهارس فقط؛ بقية الحقول تُحفظ كما هي.
     */
    this.version(1).stores({
      settings: 'id',
      accounts: 'id, type, currency',
    })

    // الإصدار 2 (المرحلة 3): جدول العمليات. لا يغيّر البيانات الموجودة.
    this.version(2).stores({
      transactions: 'id, date, accountId, type',
    })
  }
}

export const db = new QirshDB()
