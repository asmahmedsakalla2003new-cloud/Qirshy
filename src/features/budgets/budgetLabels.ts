import type { AlertLevel, Budget } from '../../domain/budgets'
import { currencyLabels } from '../../domain/money'

/** «الميزانية العامة بالشيكل» أو «ميزانية «بقالة وطعام» بالشيكل». */
export function budgetLabel(budget: Pick<Budget, 'scope' | 'currency'>, categoryName?: string): string {
  const currency = `بال${currencyLabels[budget.currency]}`
  return budget.scope === 'overall' ? `الميزانية العامة ${currency}` : `ميزانية «${categoryName ?? 'فئة محذوفة'}» ${currency}`
}

export function alertMessage(level: AlertLevel, label: string): string {
  return level === 'over'
    ? `وصلت إلى حد ${label} هذا الشهر.`
    : `اقتربت من حد ${label}: استهلكت 80% منها أو أكثر هذا الشهر.`
}
