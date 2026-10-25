import { expect, test, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function addTransaction(
  page: Page,
  opts: { type?: 'expense' | 'income'; amount: string; category?: string; account?: RegExp; description?: string },
) {
  await page.goto(`/transactions/new?type=${opts.type ?? 'expense'}`)
  await page.getByLabel('المبلغ').fill(opts.amount)
  if (opts.account) await page.getByRole('radio', { name: opts.account }).check()
  if (opts.category) await page.getByRole('group', { name: 'الفئة' }).getByRole('radio', { name: opts.category }).check()
  if (opts.description) await page.getByLabel('الوصف').fill(opts.description)
  await page.getByRole('button', { name: /^حفظ (المصروف|الدخل)$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'العمليات' })).toBeVisible()
}

const categoryGroup = (page: Page) => page.getByRole('group', { name: 'الفئة' })

test('الرئيسية: ملخص الشهر وتوزيع المصاريف على الفئات، والنقر على فئة يصفّي السجل', async ({ page }) => {
  await start(page)
  await expect(page.getByText('ابدأ بتسجيل أول عملية')).toBeVisible()

  await addTransaction(page, { amount: '300', category: 'بقالة وطعام', description: 'سوبرماركت' })
  await addTransaction(page, { amount: '100', category: 'بقالة وطعام' })
  await addTransaction(page, { amount: '100', category: 'مواصلات' })
  await addTransaction(page, { type: 'income', amount: '2000', category: 'راتب' })

  await page.getByRole('navigation').getByRole('link', { name: 'الرئيسية' }).click()
  const bars = page.getByRole('list', { name: 'المصاريف حسب الفئة بالشيكل' })
  await expect(bars.getByRole('link')).toHaveCount(2)
  // من الأكبر: بقالة 400 (80%) ثم مواصلات 100 (20%).
  await expect(bars.getByRole('link').nth(0)).toContainText('بقالة وطعام')
  await expect(bars.getByRole('link').nth(0)).toContainText('400.00 ₪')
  await expect(bars.getByRole('link').nth(0)).toContainText('80%')
  await expect(bars.getByRole('link').nth(1)).toContainText('20%')
  // الدخل لا يظهر في توزيع المصاريف.
  await expect(bars).not.toContainText('راتب')

  await expect(page.locator('.summary', { hasText: 'بالشيكل' })).toContainText('+1,500.00 ₪')
  await expect(page.locator('.total--link', { hasText: 'بالشيكل' })).toContainText('1,500.00 ₪')

  // أحدث العمليات تعرض الفئة.
  await expect(page.getByRole('region', { name: 'أحدث العمليات' }).getByRole('link', { name: /سوبرماركت/ })).toContainText(
    'بقالة وطعام',
  )

  await bars.getByRole('link', { name: /بقالة وطعام/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'العمليات' })).toBeVisible()
  await expect(page.locator('.day-group').getByRole('link')).toHaveCount(2)
  await expect(page.getByLabel('الفئة')).toHaveValue(/.+/)
})

test('الشيكل والدولار في توزيعين منفصلين، والتنقل بين الأشهر', async ({ page }) => {
  await start(page)
  await page.goto('/settings/accounts/new')
  await page.getByRole('radio', { name: 'دولار' }).check()
  await page.getByLabel('الرصيد الافتتاحي').fill('0')
  await page.getByRole('button', { name: 'إضافة الحساب' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الحسابات والمحافظ' })).toBeVisible()

  await addTransaction(page, { amount: '50', category: 'مواصلات' })
  await addTransaction(page, { amount: '20', category: 'تعليم', account: /البنك \$/ })

  await page.goto('/')
  await expect(page.getByRole('list', { name: 'المصاريف حسب الفئة بالشيكل' })).toContainText('مواصلات')
  await expect(page.getByRole('list', { name: 'المصاريف حسب الفئة بالشيكل' })).not.toContainText('تعليم')
  await expect(page.getByRole('list', { name: 'المصاريف حسب الفئة بالدولار' })).toContainText('20.00 $')

  await expect(page.getByRole('button', { name: 'الشهر التالي' })).toBeDisabled()
  await page.getByRole('button', { name: 'الشهر السابق' }).click()
  await expect(page.getByText(/لا توجد عمليات في/)).toBeVisible()
  await expect(page.getByRole('list', { name: /المصاريف حسب الفئة/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'الشهر التالي' }).click()
  await expect(page.getByRole('list', { name: 'المصاريف حسب الفئة بالشيكل' })).toBeVisible()
})

test('إضافة فئة خاصة وتعديلها وأرشفتها وإعادتها', async ({ page }) => {
  await start(page)
  await page.getByRole('navigation').getByRole('link', { name: 'الإعدادات' }).click()
  await page.getByRole('link', { name: /إدارة الفئات/ }).click()
  await expect(page.getByRole('list', { name: 'الفئات' }).getByRole('link')).toHaveCount(10)

  await page.getByRole('link', { name: 'إضافة فئة مصروف' }).click()
  await page.getByLabel('اسم الفئة').fill('مصروف البيت')
  await page.getByRole('button', { name: 'إضافة الفئة' }).click()
  await expect(page.getByText('أُضيفت الفئة.')).toBeVisible()
  // قبل «أخرى».
  const items = page.getByRole('list', { name: 'الفئات' }).getByRole('link')
  await expect(items.nth(-2)).toHaveText('مصروف البيت')
  await expect(items.nth(-1)).toHaveText('أخرى')

  // الاسم المكرر مرفوض.
  await page.getByRole('link', { name: 'إضافة فئة مصروف' }).click()
  await page.getByLabel('اسم الفئة').fill('مواصلات')
  await page.getByRole('button', { name: 'إضافة الفئة' }).click()
  await expect(page.getByText('توجد فئة بهذا الاسم.')).toBeVisible()

  // تسجيل عملية بالفئة الجديدة.
  await addTransaction(page, { amount: '75', category: 'مصروف البيت', description: 'منظفات' })

  // إعادة التسمية تنعكس على العمليات.
  await page.goto('/settings/categories')
  await page.getByRole('link', { name: 'مصروف البيت' }).click()
  await expect(page.getByText('مستخدمة في عملية واحدة')).toBeVisible()
  await expect(page.getByRole('button', { name: 'حذف الفئة' })).toHaveCount(0)
  await page.getByLabel('اسم الفئة').fill('مستلزمات البيت')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.getByText('حُفظت الفئة.')).toBeVisible()
  await page.goto('/transactions')
  await expect(page.getByRole('link', { name: /منظفات/ })).toContainText('مستلزمات البيت')

  // الأرشفة: تختفي من نموذج العملية وتبقى في العمليات القديمة.
  await page.goto('/settings/categories')
  await page.getByRole('list', { name: 'الفئات' }).getByRole('link', { name: 'مستلزمات البيت' }).click()
  await page.getByRole('button', { name: 'أرشفة الفئة' }).click()
  await expect(page.getByText('أُرشفت فئة «مستلزمات البيت».')).toBeVisible()
  await expect(page.getByRole('list', { name: 'الفئات المؤرشفة' })).toContainText('مستلزمات البيت')

  await page.goto('/transactions/new')
  await expect(categoryGroup(page).getByRole('radio', { name: 'مستلزمات البيت' })).toHaveCount(0)
  await page.goto('/transactions')
  await expect(page.getByRole('link', { name: /منظفات/ })).toContainText('مستلزمات البيت')

  await page.goto('/settings/categories')
  await page.getByRole('list', { name: 'الفئات المؤرشفة' }).getByRole('link').click()
  await page.getByRole('button', { name: 'إعادة الفئة' }).click()
  await expect(page.getByText('أُعيدت فئة «مستلزمات البيت».')).toBeVisible()
  await page.goto('/transactions/new')
  await expect(categoryGroup(page).getByRole('radio', { name: 'مستلزمات البيت' })).toHaveCount(1)
})

test('حذف فئة غير مستخدمة بتأكيد، وفئات الدخل منفصلة', async ({ page }) => {
  await start(page)
  await page.goto('/settings/categories?kind=income')
  await expect(page.getByRole('list', { name: 'الفئات' }).getByRole('link')).toHaveCount(4)
  await page.getByRole('link', { name: 'هدية' }).click()
  await page.getByRole('button', { name: 'حذف الفئة' }).click()
  await page.getByRole('dialog', { name: 'حذف فئة «هدية»؟' }).getByRole('button', { name: 'حذف الفئة' }).click()
  await expect(page.getByText('حُذفت فئة «هدية».')).toBeVisible()
  await expect(page.getByRole('list', { name: 'الفئات' }).getByRole('link')).toHaveCount(3)

  // نموذج الدخل يعرض فئات الدخل فقط، وتغيير النوع يبدّل الفئات.
  await page.goto('/transactions/new?type=income')
  await expect(categoryGroup(page).getByRole('radio', { name: 'راتب' })).toBeVisible()
  await expect(categoryGroup(page).getByRole('radio', { name: 'مواصلات' })).toHaveCount(0)
  await categoryGroup(page).getByRole('radio', { name: 'راتب' }).check()
  await page.getByRole('radio', { name: 'مصروف' }).check()
  await expect(categoryGroup(page).getByRole('radio', { name: 'بلا فئة' })).toBeChecked()
  await expect(categoryGroup(page).getByRole('radio', { name: 'مواصلات' })).toBeVisible()
})
