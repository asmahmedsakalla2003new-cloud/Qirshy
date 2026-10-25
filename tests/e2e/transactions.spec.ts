import { expect, test, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function addAccount(page: Page, type: string, currency: string, balance: string) {
  await page.goto('/settings/accounts/new')
  await page.getByRole('radio', { name: type }).check()
  await page.getByRole('radio', { name: currency }).check()
  await page.getByLabel('الرصيد الافتتاحي').fill(balance)
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()
}

async function addTransaction(
  page: Page,
  opts: { type?: 'مصروف' | 'دخل'; amount: string; account?: RegExp; description?: string; date?: string },
) {
  await page.getByRole('navigation').getByRole('link', { name: 'العمليات' }).click()
  await page.getByRole('link', { name: /إضافة (أول )?عملية/ }).first().click()
  if (opts.type) await page.getByRole('radio', { name: opts.type }).check()
  await page.getByLabel('المبلغ').fill(opts.amount)
  if (opts.account) await page.getByRole('radio', { name: opts.account }).check()
  if (opts.date) await page.getByLabel('التاريخ').fill(opts.date)
  if (opts.description) await page.getByLabel('الوصف').fill(opts.description)
  await page.getByRole('button', { name: /^حفظ (المصروف|الدخل)$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'العمليات' })).toBeVisible()
}

const summaryCard = (page: Page, currency: 'بالشيكل' | 'بالدولار') =>
  page.getByRole('region', { name: 'ملخص العمليات المعروضة' }).locator('.summary', { hasText: currency })

test('إضافة مصروف ودخل، وتحديث الملخص ورصيد الحساب، وبقاؤها بعد إعادة الفتح', async ({ page }) => {
  await start(page)
  await page.getByRole('navigation').getByRole('link', { name: 'العمليات' }).click()
  await expect(page.getByText('لا توجد عمليات بعد')).toBeVisible()

  await addTransaction(page, { amount: '125.50', description: 'بقالة' })
  await expect(page.getByRole('status').filter({ hasText: 'أُضيف المصروف.' })).toBeVisible()
  await addTransaction(page, { type: 'دخل', amount: '3000', description: 'راتب' })

  const today = page.getByRole('region', { name: 'اليوم' })
  await expect(today.getByRole('link')).toHaveCount(2)
  await expect(today.getByRole('link', { name: /بقالة/ })).toContainText('-125.50 ₪')
  await expect(today.getByRole('link', { name: /راتب/ })).toContainText('+3,000.00 ₪')
  await expect(summaryCard(page, 'بالشيكل')).toContainText('+2,874.50 ₪')

  // رصيد «نقد» = 0 + 3000 − 125.50
  await page.goto('/settings/accounts')
  await expect(page.getByRole('list', { name: 'الحسابات' })).toContainText('2,874.50 ₪')

  await page.reload()
  await page.goto('/transactions')
  await expect(page.getByRole('region', { name: 'اليوم' }).getByRole('link')).toHaveCount(2)
})

test('الشيكل والدولار في ملخصين منفصلين، والتعديل ينقل العملية بين الحسابات', async ({ page }) => {
  await start(page)
  await addAccount(page, 'حساب بنكي', 'دولار', '1000')
  await addTransaction(page, { amount: '50', description: 'اشتراك' })
  await addTransaction(page, { amount: '20', account: /البنك \$/, description: 'استضافة' })

  await expect(summaryCard(page, 'بالشيكل')).toContainText('50.00 ₪')
  await expect(summaryCard(page, 'بالدولار')).toContainText('20.00 $')
  await expect(summaryCard(page, 'بالدولار')).not.toContainText('₪')

  // تعديل «اشتراك»: نقله إلى حساب الدولار وتغيير المبلغ.
  await page.getByRole('link', { name: /اشتراك/ }).click()
  await page.getByRole('link', { name: 'تعديل العملية' }).click()
  await expect(page.getByLabel('المبلغ')).toHaveValue('50.00')
  await page.getByLabel('المبلغ').fill('30')
  await page.getByRole('radio', { name: /البنك \$/ }).check()
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click()
  await expect(page.getByText('حُفظت التعديلات.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('-30.00 $')

  await page.goto('/transactions')
  await expect(summaryCard(page, 'بالشيكل')).toHaveCount(0)
  await expect(summaryCard(page, 'بالدولار')).toContainText('50.00 $')

  await page.goto('/settings/accounts')
  const accounts = page.getByRole('list', { name: 'الحسابات' })
  await expect(accounts.getByRole('link', { name: /نقد/ })).toContainText('0.00 ₪')
  await expect(accounts.getByRole('link', { name: /البنك/ })).toContainText('950.00 $')
})

test('حذف عملية بتأكيد يعيد الرصيد، والحساب الذي له عمليات لا يُحذف', async ({ page }) => {
  await start(page)
  await addAccount(page, 'بال باي', 'شيكل', '0')
  await addTransaction(page, { amount: '40', description: 'مواصلات' })

  // الحساب «نقد» له عملية الآن.
  await page.goto('/settings/accounts')
  await page.getByRole('list', { name: 'الحسابات' }).getByRole('link', { name: /نقد/ }).click()
  await page.getByRole('button', { name: 'حذف الحساب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الحساب' }).click()
  await expect(page.getByRole('alert')).toContainText('لا يمكن حذف حساب له عمليات')

  await page.goto('/transactions')
  await page.getByRole('link', { name: /مواصلات/ }).click()
  await page.getByRole('button', { name: 'حذف العملية' }).click()
  const dialog = page.getByRole('dialog', { name: 'حذف المصروف؟' })
  await dialog.getByRole('button', { name: 'إلغاء' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('-40.00 ₪')

  await page.getByRole('button', { name: 'حذف العملية' }).click()
  await dialog.getByRole('button', { name: 'حذف العملية' }).click()
  await expect(page.getByText('حُذفت العملية.')).toBeVisible()
  await expect(page.getByText('لا توجد عمليات بعد')).toBeVisible()

  await page.goto('/settings/accounts')
  await expect(page.getByRole('list', { name: 'الحسابات' }).getByRole('link', { name: /نقد/ })).toContainText('0.00 ₪')
})

test('البحث والتصفية، وتبقى التصفية عند الرجوع من التفاصيل', async ({ page }) => {
  await start(page)
  await addTransaction(page, { amount: '15', description: 'قهوة', date: '2026-01-10' })
  await addTransaction(page, { amount: '200', description: 'فاتورة كهرباء' })
  await addTransaction(page, { type: 'دخل', amount: '500', description: 'عمل حر' })

  // كتابة سريعة حرفاً حرفاً: لا يضيع أي حرف.
  await page.getByLabel('بحث').pressSequentially('كهربا', { delay: 0 })
  await expect(page.getByLabel('بحث')).toHaveValue('كهربا')
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /فاتورة كهرباء/ })).toBeVisible()

  // الرجوع من التفاصيل يحافظ على البحث.
  await page.getByRole('link', { name: /فاتورة كهرباء/ }).click()
  await page.goBack()
  await expect(page.getByLabel('بحث')).toHaveValue('كهربا')
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)

  await page.getByRole('button', { name: 'مسح البحث والتصفية' }).first().click()
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(3)

  await page.getByText('التصفية', { exact: true }).click()
  await page.getByRole('radio', { name: 'دخل' }).check()
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)
  await page.getByRole('radio', { name: 'الكل' }).check()

  await page.getByLabel('من تاريخ').fill('2026-01-01')
  await page.getByLabel('إلى تاريخ').fill('2026-01-31')
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /قهوة/ })).toBeVisible()

  await page.getByLabel('بحث').fill('لا يوجد شيء كهذا')
  await expect(page.getByText('لا توجد نتائج')).toBeVisible()
})

test('التحقق من حقول العملية برسائل واضحة', async ({ page }) => {
  await start(page)
  await page.goto('/transactions/new')
  await page.getByRole('button', { name: 'حفظ المصروف' }).click()
  await expect(page.getByText('أدخل المبلغ.')).toBeVisible()

  await page.getByLabel('المبلغ').fill('0')
  await page.getByLabel('المبلغ').blur()
  await expect(page.getByText('يجب أن يكون المبلغ أكبر من صفر.')).toBeVisible()

  await page.getByLabel('المبلغ').fill('10')
  await page.getByLabel('التاريخ').fill('2099-01-01')
  await page.getByRole('button', { name: 'حفظ المصروف' }).click()
  await expect(page.getByText('لا يمكن أن يكون التاريخ في المستقبل.')).toBeVisible()
})

test('تسجيل عملية دون إنترنت، وتبقى بعد إعادة الفتح دون إنترنت', async ({ page, context }) => {
  await start(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await addTransaction(page, { amount: '18.75', description: 'خبز دون إنترنت' })
  await page.reload()
  await expect(page.getByRole('link', { name: /خبز دون إنترنت/ })).toContainText('-18.75 ₪')
  await expect(page.getByText('دون اتصال — بياناتك محفوظة على جهازك')).toBeVisible()
})
