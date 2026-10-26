import { expect, test } from '@playwright/test'

test('سياسة أمان المحتوى مفعّلة، ولا تمنع أي جزء من التطبيق', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text())
  })
  const outside: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('http://localhost:4173/') && !url.startsWith('blob:') && !url.startsWith('data:')) outside.push(url)
  })

  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'self'/)
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  for (const path of ['/', '/transactions', '/transactions/new?type=expense', '/reports', '/debts', '/budgets', '/settings', '/settings/accounts', '/settings/categories', '/settings/backup', '/scan']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }

  expect(violations).toEqual([])
  // البيانات لا تغادر الجهاز: لا طلبات إلى أي نطاق خارجي.
  expect(outside).toEqual([])
})
