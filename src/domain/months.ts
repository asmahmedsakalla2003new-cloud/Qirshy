/** الأشهر بصيغة «YYYY-MM» لملخص الصفحة الرئيسية والميزانيات. */

export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return currentMonth(date)
}

/** أول يوم وآخر يوم في الشهر بصيغة YYYY-MM-DD (للتصفية الشاملة للحدّين). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

const monthFormat = new Intl.DateTimeFormat('ar-PS-u-nu-latn', { month: 'long', year: 'numeric' })

/** «تشرين الأول 2026» */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return monthFormat.format(new Date(y, m - 1, 1))
}
