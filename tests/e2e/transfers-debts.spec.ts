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

const accountRow = (page: Page, name: RegExp) => page.getByRole('list', { name: 'الحسابات' }).getByRole('link', { name })

test('تحويل بالعملة نفسها ينقل الرصيد ولا يُحتسب دخلاً أو مصروفاً أو في الميزانية', async ({ page }) => {
  await start(page)
  await page.goto('/transfers/new')
  await expect(page.getByText('تحتاج حسابين على الأقل')).toBeVisible()

  await addAccount(page, 'جوال باي', 'شيكل', '0')
  await page.goto('/settings/accounts')
  await accountRow(page, /نقد/).click()
  await page.getByLabel('الرصيد الافتتاحي').fill('1000')
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()

  // ميزانية عامة لنتأكد أن التحويل لا يدخلها.
  await page.goto('/budgets/new')
  await page.getByLabel('المبلغ الشهري').fill('100')
  await page.getByRole('button', { name: 'إضافة الميزانية' }).click()
  await expect(page.getByText('أُضيفت الميزانية.')).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'تحويل', exact: true }).click()
  await page.getByRole('group', { name: 'من حساب' }).getByRole('radio', { name: /نقد/ }).check()
  await page.getByRole('group', { name: 'إلى حساب' }).getByRole('radio', { name: /جوال باي/ }).check()
  await page.getByLabel('المبلغ', { exact: true }).fill('250')
  await page.getByLabel('الوصف').fill('شحن المحفظة')
  await page.getByRole('button', { name: 'حفظ التحويل' }).click()
  await expect(page.getByText('أُضيف التحويل.')).toBeVisible()

  const row = page.getByRole('link', { name: /شحن المحفظة/ })
  await expect(row).toContainText('من نقد إلى جوال باي')
  await expect(row).toContainText('250.00 ₪')
  await expect(row).not.toContainText('-250')
  // لا ملخص دخل/مصروف لأن لا عمليات.
  await expect(page.getByRole('region', { name: 'ملخص العمليات المعروضة' })).toHaveCount(0)

  await page.goto('/settings/accounts')
  await expect(accountRow(page, /نقد/)).toContainText('750.00 ₪')
  await expect(accountRow(page, /جوال باي/)).toContainText('250.00 ₪')
  await expect(page.locator('.total', { hasText: 'شيكل' })).toContainText('1,000.00 ₪')

  await page.goto('/budgets')
  await expect(page.locator('.budget-card')).toContainText('صُرف 0.00 ₪ من 100.00 ₪')

  // تصفية «تحويل» ثم حذف التحويل.
  await page.goto('/transactions?type=transfer')
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(1)
  await page.getByRole('link', { name: /شحن المحفظة/ }).click()
  await page.getByRole('button', { name: 'حذف التحويل' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف التحويل' }).click()
  await expect(page.getByText('حُذف التحويل.')).toBeVisible()
  await page.goto('/settings/accounts')
  await expect(accountRow(page, /نقد/)).toContainText('1,000.00 ₪')
})

test('تحويل بين عملتين بمبلغين وسعر صرف محسوب', async ({ page }) => {
  await start(page)
  await addAccount(page, 'حساب بنكي', 'دولار', '500')
  await page.goto('/transfers/new')
  await page.getByRole('group', { name: 'من حساب' }).getByRole('radio', { name: /البنك/ }).check()
  await page.getByRole('group', { name: 'إلى حساب' }).getByRole('radio', { name: /نقد/ }).check()
  await page.getByLabel('المبلغ المحوَّل (دولار)').fill('100')
  await page.getByRole('button', { name: 'حفظ التحويل' }).click()
  await expect(page.getByText('أدخل المبلغ.')).toBeVisible()
  await page.getByLabel('المبلغ الواصل (شيكل)').fill('365')
  await expect(page.getByText('سعر الصرف المحسوب: 1 $ = 3.65 ₪')).toBeVisible()
  await page.getByRole('button', { name: 'حفظ التحويل' }).click()
  await expect(page.getByText('أُضيف التحويل.')).toBeVisible()

  await page.goto('/settings/accounts')
  await expect(accountRow(page, /البنك/)).toContainText('400.00 $')
  await expect(accountRow(page, /نقد/)).toContainText('365.00 ₪')
})

test('الديون: دفعات جزئية ثم تسديد كامل، دون تغيير الأرصدة', async ({ page }) => {
  await start(page)
  await page.getByRole('navigation').getByRole('link', { name: 'الديون' }).click()
  await expect(page.getByText('لا ديون لك عند أحد')).toBeVisible()

  await page.getByRole('link', { name: 'إضافة دين' }).click()
  await page.getByLabel(/اسم المدين/).fill('أحمد')
  await page.getByLabel('المبلغ', { exact: true }).fill('500')
  await page.getByRole('button', { name: 'حفظ الدين' }).click()
  await expect(page.getByText('أُضيف الدين.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'أحمد' })).toBeVisible()
  await expect(page.getByText('غير مسدَّد')).toBeVisible()

  // دفعة جزئية، ثم دفعة أكبر من المتبقي مرفوضة.
  await page.getByLabel('مبلغ الدفعة').fill('200')
  await page.getByRole('button', { name: 'تسجيل الدفعة' }).click()
  await expect(page.getByText('سُجّلت الدفعة.')).toBeVisible()
  await expect(page.locator('.tx-hero__amount')).toContainText('300.00 ₪')
  await page.getByLabel('مبلغ الدفعة').fill('301')
  await page.getByRole('button', { name: 'تسجيل الدفعة' }).click()
  await expect(page.getByText('الدفعة أكبر من المتبقي من الدين.')).toBeVisible()

  await page.goto('/debts')
  await expect(page.locator('.total')).toContainText('300.00 ₪')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'ملخص الديون' })).toContainText('300.00 ₪')
  // رصيد «نقد» لم يتغيّر بالدين ولا بالدفعة.
  await page.goto('/settings/accounts')
  await expect(accountRow(page, /نقد/)).toContainText('0.00 ₪')

  await page.goto('/debts')
  await page.getByRole('link', { name: /أحمد/ }).click()
  await page.getByRole('button', { name: 'تسديد الكل' }).click()
  await expect(page.getByText('سُدّد الدين بالكامل.')).toBeVisible()
  await expect(page.getByText('مسدَّد بالكامل')).toBeVisible()
  await expect(page.getByLabel('مبلغ الدفعة')).toHaveCount(0)

  await page.goto('/debts')
  await expect(page.getByRole('list', { name: 'ديون مسدَّدة' })).toContainText('أحمد')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'ملخص الديون' })).toHaveCount(0)
})

test('دين عليّ متأخر عن موعده، وحذف دفعة يعيدها للمتبقي', async ({ page }) => {
  await start(page)
  await page.goto('/debts/new?dir=owed_by_me')
  await page.getByLabel(/اسم الدائن/).fill('محل الأمانة')
  await page.getByLabel('المبلغ', { exact: true }).fill('120')
  await page.getByLabel('تاريخ الدين').fill('2026-01-01')
  await page.getByLabel('موعد السداد').fill('2026-02-01')
  await page.getByRole('button', { name: 'حفظ الدين' }).click()
  await expect(page.getByText('فات موعد السداد')).toBeVisible()

  await page.getByLabel('مبلغ الدفعة').fill('20')
  await page.getByRole('button', { name: 'تسجيل الدفعة' }).click()
  await expect(page.locator('.tx-hero__amount')).toContainText('100.00 ₪')
  await page.getByRole('list', { name: 'الدفعات' }).getByRole('button', { name: 'حذف' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف الدفعة' }).click()
  await expect(page.locator('.tx-hero__amount')).toContainText('120.00 ₪')

  await page.goto('/debts?dir=owed_by_me')
  await expect(page.getByRole('list', { name: 'ديون غير مسدَّدة' })).toContainText('فات موعد السداد')
  await expect(page.locator('.total')).toContainText('المتبقي عليك')
})

test('شريط التنقل بخمسة عناصر يتسع لشاشة 360 بكسل', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await start(page)
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' })
  await expect(nav.getByRole('link')).toHaveCount(5)
  for (const name of ['الرئيسية', 'العمليات', 'الميزانيات', 'الديون', 'الإعدادات']) {
    const box = await nav.getByRole('link', { name }).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(48)
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
