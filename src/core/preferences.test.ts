import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeOnboarding, hasCompletedOnboarding } from './preferences'

describe('preferences', () => {
  afterEach(() => vi.restoreAllMocks())

  it('المستخدم الجديد لم يُكمل الترحيب', () => {
    expect(hasCompletedOnboarding()).toBe(false)
  })

  it('يتذكّر إكمال الترحيب في التخزين المحلي', () => {
    completeOnboarding()
    expect(localStorage.getItem('qirsh.onboarded')).toBe('1')
    expect(hasCompletedOnboarding()).toBe(true)
  })

  it('لا يتعطل عند حجب التخزين، ويتذكّر التفضيل في الذاكرة', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => completeOnboarding()).not.toThrow()
    expect(hasCompletedOnboarding()).toBe(true)
  })
})
