import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function add(page: Page, opts: { type?: 'expense' | 'income'; amount: string; category?: string; account?: RegExp; description?: string }) {
  await page.goto(`/transactions/new?type=${opts.type ?? 'expense'}`)
  await page.getByLabel('المبلغ', { exact: true }).fill(opts.amount)
  if (opts.account) await page.getByRole('radio', { name: opts.account }).check()
  if (opts.category) await page.getByRole('group', { name: 'الفئة' }).getByRole('radio', { name: opts.category }).check()
  if (opts.description) await page.getByLabel('الوصف').fill(opts.description)
  await page.getByRole('button', { name: /^حفظ (المصروف|الدخل)$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'العمليات' })).toBeVisible()
}

async function addUsdAccount(page: Page) {
  await page.goto('/settings/accounts/new')
  await page.getByRole('radio', { name: 'دولار' }).check()
  await page.getByLabel('الرصيد الافتتاحي').fill('0')
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()
}

test('تقرير الشهر: الملخص والتوزيع حسب الفئة والحساب، وكل عملة وحدها', async ({ page }) => {
  await start(page)
  await page.goto('/reports')
  await expect(page.getByText('لا توجد عمليات في هذه الفترة')).toBeVisible()

  await addUsdAccount(page)
  await add(page, { type: 'income', amount: '4000', category: 'راتب' })
  await add(page, { amount: '300', category: 'بقالة وطعام' })
  await add(page, { amount: '100', category: 'مواصلات' })
  await add(page, { amount: '25', category: 'تعليم', account: /البنك \$/ })

  // التحويل لا يدخل في التقارير.
  await page.goto('/transfers/new')
  await page.getByRole('group', { name: 'إلى حساب' }).getByRole('radio', { name: /البنك/ }).check()
  await page.getByLabel(/المبلغ المحوَّل/).fill('100')
  await page.getByLabel(/المبلغ الواصل/).fill('27')
  await page.getByRole('button', { name: 'حفظ التحويل' }).click()
  await expect(page.getByText('أُضيف التحويل.')).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'التقارير المفصّلة' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'التقارير' })).toBeVisible()
  await expect(page.locator('.summary')).toContainText('4,000.00 ₪')
  await expect(page.locator('.summary')).toContainText('400.00 ₪')
  await expect(page.locator('.summary')).toContainText('+3,600.00 ₪')

  const expenses = page.getByRole('list', { name: 'المصاريف حسب الفئة' })
  await expect(expenses.getByRole('link').nth(0)).toContainText('بقالة وطعام')
  await expect(expenses.getByRole('link').nth(0)).toContainText('75%')
  await expect(page.getByRole('list', { name: 'الدخل حسب الفئة' })).toContainText('راتب')
  await expect(page.getByRole('list', { name: 'المصاريف حسب الحساب' })).toContainText('نقد')

  // الدولار منفصل.
  await page.getByRole('radio', { name: 'دولار' }).check()
  await expect(page.locator('.summary')).toContainText('25.00 $')
  await expect(page.locator('.summary')).not.toContainText('₪')
  await expect(page.getByRole('list', { name: 'المصاريف حسب الفئة' })).toContainText('تعليم')

  // النقر على فئة يفتح السجل مصفّى.
  await page.getByRole('radio', { name: 'شيكل' }).check()
  await expenses.getByRole('link', { name: /مواصلات/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'العمليات' })).toBeVisible()
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)
})

test('فترة عدة أشهر تعرض كل شهر حتى الفارغ', async ({ page }) => {
  await start(page)
  await add(page, { amount: '50', category: 'مواصلات' })
  await page.goto('/reports')
  await page.getByRole('radio', { name: 'آخر 3 أشهر' }).check()
  const months = page.getByRole('list', { name: 'الدخل والمصروف حسب الشهر' })
  await expect(months.getByRole('listitem')).toHaveCount(3)
  await expect(months.getByRole('listitem').nth(2)).toContainText('50.00 ₪')
  await expect(months.getByRole('listitem').nth(0)).toContainText('0.00 ₪')

  await page.getByRole('radio', { name: 'فترة مخصصة' }).check()
  await page.getByLabel('من تاريخ').fill('2026-01-01')
  await page.getByLabel('إلى تاريخ').fill('2026-01-31')
  await expect(page.getByText('لا توجد عمليات في هذه الفترة')).toBeVisible()
})

test('تصدير CSV اختياري: ملف بالعربية بالعمليات في الفترة', async ({ page }) => {
  await start(page)
  await add(page, { amount: '125.50', category: 'بقالة وطعام', description: 'خبز, حليب' })
  await add(page, { type: 'income', amount: '1000', description: '=SUM(A1)' })
  await page.goto('/reports')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير ملف CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^qirsh-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/)
  await expect(page.getByText(/نُزّل الملف/)).toBeVisible()

  const text = await readFile((await download.path())!, 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff)
  const lines = text.slice(1).trimEnd().split('\r\n')
  expect(lines[0]).toBe('التاريخ,النوع,المبلغ,العملة,الحساب,إلى حساب,المبلغ الواصل,عملة الوصول,الفئة,الوصف')
  expect(lines).toHaveLength(3)
  expect(text).toContain('مصروف,125.50,ILS,نقد,,,,بقالة وطعام,"خبز, حليب"')
  // الصيغة معطّلة.
  expect(text).toContain(`دخل,1000.00,ILS,نقد,,,,,'=SUM(A1)`)
})
