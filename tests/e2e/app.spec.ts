import { expect, test, type Page } from '@playwright/test'

async function finishOnboarding(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('الصفحة عربية باتجاه RTL وتبدأ بشاشة البداية ثم الترحيب', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('status', { name: 'جارٍ فتح قِرْش' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'أهلاً بك في قِرْش' })).toBeVisible()
  await expect(page).toHaveURL(/\/welcome$/)
  await expectNoHorizontalOverflow(page)
})

test('الترحيب يظهر مرة واحدة ويُتذكَّر بعد إعادة التحميل', async ({ page }) => {
  await finishOnboarding(page)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})

test('التنقل السفلي يعمل ويبدأ من اليمين', async ({ page }) => {
  await finishOnboarding(page)
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' })

  const home = await nav.getByRole('link', { name: 'الرئيسية' }).boundingBox()
  const settings = await nav.getByRole('link', { name: 'الإعدادات' }).boundingBox()
  expect(home!.x).toBeGreaterThan(settings!.x)

  for (const name of ['العمليات', 'الميزانيات', 'الإعدادات', 'الرئيسية']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('صفحة نظام التصميم تُعرض دون تجاوز عرض الشاشة', async ({ page }) => {
  await finishOnboarding(page)
  // الرابط مخفي في نسخة الإنتاج، والصفحة متاحة بعنوانها.
  await page.goto('/settings')
  await expect(page.getByRole('link', { name: 'معاينة نظام التصميم' })).toHaveCount(0)
  await page.goto('/design')
  await expect(page.getByRole('heading', { level: 1, name: 'نظام التصميم' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('التطبيق يفتح ويتنقل دون إنترنت بعد الزيارة الأولى', async ({ page, context }) => {
  await finishOnboarding(page)
  // انتظار تفعيل الـ Service Worker وتخزين الملفات مسبقاً.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
  await expect(page.getByText('دون اتصال — بياناتك محفوظة على جهازك')).toBeVisible()

  await page.goto('/budgets')
  await expect(page.getByRole('heading', { level: 1, name: 'الميزانيات' })).toBeVisible()

  // الخط العربي متاح من التخزين المحلي وليس من الإنترنت.
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('16px "Cairo Variable"', 'قرش')
  })
  expect(fontLoaded).toBe(true)
})

test('ملف manifest صالح لتثبيت التطبيق', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest).toMatchObject({ lang: 'ar', dir: 'rtl', display: 'standalone', start_url: '/' })
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  for (const icon of manifest.icons) {
    expect((await request.get(`/${icon.src}`)).ok()).toBe(true)
  }
})
