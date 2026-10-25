import { describe, expect, it } from 'vitest'
import { formatDate, formatDayHeading, isValidISODate, todayISO } from './dates'

describe('dates', () => {
  it('todayISO يستخدم التاريخ المحلي بصيغة YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayISO(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('isValidISODate يقبل التواريخ الحقيقية فقط', () => {
    expect(isValidISODate('2026-10-25')).toBe(true)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-02-30')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('25/10/2026')).toBe(false)
    expect(isValidISODate('')).toBe(false)
  })

  it('يعرض التاريخ بأسماء الأشهر الشامية وأرقام غربية', () => {
    expect(formatDate('2026-10-25')).toBe('25 تشرين الأول 2026')
  })

  it('عناوين الأيام: اليوم، أمس، ثم التاريخ الكامل', () => {
    expect(formatDayHeading('2026-03-01', '2026-03-01')).toBe('اليوم')
    expect(formatDayHeading('2026-02-28', '2026-03-01')).toBe('أمس')
    expect(formatDayHeading('2026-02-27', '2026-03-01')).toContain('27 شباط 2026')
  })
})
