import { expect, test, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function addBudget(page: Page, opts: { category?: string; currency?: 'شيكل' | 'دولار'; amount: string }) {
  await page.goto('/budgets/new')
  if (opts.category) {
    await page.getByRole('radio', { name: 'لفئة معيّنة' }).check()
    await page.getByLabel('الفئة').selectOption({ label: opts.category })
  }
  if (opts.currency) await page.getByRole('radio', { name: opts.currency }).check()
  await page.getByLabel('المبلغ الشهري').fill(opts.amount)
  await page.getByRole('button', { name: 'إضافة الميزانية' }).click()
  await expect(page.getByText('أُضيفت الميزانية.')).toBeVisible()
}

async function addExpense(page: Page, amount: string, category?: string, account?: RegExp) {
  await page.goto('/transactions/new?type=expense')
  await page.getByLabel('المبلغ').fill(amount)
  if (account) await page.getByRole('radio', { name: account }).check()
  if (category) await page.getByRole('group', { name: 'الفئة' }).getByRole('radio', { name: category }).check()
  await page.getByRole('button', { name: 'حفظ المصروف' }).click()
  await expect(page.getByText('أُضيف المصروف.')).toBeVisible()
}

const card = (page: Page, title: string) => page.locator('.budget-card', { hasText: title })

test('إضافة ميزانيات، وحساب المصروف والمتبقي، ومنع التكرار', async ({ page }) => {
  await start(page)
  await page.getByRole('navigation').getByRole('link', { name: 'الميزانيات' }).click()
  await expect(page.getByText('لم تُحدَّد ميزانية بعد')).toBeVisible()

  await addBudget(page, { amount: '1000' })
  await addBudget(page, { category: 'بقالة وطعام', amount: '500' })

  await page.goto('/budgets/new')
  await page.getByLabel('المبلغ الشهري').fill('50')
  await page.getByRole('button', { name: 'إضافة الميزانية' }).click()
  await expect(page.getByText('توجد ميزانية عامة بهذه العملة')).toBeVisible()

  await addExpense(page, '200', 'بقالة وطعام')
  await addExpense(page, '100', 'مواصلات')
  // الدخل والدولار لا يُحتسبان في ميزانية الشيكل.
  await page.goto('/transactions/new?type=income')
  await page.getByLabel('المبلغ').fill('5000')
  await page.getByRole('button', { name: 'حفظ الدخل' }).click()
  await expect(page.getByText('أُضيف الدخل.')).toBeVisible()

  await page.goto('/budgets')
  await expect(card(page, 'الميزانية العامة')).toContainText('صُرف 300.00 ₪ من 1,000.00 ₪')
  await expect(card(page, 'الميزانية العامة')).toContainText('المتبقي 700.00 ₪')
  await expect(card(page, 'الميزانية العامة')).toContainText('30%')
  await expect(card(page, 'بقالة وطعام')).toContainText('صُرف 200.00 ₪ من 500.00 ₪')
  await expect(page.getByRole('meter').first()).toHaveAttribute('aria-valuenow', '30')
})

test('تنبيه عند 80% ثم عند بلوغ الحد، دون تكرار بعد الإغلاق', async ({ page }) => {
  await start(page)
  await addBudget(page, { category: 'بقالة وطعام', amount: '500' })

  // 400 من 500 = 80% بالضبط.
  await addExpense(page, '400', 'بقالة وطعام')
  await expect(page.getByRole('alert').filter({ hasText: 'تنبيه الميزانية' })).toContainText(
    'اقتربت من حد ميزانية «بقالة وطعام» بالشيكل',
  )

  await page.goto('/')
  const alerts = page.getByRole('region', { name: 'تنبيهات الميزانية' })
  await expect(alerts).toContainText('اقتربت من حد')
  await alerts.getByRole('button', { name: 'حسناً' }).click()
  await expect(alerts).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'تنبيهات الميزانية' })).toHaveCount(0)

  // مصروف صغير لا يرفع المستوى: لا تنبيه جديد.
  await addExpense(page, '10', 'بقالة وطعام')
  await expect(page.getByText('تنبيه الميزانية')).toHaveCount(0)

  // بلوغ الحد: تنبيه جديد رغم إغلاق تنبيه الاقتراب.
  await addExpense(page, '150', 'بقالة وطعام')
  await expect(page.getByRole('alert').filter({ hasText: 'تنبيه الميزانية' })).toContainText('وصلت إلى حد')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'تنبيهات الميزانية' })).toContainText('وصلت إلى حد')

  await page.goto('/budgets')
  await expect(card(page, 'بقالة وطعام')).toContainText('تجاوزت بـ 60.00 ₪')
  await expect(card(page, 'بقالة وطعام')).toContainText('وصلت إلى الحد')
})

test('تغيير مبلغ شهر واحد، أو هذا الشهر والقادمة دون تغيير الماضي', async ({ page }) => {
  await start(page)
  await addBudget(page, { amount: '1000' })

  await card(page, 'الميزانية العامة').click()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('1000.00')
  await page.getByLabel('المبلغ', { exact: true }).fill('1500')
  await page.getByRole('radio', { name: 'هذا الشهر فقط' }).check()
  await page.getByRole('button', { name: 'حفظ المبلغ' }).click()
  await expect(page.getByText(/فقط\.$/)).toBeVisible()
  await expect(page.getByText('لهذا الشهر مبلغ خاص')).toBeVisible()

  // الشهر التالي على المبلغ المعتاد.
  await page.getByRole('button', { name: 'الشهر التالي' }).click()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('1000.00')

  // من الشهر التالي فصاعداً: 1200.
  await page.getByLabel('المبلغ', { exact: true }).fill('1200')
  await page.getByRole('radio', { name: 'هذا الشهر والأشهر القادمة' }).check()
  await page.getByRole('button', { name: 'حفظ المبلغ' }).click()
  await expect(page.getByText(/فصاعداً\.$/)).toBeVisible()
  await page.getByRole('button', { name: 'الشهر التالي' }).click()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('1200.00')

  // الشهر الحالي بقي بمبلغه الخاص، ثم العودة إلى المعتاد.
  await page.getByRole('button', { name: 'الشهر السابق' }).click()
  await page.getByRole('button', { name: 'الشهر السابق' }).click()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('1500.00')
  await page.getByRole('button', { name: 'العودة إلى المبلغ المعتاد' }).click()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('1000.00')
  await expect(page.getByText('لهذا الشهر مبلغ خاص')).toHaveCount(0)
})

test('ميزانية الدولار منفصلة، وحذف الميزانية بتأكيد', async ({ page }) => {
  await start(page)
  await page.goto('/settings/accounts/new')
  await page.getByRole('radio', { name: 'دولار' }).check()
  await page.getByLabel('الرصيد الافتتاحي').fill('0')
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()

  await addBudget(page, { amount: '100', currency: 'دولار' })
  await addBudget(page, { amount: '1000' })
  await addExpense(page, '30', undefined, /البنك \$/)

  await page.goto('/budgets')
  const usd = page.getByRole('region', { name: 'ميزانيات دولار' })
  const ils = page.getByRole('region', { name: 'ميزانيات شيكل' })
  await expect(usd).toContainText('صُرف 30.00 $ من 100.00 $')
  await expect(ils).toContainText('صُرف 0.00 ₪ من 1,000.00 ₪')

  await usd.locator('.budget-card').click()
  await page.getByRole('button', { name: 'حذف الميزانية' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الميزانية' }).click()
  await expect(page.getByText('حُذفت الميزانية.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'ميزانيات دولار' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'ميزانيات شيكل' })).toBeVisible()
})
