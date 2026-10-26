import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function start(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'ابدأ الآن' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible()
}

async function addExpense(page: Page, amount: string, description: string) {
  await page.goto('/transactions/new')
  await page.getByLabel('المبلغ', { exact: true }).fill(amount)
  await page.getByRole('group', { name: 'الفئة' }).getByRole('radio', { name: 'مواصلات' }).check()
  await page.getByLabel('الوصف').fill(description)
  await page.getByRole('button', { name: 'حفظ المصروف' }).click()
  await expect(page.getByText('أُضيف المصروف.')).toBeVisible()
}

async function createBackup(page: Page) {
  await page.goto('/settings/backup')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'إنشاء نسخة احتياطية' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^qirsh-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText(/أُنشئت النسخة الاحتياطية/)).toBeVisible()
  return (await download.path())!
}

async function chooseFile(page: Page, path: string) {
  await page.locator('input[type="file"]').setInputFiles(path)
}

test('إنشاء نسخة ثم استعادتها على جهاز آخر (متصفح جديد) تعيد البيانات نفسها', async ({ page, browser }) => {
  await start(page)
  await addExpense(page, '42.50', 'باص الجامعة')
  await page.goto('/debts/new')
  await page.getByLabel(/اسم المدين/).fill('سامر')
  await page.getByLabel('المبلغ', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'حفظ الدين' }).click()
  await expect(page.getByText('أُضيف الدين.')).toBeVisible()

  const path = await createBackup(page)
  await expect(page.getByText('لم تُنشأ بعد')).toHaveCount(0)
  const file = JSON.parse(await readFile(path, 'utf8'))
  expect(file).toMatchObject({ app: 'qirsh', formatVersion: 1 })
  expect(file.checksum).toMatch(/^sha256:/)

  // جهاز آخر: سياق متصفح جديد ببيانات فارغة.
  const other = await browser.newContext()
  const page2 = await other.newPage()
  await start(page2)
  await page2.goto('/settings/backup')
  await chooseFile(page2, path)
  const summary = page2.getByRole('region', { name: 'محتوى النسخة الاحتياطية' })
  await expect(summary).toContainText('عملية واحدة')
  await expect(summary).toContainText('دين واحد')
  await expect(summary).toContainText('الملف سليم')

  await page2.getByRole('button', { name: 'استعادة', exact: true }).click()
  const dialog = page2.getByRole('dialog', { name: 'استبدال كل بياناتك الحالية؟' })
  const [safety] = await Promise.all([page2.waitForEvent('download'), dialog.getByRole('button', { name: 'استبدال البيانات' }).click()])
  expect(safety.suggestedFilename()).toMatch(/^qirsh-before-restore-/)
  await expect(page2.getByText('اكتملت الاستعادة')).toBeVisible()

  await page2.goto('/transactions')
  await expect(page2.getByRole('link', { name: /باص الجامعة/ })).toContainText('-42.50 ₪')
  await page2.goto('/debts')
  await expect(page2.getByRole('list', { name: 'ديون غير مسدَّدة' })).toContainText('سامر')
  // البيانات المستعادة تبقى بعد إعادة التحميل.
  await page2.reload()
  await expect(page2.getByRole('list', { name: 'ديون غير مسدَّدة' })).toContainText('سامر')
  await other.close()
})

test('الاستعادة تستبدل البيانات الحالية فقط بعد التأكيد، و«إلغاء» لا يغيّر شيئاً', async ({ page }) => {
  await start(page)
  await addExpense(page, '10', 'قبل النسخ')
  const path = await createBackup(page)
  await addExpense(page, '20', 'بعد النسخ')

  await page.goto('/settings/backup')
  await chooseFile(page, path)
  await page.getByRole('button', { name: 'استعادة', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء' }).click()
  await page.getByRole('region', { name: 'محتوى النسخة الاحتياطية' }).getByRole('button', { name: 'إلغاء' }).click()
  await page.goto('/transactions')
  await expect(page.getByRole('link', { name: /بعد النسخ/ })).toBeVisible()

  await page.goto('/settings/backup')
  await chooseFile(page, path)
  await page.getByRole('button', { name: 'استعادة', exact: true }).click()
  await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'استبدال البيانات' }).click()])
  await expect(page.getByText('اكتملت الاستعادة')).toBeVisible()
  await page.goto('/transactions')
  await expect(page.getByRole('link', { name: /قبل النسخ/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /بعد النسخ/ })).toHaveCount(0)
})

test('رفض الملفات التالفة وغير المدعومة دون المساس بالبيانات', async ({ page }) => {
  await start(page)
  await addExpense(page, '15', 'عملية محفوظة')
  const path = await createBackup(page)
  const text = await readFile(path, 'utf8')

  const cases: [string, string, string][] = [
    ['not-json.json', 'ليس ملفاً', 'لا يمكن قراءته'],
    ['other-app.json', JSON.stringify({ app: 'other', data: {} }), 'ليس نسخة احتياطية من قِرْش'],
    ['tampered.json', text.replace('"amountMinor": 1500', '"amountMinor": 1'), 'فشل التحقق من سلامته'],
    ['truncated.json', text.slice(0, Math.floor(text.length / 2)), 'لا يمكن قراءته'],
    ['newer.json', text.replace(/"schemaVersion": \d+/, '"schemaVersion": 999'), 'إصدار أحدث'],
  ]
  // مجلد مؤقت باسم لاتيني: مسار نتائج الاختبار يحوي العنوان العربي.
  const dir = await mkdtemp(join(tmpdir(), 'qirsh-backup-'))
  for (const [name, content, message] of cases) {
    const bad = join(dir, name)
    await writeFile(bad, content)
    await chooseFile(page, bad)
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByRole('button', { name: 'استعادة', exact: true })).toHaveCount(0)
  }

  await page.goto('/transactions')
  await expect(page.getByRole('link', { name: /عملية محفوظة/ })).toBeVisible()
})

test('تذكير النسخ الاحتياطي في الرئيسية يُؤجَّل ويختفي بعد إنشاء نسخة', async ({ page }) => {
  await start(page)
  for (let i = 1; i <= 5; i++) await addExpense(page, String(i), `عملية ${i}`)
  await page.goto('/')
  const reminder = page.getByRole('status').filter({ hasText: 'احفظ نسخة احتياطية' })
  await expect(reminder).toContainText('لم تُنشأ نسخة احتياطية بعد')
  await reminder.getByRole('button', { name: 'لاحقاً' }).click()
  await expect(reminder).toHaveCount(0)

  await page.goto('/settings')
  await expect(page.getByText('لم تُنشأ نسخة احتياطية بعد')).toBeVisible()
  await createBackup(page)
  await page.goto('/settings')
  await expect(page.getByText('لم تُنشأ نسخة احتياطية بعد')).toHaveCount(0)
})
