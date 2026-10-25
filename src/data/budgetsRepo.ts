import {
  changeAmount,
  clearOverride,
  validateBudget,
  type AlertLevel,
  type AmountChangeMode,
  type Budget,
  type BudgetInput,
} from '../domain/budgets'
import { currentMonth } from '../domain/months'
import { db } from './db'
import { ValidationError } from './errors'

export function listBudgets(): Promise<Budget[]> {
  return db.budgets.toArray()
}

export function getBudget(id: string): Promise<Budget | undefined> {
  return db.budgets.get(id)
}

/** ميزانية جديدة تبدأ من الشهر المحدد (افتراضياً الحالي) وتتكرر بعده. */
export async function createBudget(input: BudgetInput, startMonth = currentMonth()): Promise<Budget> {
  return db.transaction('rw', db.budgets, db.categories, async () => {
    const errors = validateBudget(input, await db.budgets.toArray())
    if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)

    if (input.scope === 'category') {
      const category = await db.categories.get(input.categoryId ?? '')
      if (!category || category.kind !== 'expense') {
        throw new ValidationError({ categoryId: 'الميزانية تكون لفئة مصروف فقط.' })
      }
    }

    const now = new Date().toISOString()
    const budget: Budget = {
      id: crypto.randomUUID(),
      scope: input.scope,
      categoryId: input.scope === 'category' ? input.categoryId : null,
      currency: input.currency,
      schedule: [{ from: startMonth, amountMinor: input.amountMinor }],
      overrides: {},
      dismissedAlerts: {},
      createdAt: now,
      updatedAt: now,
    }
    await db.budgets.add(budget)
    return budget
  })
}

async function modify(id: string, change: (budget: Budget) => Partial<Budget>): Promise<void> {
  await db.transaction('rw', db.budgets, async () => {
    const budget = await db.budgets.get(id)
    if (!budget) throw new Error('الميزانية غير موجودة.')
    await db.budgets.update(id, { ...change(budget), updatedAt: new Date().toISOString() })
  })
}

export async function setBudgetAmount(id: string, month: string, amountMinor: number, mode: AmountChangeMode) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new ValidationError({ amount: 'يجب أن يكون مبلغ الميزانية أكبر من صفر.' })
  }
  await modify(id, (b) => changeAmount(b, month, amountMinor, mode))
}

export async function resetBudgetMonth(id: string, month: string) {
  await modify(id, (b) => clearOverride(b, month))
}

export async function dismissBudgetAlert(id: string, month: string, level: AlertLevel) {
  await modify(id, (b) => ({ dismissedAlerts: { ...b.dismissedAlerts, [month]: level } }))
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}
