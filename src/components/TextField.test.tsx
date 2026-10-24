import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('يربط العنوان والتلميح بالحقل', () => {
    render(<TextField label="المبلغ" hint="بالشيكل" />)
    const input = screen.getByLabelText('المبلغ')
    expect(input).toHaveAccessibleDescription('بالشيكل')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('يعرض الخطأ ويعلّم الحقل بأنه غير صالح', () => {
    render(<TextField label="المبلغ" hint="بالشيكل" error="أدخل المبلغ." />)
    const input = screen.getByLabelText('المبلغ')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('أدخل المبلغ.')
  })
})
