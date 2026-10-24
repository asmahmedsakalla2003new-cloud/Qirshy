import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { initDatabase } from '../data/init'
import { routes } from './routes'

async function markOnboarded() {
  await db.settings.update('app', { onboardedAt: new Date().toISOString() })
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('التنقل', () => {
  beforeEach(async () => {
    await initDatabase()
  })

  it('يعرض الشاشة الترحيبية للمستخدم الجديد', async () => {
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: 'أهلاً بك في قِرْش' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/welcome')
  })

  it('«ابدأ الآن» ينقل إلى الرئيسية ولا تعود الشاشة الترحيبية', async () => {
    const router = renderAt('/')
    await userEvent.click(await screen.findByRole('button', { name: 'ابدأ الآن' }))
    expect(await screen.findByRole('heading', { name: 'الرئيسية' })).toBeInTheDocument()

    await router.navigate('/welcome')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('شريط التنقل ينقل بين الشاشات الأساسية', async () => {
    await markOnboarded()
    renderAt('/')
    const nav = await screen.findByRole('navigation', { name: 'التنقل الرئيسي' })
    expect(nav).toBeInTheDocument()

    for (const name of ['العمليات', 'الميزانيات', 'الإعدادات', 'الرئيسية']) {
      await userEvent.click(screen.getByRole('link', { name }))
      expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
      expect(screen.getByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    }
  })

  it('المسار غير المعروف يعود إلى الرئيسية', async () => {
    await markOnboarded()
    const router = renderAt('/no-such-page')
    expect(await screen.findByRole('heading', { name: 'الرئيسية' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
