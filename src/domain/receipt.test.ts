import { describe, expect, it } from 'vitest'
import { amountsInLine, canAutoSave, findCurrency, findDate, findDateWithConfidence, parseReceipt, suggestCategory } from './receipt'

// نصوص فواتير تجريبية (وهمية) بشكل ما يُخرجه القارئ.
const supermarket = `سوبرماركت الأمانة
رام الله - هاتف 022951234
فاتورة رقم 10234
التاريخ: 24/10/2026  الوقت 18:42
خبز 5.00
حليب 1 لتر 7.50
بيض 30 حبة 22.00
المجموع الفرعي 34.50
الإجمالي 34.50 ₪
المدفوع 50.00
الباقي 15.50`

const pharmacy = `Al-Shifa Pharmacy
صيدلية الشفاء
Date 2026-10-20
Panadol 18.90
Vitamin C 32.00
Sub Total 50.90
VAT 0.00
TOTAL NIS 50.90`

describe('amountsInLine', () => {
  it('يقرأ المبالغ بأشكالها ويتجاهل الهاتف والتاريخ والوقت', () => {
    expect(amountsInLine('الإجمالي 34.50 ₪')).toEqual([3450])
    expect(amountsInLine('Total 1,250.00')).toEqual([125000])
    expect(amountsInLine('المجموع ١٢٥٫٥٠')).toEqual([12550])
    expect(amountsInLine('سعر 12,5')).toEqual([1250])
    expect(amountsInLine('هاتف 022951234')).toEqual([])
    expect(amountsInLine('التاريخ: 24/10/2026 الوقت 18:42')).toEqual([])
  })
})

describe('findDate', () => {
  it('يوم/شهر/سنة أولاً، وسنة-شهر-يوم، ويرفض المستقبل والمستحيل', () => {
    expect(findDate('24/10/2026', '2026-10-26')).toBe('2026-10-24')
    expect(findDate('5.3.26', '2026-10-26')).toBe('2026-03-05')
    expect(findDate('2026-10-20', '2026-10-26')).toBe('2026-10-20')
    expect(findDate('٢٤/١٠/٢٠٢٦', '2026-10-26')).toBe('2026-10-24')
    expect(findDate('30/02/2026', '2026-10-26')).toBeNull()
    expect(findDate('01/12/2026', '2026-10-26')).toBeNull()
  })

  it('التاريخ بخانة ناقصة غير موثوق (القارئ أسقط رقماً)', () => {
    expect(findDateWithConfidence('2026-10-22', '2026-10-26')).toEqual({ date: '2026-10-22', confident: true })
    expect(findDateWithConfidence('2026-10-2', '2026-10-26')).toEqual({ date: '2026-10-02', confident: false })
    expect(findDateWithConfidence('5/3/2026', '2026-10-26')?.confident).toBe(false)
    expect(findDateWithConfidence('05/03/26', '2026-10-26')?.confident).toBe(false)
  })
})

describe('العملة والفئة', () => {
  it('يتعرّف على الشيكل والدولار', () => {
    expect(findCurrency('الإجمالي 34.50 ₪')).toBe('ILS')
    expect(findCurrency('TOTAL NIS 50')).toBe('ILS')
    expect(findCurrency('Total $12')).toBe('USD')
    expect(findCurrency('المجموع 12')).toBeNull()
  })

  it('يقترح فئة من نوع المحل', () => {
    expect(suggestCategory(pharmacy)).toBe('صحة وصيدلية')
    expect(suggestCategory(supermarket)).toBe('بقالة وطعام')
    expect(suggestCategory('محطة الوقود المركزية')).toBe('مواصلات')
    expect(suggestCategory('شيء آخر')).toBeNull()
    // كما يُخرجها القارئ أحياناً:
    expect(suggestCategory('صيد لية الشفاء')).toBe('صحة وصيدلية')
    expect(suggestCategory('مقهى السرايا')).toBe('ترفيه ومطاعم')
  })
})

describe('parseReceipt', () => {
  it('فاتورة سوبرماركت عربية: الإجمالي لا المدفوع ولا الباقي، والأصناف والتاريخ', () => {
    const r = parseReceipt(supermarket, '2026-10-26')
    expect(r).toMatchObject({
      totalMinor: 3450,
      totalConfidence: 'high',
      date: '2026-10-24',
      currency: 'ILS',
      merchant: 'سوبرماركت الأمانة',
      suggestedCategory: 'بقالة وطعام',
      itemsSumMinor: 3450,
    })
    expect(r.items.map((i) => i.amountMinor)).toEqual([500, 750, 2200])
    expect(r.warnings).toEqual([])
  })

  it('فاتورة صيدلية مختلطة: TOTAL بعد Sub Total، دون أصناف الضريبة', () => {
    const r = parseReceipt(pharmacy, '2026-10-26')
    expect(r).toMatchObject({ totalMinor: 5090, totalConfidence: 'high', date: '2026-10-20', currency: 'ILS', suggestedCategory: 'صحة وصيدلية' })
    expect(r.items.map((i) => i.amountMinor)).toEqual([1890, 3200])
  })

  it('الإجمالي في السطر التالي لكلمته', () => {
    expect(parseReceipt('مطعم السرايا\nالإجمالي\n96.00', '2026-10-26').totalMinor).toBe(9600)
  })

  it('ينبّه عند اختلاف مجموع الأصناف عن الإجمالي', () => {
    const r = parseReceipt('ماركت\nخبز 5.00\nحليب 7.50\nالإجمالي 20.00', '2026-10-26')
    expect(r.totalMinor).toBe(2000)
    expect(r.warnings.join(' ')).toMatch('مجموع الأصناف')
  })

  it('بلا كلمة إجمالي: أكبر مبلغ بثقة منخفضة وتحذير', () => {
    const r = parseReceipt('كشك\n3.00\n12.50\nهاتف 0599123456', '2026-10-26')
    expect(r).toMatchObject({ totalMinor: 1250, totalConfidence: 'low' })
    expect(r.warnings.join(' ')).toMatch('أكبر رقم')
  })

  it('علامات الاتجاه الخفية من القارئ لا تؤثر', () => {
    const r = parseReceipt('\u200eDate 20/10/2026\u200f\n\u200eTOTAL NIS 50.90\u200f', '2026-10-26')
    expect(r).toMatchObject({ totalMinor: 5090, date: '2026-10-20' })
  })

  it('في سطر الإجمالي يُفضَّل المبلغ العشري (القارئ حوّل ₪ إلى رقم)', () => {
    expect(parseReceipt('ماركت\nالإجمالي 34.50 8', '2026-10-26').totalMinor).toBe(3450)
  })

  it('الحفظ التلقائي فقط عند قراءة واضحة تماماً', () => {
    expect(canAutoSave(parseReceipt(supermarket, '2026-10-26'))).toBe(true)
    // رقم مبدَّل في الإجمالي يخالف مجموع الأصناف ← لا حفظ تلقائي.
    expect(canAutoSave(parseReceipt(supermarket.replace('الإجمالي 34.50', 'الإجمالي 34.59'), '2026-10-26'))).toBe(false)
    // بلا أصناف لا يوجد ما يؤكد الإجمالي.
    expect(canAutoSave(parseReceipt('ماركت\nالتاريخ 24/10/2026\nالإجمالي 34.50', '2026-10-26'))).toBe(false)
    expect(canAutoSave(parseReceipt('محطة\n2026-10-2\nالمبلغ المستحق 213.00', '2026-10-26'))).toBe(false)
    expect(canAutoSave(parseReceipt('كشك\n3.00\n12.50', '2026-10-26'))).toBe(false)
  })

  it('نص غير مقروء: لا مبلغ، وتحذيرات واضحة', () => {
    const r = parseReceipt('~~ ## ..', '2026-10-26')
    expect(r).toMatchObject({ totalMinor: null, totalConfidence: null, date: null })
    expect(r.warnings).toContain('تعذّرت قراءة المبلغ. أدخله يدوياً.')
  })
})
