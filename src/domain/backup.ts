import type { Account } from './accounts'
import { ACCOUNT_TYPES } from './accounts'
import type { Budget } from './budgets'
import type { Category } from './categories'
import { isValidISODate } from './dates'
import type { Debt, DebtPayment } from './debts'
import { CURRENCIES } from './money'
import type { Transaction } from './transactions'
import type { Transfer } from './transfers'

/**
 * ملف النسخة الاحتياطية: ملف JSON واحد فيه كل بيانات التطبيق، مع رقم الصيغة
 * وإصدار قاعدة البيانات وتاريخ الإنشاء وبصمة SHA-256 للتحقق من السلامة.
 * الاستعادة تستبدل البيانات الحالية بالكامل (قرار صاحب المشروع).
 */
export const BACKUP_APP = 'qirsh'
export const BACKUP_FORMAT_VERSION = 1

export type BackupData = {
  settings: { id: 'app'; onboardedAt: string | null; lastBackupAt: string | null; createdAt: string; [key: string]: unknown }[]
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  transfers: Transfer[]
  budgets: Budget[]
  debts: Debt[]
  debtPayments: DebtPayment[]
}

export const BACKUP_TABLES = [
  'settings',
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'budgets',
  'debts',
  'debtPayments',
] as const satisfies readonly (keyof BackupData)[]

export type BackupFile = {
  app: typeof BACKUP_APP
  formatVersion: number
  /** إصدار قاعدة البيانات عند الإنشاء. */
  schemaVersion: number
  appVersion: string
  createdAt: string
  /** «sha256:...» لـ JSON.stringify(data). */
  checksum: string
  data: BackupData
}

/** ما يُعرض للمستخدم قبل الاستعادة. */
export type BackupSummary = {
  createdAt: string
  appVersion: string
  counts: Record<'accounts' | 'transactions' | 'transfers' | 'categories' | 'budgets' | 'debts', number>
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createBackupFile(data: BackupData, schemaVersion: number, appVersion: string, now = new Date()): Promise<BackupFile> {
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion,
    appVersion,
    createdAt: now.toISOString(),
    checksum: `sha256:${await sha256(JSON.stringify(data))}`,
    data,
  }
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const d = file.data
  return {
    createdAt: file.createdAt,
    appVersion: file.appVersion,
    counts: {
      accounts: d.accounts.length,
      transactions: d.transactions.length,
      transfers: d.transfers.length,
      categories: d.categories.length,
      budgets: d.budgets.length,
      debts: d.debts.length,
    },
  }
}

// ===== التحقق =====

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isId = (v: unknown): v is string => isStr(v) && v.length > 0 && v.length <= 100
const isAmount = (v: unknown) => Number.isSafeInteger(v)
const isPositive = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0
const isCurrency = (v: unknown) => (CURRENCIES as readonly unknown[]).includes(v)
const isDate = (v: unknown) => isStr(v) && isValidISODate(v)
const isTimestamp = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v))
const isMonth = (v: unknown) => isStr(v) && /^\d{4}-\d{2}$/.test(v)

/** يتحقق من كل سجل ومن ترابط السجلات، ويعيد أول مشكلة بالعربية. */
function validateData(d: BackupData): string | null {
  const settings = d.settings.find((s) => isObj(s) && s.id === 'app')
  if (!settings) return 'إعدادات التطبيق مفقودة.'
  if (d.accounts.length === 0) return 'لا يوجد أي حساب.'

  const check = <T>(table: string, rows: T[], valid: (row: T) => boolean): string | null => {
    const ids = new Set<string>()
    for (const [i, row] of rows.entries()) {
      if (!isObj(row) || !isId(row.id)) return `سجل غير صالح في ${table} (رقم ${i + 1}).`
      if (ids.has(row.id as string)) return `معرّف مكرر في ${table}.`
      ids.add(row.id as string)
      if (!valid(row)) return `سجل غير صالح في ${table} (رقم ${i + 1}).`
    }
    return null
  }

  const accountIds = new Set(d.accounts.map((a) => a.id))
  const categoryKinds = new Map(d.categories.map((c) => [c.id, c.kind]))
  const accountCurrency = new Map(d.accounts.map((a) => [a.id, a.currency]))
  const debtIds = new Set(d.debts.map((x) => x.id))

  return (
    check('الحسابات', d.accounts, (a) =>
      isStr(a.name) && (ACCOUNT_TYPES as readonly unknown[]).includes(a.type) && isCurrency(a.currency) && isAmount(a.openingBalanceMinor),
    ) ??
    check('الفئات', d.categories, (c) =>
      isStr(c.name) && (c.kind === 'expense' || c.kind === 'income') && typeof c.archived === 'boolean' && Number.isFinite(c.order),
    ) ??
    check('العمليات', d.transactions, (t) =>
      (t.type === 'expense' || t.type === 'income') &&
      isPositive(t.amountMinor) &&
      isCurrency(t.currency) &&
      accountIds.has(t.accountId) &&
      accountCurrency.get(t.accountId) === t.currency &&
      isDate(t.date) &&
      (t.categoryId === null || categoryKinds.get(t.categoryId) === t.type) &&
      isStr(t.description) &&
      isTimestamp(t.createdAt),
    ) ??
    check('التحويلات', d.transfers, (t) =>
      accountIds.has(t.fromAccountId) &&
      accountIds.has(t.toAccountId) &&
      t.fromAccountId !== t.toAccountId &&
      isPositive(t.fromAmountMinor) &&
      isPositive(t.toAmountMinor) &&
      isCurrency(t.fromCurrency) &&
      isCurrency(t.toCurrency) &&
      isDate(t.date) &&
      isStr(t.description) &&
      isTimestamp(t.createdAt),
    ) ??
    check('الميزانيات', d.budgets, (b) =>
      (b.scope === 'overall' || (b.scope === 'category' && categoryKinds.get(b.categoryId ?? '') === 'expense')) &&
      isCurrency(b.currency) &&
      Array.isArray(b.schedule) &&
      b.schedule.length > 0 &&
      b.schedule.every((s) => isObj(s) && isMonth(s.from) && isPositive(s.amountMinor)) &&
      isObj(b.overrides) &&
      Object.entries(b.overrides).every(([m, v]) => isMonth(m) && isPositive(v)) &&
      isObj(b.dismissedAlerts),
    ) ??
    check('الديون', d.debts, (x) =>
      (x.direction === 'owed_to_me' || x.direction === 'owed_by_me') &&
      isStr(x.counterparty) &&
      isPositive(x.amountMinor) &&
      isCurrency(x.currency) &&
      isDate(x.date) &&
      (x.dueDate === null || isDate(x.dueDate)) &&
      isStr(x.notes),
    ) ??
    check('دفعات الديون', d.debtPayments, (p) => debtIds.has(p.debtId) && isPositive(p.amountMinor) && isDate(p.date))
  )
}

/**
 * يقرأ نص الملف ويتحقق منه بالكامل قبل أي كتابة في قاعدة البيانات.
 * النسخ من إصدار أقدم تُقبل (الجداول المضافة لاحقاً تُعامل كفارغة)،
 * والنسخ من إصدار أحدث من التطبيق تُرفض.
 */
export async function parseBackup(text: string, currentSchemaVersion: number): Promise<BackupFile> {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new BackupError('الملف ليس نسخة احتياطية صالحة: لا يمكن قراءته.')
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) {
    throw new BackupError('هذا الملف ليس نسخة احتياطية من قِرْش.')
  }
  if (!Number.isInteger(raw.formatVersion) || !Number.isInteger(raw.schemaVersion) || !isTimestamp(raw.createdAt) || !isStr(raw.checksum)) {
    throw new BackupError('معلومات النسخة الاحتياطية ناقصة أو تالفة.')
  }
  if ((raw.formatVersion as number) > BACKUP_FORMAT_VERSION || (raw.schemaVersion as number) > currentSchemaVersion) {
    throw new BackupError('هذه النسخة أُنشئت بإصدار أحدث من التطبيق. حدّث التطبيق ثم أعد المحاولة.')
  }
  if (raw.checksum !== `sha256:${await sha256(JSON.stringify(raw.data))}`) {
    throw new BackupError('الملف تالف أو عُدِّل بعد إنشائه: فشل التحقق من سلامته.')
  }

  // الجداول المفقودة في النسخ الأقدم تُعامل كفارغة.
  const data = Object.fromEntries(
    BACKUP_TABLES.map((table) => {
      const rows = (raw.data as Record<string, unknown>)[table]
      if (rows !== undefined && !Array.isArray(rows)) throw new BackupError('بنية الملف غير صالحة.')
      return [table, rows ?? []]
    }),
  ) as BackupData

  const problem = validateData(data)
  if (problem) throw new BackupError(`الملف يحتوي بيانات غير صالحة: ${problem}`)

  return {
    app: BACKUP_APP,
    formatVersion: raw.formatVersion as number,
    schemaVersion: raw.schemaVersion as number,
    appVersion: isStr(raw.appVersion) ? raw.appVersion : '',
    createdAt: raw.createdAt as string,
    checksum: raw.checksum as string,
    data,
  }
}

/** اسم الملف: qirsh-backup-2026-10-26.json */
export function backupFilename(prefix: string, now = new Date()): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `${prefix}-${date}.json`
}

/** أيام بين التذكيرات بالنسخ الاحتياطي، وأقل عدد عمليات قبل أول تذكير. */
export const BACKUP_REMINDER_DAYS = 30
export const BACKUP_REMINDER_MIN_RECORDS = 5

/**
 * تذكير لطيف بالنسخ الاحتياطي: بعد تسجيل بعض البيانات، إذا لم تُنشأ نسخة
 * أو مرّ عليها 30 يوماً، وما لم يؤجّله المستخدم.
 */
export function shouldRemindBackup(
  settings: { lastBackupAt: string | null; backupReminderSnoozedUntil?: string },
  recordCount: number,
  now = new Date(),
): boolean {
  if (recordCount < BACKUP_REMINDER_MIN_RECORDS) return false
  if (settings.backupReminderSnoozedUntil && Date.parse(settings.backupReminderSnoozedUntil) > now.getTime()) return false
  if (!settings.lastBackupAt) return true
  return now.getTime() - Date.parse(settings.lastBackupAt) > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
