import { isValidISODate, todayISO } from './dates'
import type { Currency } from './money'

/**
 * استخراج بيانات الفاتورة من النص الذي يقرؤه Tesseract على الجهاز.
 * القراءة تقريبية: كل قيمة تُعرض للمراجعة والتعديل قبل الحفظ، ومعها درجة ثقة.
 * لا تحليل طبي: من الروشتة يُؤخذ المبلغ والتاريخ فقط.
 */
export type Confidence = 'high' | 'medium' | 'low'

export type ReceiptItem = { name: string; amountMinor: number }

export type ReceiptData = {
  totalMinor: number | null
  totalConfidence: Confidence | null
  date: string | null
  /** التاريخ مقروء بأرقام كاملة (يومان وشهر بخانتين وسنة بأربع)؛ غير ذلك قد يكون حرف سقط. */
  dateConfident: boolean
  currency: Currency | null
  merchant: string | null
  items: ReceiptItem[]
  /** مجموع الأصناف المقروءة (0 إن لم تُقرأ أصناف). */
  itemsSumMinor: number
  /** اسم فئة افتراضية مقترحة (تُطابَق مع فئات المستخدم). */
  suggestedCategory: string | null
  warnings: string[]
}

/** أرقام عربية-هندية وفارسية إلى غربية، والفاصلة العشرية العربية إلى نقطة. */
function normalizeDigits(text: string): string {
  return text
    // علامات الاتجاه الخفية التي يضيفها القارئ في النص المختلط.
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
}

/** يحذف التشكيل ويوحّد الهمزات للمطابقة. */
function simplify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
}

const TOTAL_WORDS = ['الاجمالي', 'اجمالي', 'المجموع الكلي', 'المطلوب', 'المبلغ المستحق', 'الصافي', 'grand total', 'total', 'amount due', 'balance due', 'net']
const SUBTOTAL_WORDS = ['المجموع الفرعي', 'subtotal', 'sub total', 'sub-total']
const PLAIN_SUM_WORDS = ['المجموع']
/** أسطر ليست أصنافاً ولا الإجمالي. */
const EXCLUDE_WORDS = ['ضريبه', 'ضريبة', 'vat', 'tax', 'خصم', 'discount', 'الباقي', 'change', 'نقدا', 'cash', 'المدفوع', 'paid', 'visa', 'فيزا', 'بطاقه', 'card', 'هاتف', 'tel', 'phone', 'جوال', 'رقم', 'no.', 'تاريخ', 'date', 'الوقت', 'time']

const has = (line: string, words: string[]) => words.some((w) => line.includes(w))

/** المبالغ في سطر (بأصغر وحدة). يتجاهل أرقام الهاتف والتواريخ الطويلة. */
export function amountsInLine(line: string): number[] {
  const text = normalizeDigits(line)
    // التواريخ والأوقات ليست مبالغ.
    .replace(/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/g, ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
  const amounts: number[] = []
  for (const match of text.matchAll(/(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?(?![\d])/g)) {
    const whole = match[1].replace(/,/g, '')
    if (whole.length > 7) continue // رقم هاتف أو رقم فاتورة.
    const fraction = (match[2] ?? '').padEnd(2, '0')
    amounts.push(Number(whole) * 100 + Number(fraction))
  }
  return amounts.filter((a) => a > 0)
}

/**
 * أول تاريخ صالح غير مستقبلي. الصيغ: يوم/شهر/سنة (الشائعة محلياً) أو سنة-شهر-يوم.
 * confident: كل الأجزاء بعدد خاناتها الكامل؛ القارئ أحياناً يُسقط رقماً («22» ← «2»).
 */
export function findDateWithConfidence(text: string, today = todayISO()): { date: string; confident: boolean } | null {
  const normalized = normalizeDigits(text)
  const candidates: { date: string; confident: boolean }[] = []
  for (const m of normalized.matchAll(/(?<!\d)(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/g)) {
    candidates.push({ date: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, confident: m[2].length === 2 && m[3].length === 2 })
  }
  for (const m of normalized.matchAll(/(?<!\d)(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?!\d)/g)) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    candidates.push({
      date: `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
      confident: m[1].length === 2 && m[2].length === 2 && m[3].length === 4,
    })
  }
  return candidates.find((c) => isValidISODate(c.date) && c.date <= today && c.date >= '2000-01-01') ?? null
}

export function findDate(text: string, today = todayISO()): string | null {
  return findDateWithConfidence(text, today)?.date ?? null
}

export function findCurrency(text: string): Currency | null {
  const t = simplify(normalizeDigits(text))
  if (/₪|nis\b|ils\b|شيكل|ش\.ج|ש"ח|שח/.test(t)) return 'ILS'
  if (/\$|usd\b|دولار/.test(t)) return 'USD'
  return null
}

const CATEGORY_HINTS: [string[], string][] = [
  [['صيدليه', 'صيدلية', 'pharm', 'دواء', 'روشته', 'روشتة'], 'صحة وصيدلية'],
  [['سوبرماركت', 'ماركت', 'market', 'بقاله', 'بقالة', 'مخبز', 'bakery', 'خضار', 'ملحمه', 'ملحمة', 'grocery'], 'بقالة وطعام'],
  [['محطه', 'محطة', 'وقود', 'بنزين', 'سولار', 'fuel', 'gas station', 'تاكسي', 'taxi'], 'مواصلات'],
  [['مطعم', 'مقهى', 'كافيه', 'cafe', 'coffee', 'قهوه', 'قهوة', 'restaurant', 'pizza', 'بيتزا'], 'ترفيه ومطاعم'],
  [['كهرباء', 'مياه', 'انترنت', 'internet', 'electric'], 'فواتير (كهرباء، ماء، إنترنت)'],
  [['جوال', 'اتصالات', 'اوريدو', 'ooredoo', 'jawwal', 'paltel', 'بالتل'], 'اتصالات'],
  [['ملابس', 'ازياء', 'أزياء', 'fashion', 'احذيه', 'أحذية'], 'ملابس'],
  [['مكتبه', 'مكتبة', 'قرطاسيه', 'قرطاسية', 'جامعه', 'جامعة', 'مدرسه', 'مدرسة'], 'تعليم'],
]

export function suggestCategory(text: string): string | null {
  // بلا مسافات أيضاً: القارئ قد يقسم الكلمة («صيد لية»).
  const t = simplify(text)
  const joined = t.replace(/\s+/g, '')
  return CATEGORY_HINTS.find(([words]) => words.some((w) => t.includes(simplify(w)) || joined.includes(simplify(w).replace(/\s+/g, ''))))?.[1] ?? null
}

/** اسم المحل: أول سطر نصّي في أعلى الفاتورة (ثقة منخفضة دائماً). */
function findMerchant(lines: string[]): string | null {
  for (const raw of lines.slice(0, 4)) {
    const line = raw.trim()
    const letters = (line.match(/[\p{L}]/gu) ?? []).length
    const digits = (line.match(/\d/g) ?? []).length
    if (letters >= 3 && digits <= letters / 3 && !has(simplify(line), ['فاتوره', 'فاتورة', 'receipt', 'invoice', 'tax'])) {
      return line.slice(0, 60)
    }
  }
  return null
}

export function parseReceipt(text: string, today = todayISO()): ReceiptData {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const simple = lines.map((l) => simplify(normalizeDigits(l)))
  const warnings: string[] = []

  // المبلغ الإجمالي: آخر سطر «إجمالي» (لا «فرعي»)، وإلا «المجموع»، وإلا أكبر مبلغ.
  let totalMinor: number | null = null
  let totalConfidence: Confidence | null = null
  let totalLine = -1
  // في سطر الإجمالي يُفضَّل المبلغ ذو الخانتين العشريتين: القارئ قد يحوّل «₪» إلى رقم («34.50 8»).
  const pick = (line: string) => {
    const decimals = normalizeDigits(line).match(/(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2}(?!\d)/g)
    if (decimals?.length) return amountsInLine(decimals.at(-1)!)[0] ?? null
    return amountsInLine(line).at(-1) ?? null
  }
  const amountNear = (i: number) => pick(lines[i]) ?? (i + 1 < lines.length ? pick(lines[i + 1]) : null)
  for (let i = 0; i < lines.length; i++) {
    const s = simple[i]
    if (has(s, SUBTOTAL_WORDS) || has(s, ['ضريبه', 'ضريبة', 'vat', 'tax', 'خصم', 'discount', 'الباقي', 'change', 'المدفوع', 'paid'])) continue
    if (has(s, TOTAL_WORDS)) {
      const amount = amountNear(i)
      if (amount !== null) {
        totalMinor = amount
        totalConfidence = 'high'
        totalLine = i
      }
    }
  }
  if (totalMinor === null) {
    for (let i = 0; i < lines.length; i++) {
      if (has(simple[i], PLAIN_SUM_WORDS) || has(simple[i], SUBTOTAL_WORDS)) {
        const amount = amountNear(i)
        if (amount !== null) {
          totalMinor = amount
          totalConfidence = 'medium'
          totalLine = i
        }
      }
    }
  }
  if (totalMinor === null) {
    const all = lines.filter((_, i) => !has(simple[i], EXCLUDE_WORDS)).flatMap(amountsInLine)
    if (all.length) {
      totalMinor = Math.max(...all)
      totalConfidence = 'low'
      warnings.push('لم تُعثر على كلمة «الإجمالي»؛ المبلغ المقترح هو أكبر رقم في الفاتورة. تأكد منه.')
    } else {
      warnings.push('تعذّرت قراءة المبلغ. أدخله يدوياً.')
    }
  }

  // الأصناف: أسطر فيها نص ومبلغ في آخرها، قبل سطر الإجمالي.
  const items: ReceiptItem[] = []
  const end = totalLine >= 0 ? totalLine : lines.length
  for (let i = 0; i < end; i++) {
    const s = simple[i]
    if (has(s, EXCLUDE_WORDS) || has(s, TOTAL_WORDS) || has(s, SUBTOTAL_WORDS) || has(s, PLAIN_SUM_WORDS)) continue
    const amounts = amountsInLine(lines[i])
    const name = normalizeDigits(lines[i]).replace(/[\d.,₪$×x*@:-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (amounts.length && (name.match(/[\p{L}]/gu) ?? []).length >= 2 && i > 0) {
      items.push({ name: name.slice(0, 60), amountMinor: amounts.at(-1)! })
    }
  }
  const itemsSumMinor = items.reduce((s, it) => s + it.amountMinor, 0)
  if (items.length > 0 && totalMinor !== null && itemsSumMinor !== totalMinor) {
    warnings.push('مجموع الأصناف المقروءة لا يساوي الإجمالي؛ قد تكون بعض الأسطر قُرئت خطأ أو فيها خصم أو ضريبة.')
  }

  const found = findDateWithConfidence(text, today)
  if (!found) warnings.push('لم يُقرأ تاريخ الفاتورة؛ وُضع تاريخ اليوم.')
  else if (!found.confident) warnings.push('التاريخ المقروء قد يكون ناقصاً رقماً؛ تأكد منه.')

  return {
    totalMinor,
    totalConfidence,
    date: found?.date ?? null,
    dateConfident: found?.confident ?? false,
    currency: findCurrency(text),
    merchant: findMerchant(lines),
    items,
    itemsSumMinor,
    suggestedCategory: suggestCategory(text),
    warnings,
  }
}

/**
 * الحفظ التلقائي (إن فعّله المستخدم) يُسمح به فقط عند قراءة واضحة تماماً:
 * إجمالي بجانب كلمته، وتاريخ كامل الأرقام، ولا تحذيرات، و**قراءتان مستقلتان متطابقتان**
 * (مجموع الأصناف = الإجمالي). القارئ قد يبدّل رقماً («34.50» ← «34.59») دون أي علامة،
 * والتطابق مع الأصناف هو ما يكشف ذلك. وإلا تُعرض المراجعة دائماً.
 */
export function canAutoSave(r: ReceiptData): boolean {
  return (
    r.totalMinor !== null &&
    r.totalConfidence === 'high' &&
    r.date !== null &&
    r.dateConfident &&
    r.warnings.length === 0 &&
    r.items.length > 0 &&
    r.itemsSumMinor === r.totalMinor
  )
}
