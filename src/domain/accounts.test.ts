import { describe, expect, it } from 'vitest'
import { validateAccount, type AccountInput } from './accounts'

const base: AccountInput = { name: 'جوال باي', type: 'jawwalpay', currency: 'ILS', openingBalanceMinor: 0 }

describe('validateAccount', () => {
  it('يقبل حساباً صحيحاً', () => {
    expect(validateAccount(base, [])).toEqual({})
  })

  it('يرفض الاسم الفارغ أو المسافات فقط', () => {
    expect(validateAccount({ ...base, name: '   ' }, []).name).toBe('أدخل اسم الحساب.')
  })

  it('يرفض الاسم الأطول من 40 حرفاً', () => {
    expect(validateAccount({ ...base, name: 'ا'.repeat(41) }, []).name).toMatch('الاسم طويل')
    expect(validateAccount({ ...base, name: 'ا'.repeat(40) }, [])).toEqual({})
  })

  it('يمنع تكرار الاسم بالعملة نفسها، ويسمح به بعملة مختلفة', () => {
    const existing = [{ name: 'البنك', currency: 'ILS' as const }]
    expect(validateAccount({ ...base, name: ' البنك ' }, existing).name).toMatch('يوجد حساب')
    expect(validateAccount({ ...base, name: 'البنك', currency: 'USD' }, existing)).toEqual({})
  })
})
