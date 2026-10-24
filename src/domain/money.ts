/**
 * المال في قِرْش: كل المبالغ تُخزَّن أعداداً صحيحة بأصغر وحدة (أغورة / سنت)
 * لتجنّب أخطاء الأعداد العشرية العائمة. 125.50 ₪ تُخزَّن 12550.
 */

export const CURRENCIES = ['ILS', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const currencyLabels: Record<Currency, string> = {
  ILS: 'شيكل',
  USD: 'دولار',
}

const currencySymbols: Record<Currency, string> = {
  ILS: '₪',
  USD: '$',
}

/** الحد الأعلى لأي مبلغ: مليار وحدة. */
const MAX_MAJOR = 1_000_000_000

export type ParseResult = { ok: true; minor: number } | { ok: false; error: string }

type ParseOptions = {
  allowNegative?: boolean
  allowZero?: boolean
}

/** يحوّل الأرقام العربية-الهندية والفارسية والفاصلة العشرية العربية إلى صيغة قياسية. */
function normalize(input: string): string {
  let s = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[٬\s]/g, '')
    .replace(/^[−–]/, '-')

  // «12,5» بلا نقطة تُفهم فاصلة عشرية؛ وإلا فالفاصلة فاصل آلاف.
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  return s
}

/** يقرأ مبلغاً كتبه المستخدم ويعيده بأصغر وحدة، أو رسالة خطأ عربية. */
export function parseAmount(input: string, options: ParseOptions = {}): ParseResult {
  const { allowNegative = false, allowZero = false } = options
  const s = normalize(input)

  if (s === '' || s === '-') return { ok: false, error: 'أدخل المبلغ.' }
  if (/^-?\d+\.\d{3,}$/.test(s)) return { ok: false, error: 'المبلغ يقبل خانتين بعد الفاصلة فقط.' }

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!match) return { ok: false, error: 'أدخل رقماً صحيحاً، مثل 125.50' }

  const [, sign, whole, fraction = ''] = match
  if (Number(whole) >= MAX_MAJOR) return { ok: false, error: 'المبلغ كبير جداً.' }

  const magnitude = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  const minor = sign === '-' ? -magnitude : magnitude

  if (minor < 0 && !allowNegative) return { ok: false, error: 'لا يمكن أن يكون المبلغ سالباً.' }
  if (minor === 0 && !allowZero) return { ok: false, error: 'يجب أن يكون المبلغ أكبر من صفر.' }

  return { ok: true, minor: minor === 0 ? 0 : minor }
}

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** يعرض المبلغ مع رمز عملته، مثل «1,250.50 ₪». الأرقام غربية (0-9). */
export function formatMoney(minor: number, currency: Currency): string {
  return `${numberFormat.format(minor / 100)} ${currencySymbols[currency]}`
}

/** يحوّل المبلغ المخزَّن إلى نص قابل للتعديل في حقل الإدخال، مثل «125.50». */
export function toInputValue(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
