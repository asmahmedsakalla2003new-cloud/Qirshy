/**
 * تفضيلات بسيطة للواجهة محفوظة في localStorage.
 * مؤقتة للمرحلة 1 فقط: تنتقل إلى قاعدة البيانات المحلية (IndexedDB) في المرحلة 2
 * لتدخل ضمن ملف النسخة الاحتياطية.
 */
const ONBOARDED_KEY = 'qirsh.onboarded'

// قد يكون التخزين محجوباً (تصفح خفي أو إعدادات المتصفح)، فلا نجعل ذلك يوقف التطبيق.
let memoryFallback = false

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return memoryFallback
  }
}

export function completeOnboarding(): void {
  memoryFallback = true
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    // يبقى التفضيل في الذاكرة لهذه الجلسة فقط.
  }
}
