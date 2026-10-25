/**
 * التواريخ: تاريخ العملية يُخزَّن نصاً «YYYY-MM-DD» بالتوقيت المحلي للمستخدم،
 * فلا ينتقل يوم العملية إذا تغيّرت المنطقة الزمنية.
 * العرض بأسماء الأشهر الشامية (تشرين الأول) وأرقام غربية.
 */

const LOCALE = 'ar-PS-u-nu-latn'

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** يتحقق من أن النص تاريخ حقيقي بصيغة YYYY-MM-DD (يرفض 2026-02-30). */
export function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [y, m, d] = match.slice(1).map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const longFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full' })
const mediumFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short' })

/** «الأحد، 25 تشرين الأول 2026» */
export function formatDateLong(iso: string): string {
  return longFormat.format(toLocalDate(iso))
}

/** «25 تشرين الأول 2026» */
export function formatDate(iso: string): string {
  return mediumFormat.format(toLocalDate(iso))
}

/** لعنوان مجموعة أيام في السجل: «اليوم» أو «أمس» أو التاريخ الكامل. */
export function formatDayHeading(iso: string, today = todayISO()): string {
  if (iso === today) return 'اليوم'
  const yesterday = toLocalDate(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === todayISO(yesterday)) return 'أمس'
  return formatDateLong(iso)
}

/** لطوابع الوقت الكاملة (وقت الإنشاء، آخر نسخة احتياطية). */
export function formatDateTime(timestamp: string): string {
  return dateTimeFormat.format(new Date(timestamp))
}
