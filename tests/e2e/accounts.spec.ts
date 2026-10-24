import { expect, test, type Page } from '@playwright/test'

async function openAccounts(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'الإعدادات' }).click()
  await page.getByRole('link', { name: /إدارة الحسابات/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()
}

async function addAccount(page: Page, opts: { type: string; name?: string; currency?: string; balance: string }) {
  await page.getByRole('link', { name: 'إضافة حساب' }).click()
  await page.getByRole('radio', { name: opts.type }).check()
  if (opts.name) await page.getByLabel('اسم الحساب').fill(opts.name)
  if (opts.currency) await page.getByRole('radio', { name: opts.currency }).check()
  await page.getByLabel('الرصيد الافتتاحي').fill(opts.balance)
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()
}

const accountList = (page: Page) => page.getByRole('list', { name: 'الحسابات' })

test('حساب «نقد» موجود افتراضياً، وتبقى الحسابات المضافة بعد إغلاق التطبيق وفتحه', async ({ page, context }) => {
  await openAccounts(page)
  await expect(accountList(page).getByRole('link')).toHaveCount(1)
  await expect(accountList(page)).toContainText('نقد')
  await expect(accountList(page)).toContainText('0.00 ₪')

  await addAccount(page, { type: 'جوال باي', balance: '150.50' })
  await addAccount(page, { type: 'حساب بنكي', name: 'بنك فلسطين', currency: 'دولار', balance: '١٢٠٠' })

  await expect(accountList(page).getByRole('link')).toHaveCount(3)
  await expect(accountList(page)).toContainText('150.50 ₪')
  await expect(accountList(page)).toContainText('1,200.00 $')
  // كل عملة في مجموع مستقل.
  await expect(page.getByText('مجموع أرصدة شيكل')).toBeVisible()
  await expect(page.getByText('مجموع أرصدة دولار')).toBeVisible()

  // إغلاق الصفحة وفتح صفحة جديدة (كإغلاق التطبيق وإعادة فتحه).
  const url = page.url()
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(url)
  await expect(accountList(reopened).getByRole('link')).toHaveCount(3)
  await expect(accountList(reopened)).toContainText('جوال باي')
  await expect(accountList(reopened)).toContainText('بنك فلسطين')
})

test('التحقق من الحقول برسائل عربية واضحة', async ({ page }) => {
  await openAccounts(page)
  await page.getByRole('link', { name: 'إضافة حساب' }).click()

  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByText('أدخل المبلغ.')).toBeVisible()

  const balance = page.getByLabel('الرصيد الافتتاحي')
  await balance.fill('12.345')
  await balance.blur()
  await expect(page.getByText('المبلغ يقبل خانتين بعد الفاصلة فقط.')).toBeVisible()
  // الخطأ يختفي فور التعديل.
  await balance.fill('12.3')
  await expect(page.getByText('المبلغ يقبل خانتين بعد الفاصلة فقط.')).toBeHidden()

  await page.getByRole('radio', { name: 'نقد (كاش)' }).check()
  await expect(page.getByLabel('اسم الحساب')).toHaveValue('نقد')
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByText('يوجد حساب بالاسم والعملة نفسيهما')).toBeVisible()
})

test('تعديل الحساب وحذفه بتأكيد، ومنع حذف آخر حساب', async ({ page }) => {
  await openAccounts(page)
  await addAccount(page, { type: 'بال باي', balance: '75' })

  await accountList(page).getByRole('link', { name: /بال باي/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'تعديل الحساب' })).toBeVisible()
  await expect(page.getByLabel('الرصيد الافتتاحي')).toHaveValue('75.00')
  await page.getByLabel('الرصيد الافتتاحي').fill('-20')
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click()
  await expect(accountList(page)).toContainText('-20.00 ₪')

  // الحذف يحتاج تأكيداً، و«إلغاء» لا يحذف شيئاً.
  await accountList(page).getByRole('link', { name: /بال باي/ }).click()
  await page.getByRole('button', { name: 'حذف الحساب' }).click()
  const dialog = page.getByRole('dialog', { name: 'حذف حساب «بال باي»؟' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'إلغاء' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'حذف الحساب' }).click()
  await dialog.getByRole('button', { name: 'حذف الحساب' }).click()
  await expect(accountList(page).getByRole('link')).toHaveCount(1)

  // آخر حساب لا يُحذف.
  await accountList(page).getByRole('link', { name: /نقد/ }).click()
  await page.getByRole('button', { name: 'حذف الحساب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الحساب' }).click()
  await expect(page.getByRole('alert')).toContainText('لا يمكن حذف آخر حساب')
})

test('إضافة حساب دون إنترنت، ويبقى بعد إعادة الفتح دون إنترنت', async ({ page, context }) => {
  await openAccounts(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await addAccount(page, { type: 'بال باي', balance: '33.25' })
  await page.reload()
  await expect(accountList(page)).toContainText('33.25 ₪')
  await expect(page.getByText('دون اتصال — بياناتك محفوظة على جهازك')).toBeVisible()
})

test('الإعدادات تعرض حالة التخزين والنسخ الاحتياطي', async ({ page }) => {
  await openAccounts(page)
  await page.getByRole('navigation').getByRole('link', { name: 'الإعدادات' }).click()
  await expect(page.getByText('على هذا الجهاز فقط، داخل المتصفح')).toBeVisible()
  await expect(page.getByText('لم تُنشأ نسخة احتياطية بعد')).toBeVisible()
  await expect(page.getByText('حساب واحد')).toBeVisible()
})
