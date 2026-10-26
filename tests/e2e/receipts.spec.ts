import { expect, test, type Browser, type Page } from '@playwright/test'

// القراءة الحقيقية على الجهاز تأخذ ثوانيَ، وأول مرة تحمّل أداة القراءة.
test.setTimeout(90_000)

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

/** صورة فاتورة تجريبية (بيانات وهمية) تُرسم في صفحة منفصلة. */
async function receiptImage(browser: Browser, lines: string[], style = ''): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: 420, height: 600 }, deviceScaleFactor: 2 })
  await page.setContent(
    `<html dir="rtl"><body style="margin:0;background:#ddd"><div id="r" style="width:340px;margin:20px auto;padding:24px;background:#fff;font:18px/1.6 monospace;color:#222;${style}">${lines
      .map((l) => `<div>${l}</div>`)
      .join('')}</div></body></html>`,
  )
  const buffer = await page.locator('#r').screenshot()
  await page.close()
  return buffer
}

const today = new Date()
const dd = String(today.getDate()).padStart(2, '0')
const mm = String(today.getMonth() + 1).padStart(2, '0')
const todayISO = `${today.getFullYear()}-${mm}-${dd}`
const clearReceipt = ['سوبرماركت الأمانة', `التاريخ: ${dd}/${mm}/${today.getFullYear()}`, 'خبز 5.00', 'حليب 7.50', 'بيض 22.00', 'الإجمالي 34.50 ₪']

async function scan(page: Page, image: Buffer, name = 'receipt.png') {
  await page.goto('/scan')
  await page.getByText('اختيار صورة من الجهاز').locator('input').setInputFiles({ name, mimeType: 'image/png', buffer: image })
  await expect(page.getByRole('img', { name: 'صورة الفاتورة المختارة' })).toBeVisible()
  await page.getByRole('button', { name: 'قراءة الفاتورة' }).click()
}

test('تصوير فاتورة واضحة: تُقرأ على الجهاز وتملأ نموذج المصروف للمراجعة ثم الحفظ', async ({ page, browser }) => {
  await start(page)
  await page.getByRole('link', { name: 'تصوير فاتورة' }).click()
  await expect(page.getByText('الصورة لا تُرسل إلى أي خادم')).toBeVisible()

  await scan(page, await receiptImage(browser, clearReceipt))
  await expect(page.getByRole('heading', { level: 1, name: 'إضافة مصروف' })).toBeVisible({ timeout: 60_000 })

  const review = page.getByRole('region', { name: 'مراجعة الفاتورة' })
  await expect(review).toContainText('راجع ما قُرئ من الفاتورة')
  await expect(review).toContainText('بجانب كلمة «الإجمالي»')
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('34.50')
  await expect(page.getByLabel('التاريخ')).toHaveValue(todayISO)
  await expect(page.getByLabel('الوصف')).toHaveValue('سوبرماركت الأمانة')
  await expect(page.getByRole('group', { name: 'الفئة' }).getByRole('radio', { name: 'بقالة وطعام' })).toBeChecked()
  await review.getByText(/الأصناف المقروءة/).click()
  await expect(review.getByRole('list', { name: 'الأصناف المقروءة' })).toContainText('34.50 ₪')

  // يمكن التعديل قبل الحفظ.
  await page.getByLabel('المبلغ', { exact: true }).fill('35')
  await page.getByRole('button', { name: 'حفظ المصروف' }).click()
  await expect(page.getByText('أُضيف المصروف من الفاتورة.')).toBeVisible()
  await expect(page.getByRole('link', { name: /سوبرماركت الأمانة/ })).toContainText('-35.00 ₪')
})

test('صورة غير مقروءة: رسالة واضحة، وإعادة التصوير والإدخال اليدوي متاحان', async ({ page, browser }) => {
  await start(page)
  await scan(page, await receiptImage(browser, ['', '~ ~ ~'], 'filter: blur(6px)'))
  await expect(page.getByRole('alert')).toContainText('لم نتمكن من قراءة المبلغ', { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'إعادة التصوير' })).toBeEnabled()
  await page.getByRole('link', { name: 'إدخال يدوي' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'إضافة مصروف' })).toBeVisible()
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('')
})

test('ملف ليس صورة يُرفض برسالة', async ({ page }) => {
  await start(page)
  await page.goto('/scan')
  await page
    .getByText('اختيار صورة من الجهاز')
    .locator('input')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('نص') })
  await expect(page.getByRole('alert')).toContainText('الملف المختار ليس صورة')
})

test('الحفظ التلقائي (إن فُعّل) للقراءة الواضحة فقط، وإلا تظهر المراجعة', async ({ page, browser }) => {
  await start(page)
  await page.goto('/settings')
  await page.getByLabel(/حفظ تلقائي عند وضوح القراءة/).check()

  await scan(page, await receiptImage(browser, clearReceipt))
  await expect(page.getByText('حُفظ المصروف من الفاتورة تلقائياً')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('-34.50 ₪')

  // تاريخ بلا سنة كاملة = غير موثوق ← مراجعة رغم تفعيل الحفظ التلقائي.
  const partial = ['مقهى السرايا', `${dd}/${mm}/${String(today.getFullYear()).slice(2)}`, 'الإجمالي 21.50']
  await scan(page, await receiptImage(browser, partial))
  await expect(page.getByRole('region', { name: 'مراجعة الفاتورة' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('region', { name: 'مراجعة الفاتورة' })).toContainText('التاريخ المقروء قد يكون ناقصاً')
})

test('بعد أول استخدام تعمل القراءة دون إنترنت', async ({ page, browser, context }) => {
  await start(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const image = await receiptImage(browser, clearReceipt)
  await scan(page, image)
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('34.50', { timeout: 60_000 })

  await context.setOffline(true)
  await page.reload()
  await scan(page, image)
  await expect(page.getByLabel('المبلغ', { exact: true })).toHaveValue('34.50', { timeout: 60_000 })
})
