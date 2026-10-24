import { describe, expect, it } from 'vitest'
import { formatMoney, parseAmount, toInputValue } from './money'

describe('parseAmount', () => {
  it.each([
    ['125.50', 12550],
    ['125.5', 12550],
    ['125', 12500],
    ['0.01', 1],
    ['1,250.75', 125075],
    ['12,5', 1250],
    ['١٢٥٫٥٠', 12550],
    ['۱۲۵', 12500],
    ['  40  ', 4000],
    ['0.1', 10],
    ['0.29', 29],
  ])('«%s» ← %i', (input, minor) => {
    expect(parseAmount(input)).toEqual({ ok: true, minor })
  })

  it('لا يفقد الدقة في الكسور (0.29 × 100 = 28.999… في الأعداد العائمة)', () => {
    expect(parseAmount('1.15')).toEqual({ ok: true, minor: 115 })
    expect(parseAmount('4.35')).toEqual({ ok: true, minor: 435 })
  })

  it.each([
    ['', 'أدخل المبلغ.'],
    ['   ', 'أدخل المبلغ.'],
    ['abc', 'أدخل رقماً صحيحاً، مثل 125.50'],
    ['12.5.3', 'أدخل رقماً صحيحاً، مثل 125.50'],
    ['1e5', 'أدخل رقماً صحيحاً، مثل 125.50'],
    ['12.345', 'المبلغ يقبل خانتين بعد الفاصلة فقط.'],
    ['-5', 'لا يمكن أن يكون المبلغ سالباً.'],
    ['0', 'يجب أن يكون المبلغ أكبر من صفر.'],
    ['0.00', 'يجب أن يكون المبلغ أكبر من صفر.'],
    ['1000000000', 'المبلغ كبير جداً.'],
  ])('يرفض «%s»', (input, error) => {
    expect(parseAmount(input)).toEqual({ ok: false, error })
  })

  it('يقبل الصفر والسالب عند السماح بهما (مثل الرصيد الافتتاحي)', () => {
    expect(parseAmount('0', { allowZero: true })).toEqual({ ok: true, minor: 0 })
    expect(parseAmount('-0', { allowZero: true })).toEqual({ ok: true, minor: 0 })
    expect(parseAmount('-250.5', { allowNegative: true })).toEqual({ ok: true, minor: -25050 })
    expect(parseAmount('−250', { allowNegative: true })).toEqual({ ok: true, minor: -25000 })
  })
})

describe('formatMoney', () => {
  it('يعرض المبلغ برمز العملة وأرقام غربية', () => {
    expect(formatMoney(125075, 'ILS')).toBe('1,250.75 ₪')
    expect(formatMoney(5, 'USD')).toBe('0.05 $')
    expect(formatMoney(-25050, 'ILS')).toBe('-250.50 ₪')
    expect(formatMoney(0, 'USD')).toBe('0.00 $')
  })
})

describe('toInputValue', () => {
  it('يعكس parseAmount', () => {
    for (const minor of [0, 1, 99, 12550, -25005, 123456789]) {
      const parsed = parseAmount(toInputValue(minor), { allowNegative: true, allowZero: true })
      expect(parsed).toEqual({ ok: true, minor })
    }
  })
})
