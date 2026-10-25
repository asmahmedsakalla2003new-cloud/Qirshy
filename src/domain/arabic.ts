type CountForms = { one: string; two: string; few: string; many: string }

/**
 * صيغة العدد العربية: 0 عمليات، عملية واحدة، عمليتان، 3 عمليات، 11 عملية.
 * few للأعداد 3–10 (جمع)، و many لـ 11 فأكثر (مفرد منصوب أو مفرد).
 */
export function countLabel(n: number, forms: CountForms): string {
  if (n === 1) return forms.one
  if (n === 2) return forms.two
  if (n === 0 || (n >= 3 && n <= 10)) return `${n} ${forms.few}`
  return `${n} ${forms.many}`
}

export const accountForms: CountForms = { one: 'حساب واحد', two: 'حسابان', few: 'حسابات', many: 'حساباً' }
export const transactionForms: CountForms = { one: 'عملية واحدة', two: 'عمليتان', few: 'عمليات', many: 'عملية' }
