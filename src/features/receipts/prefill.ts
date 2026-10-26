import type { Account } from '../../domain/accounts'
import type { Category } from '../../domain/categories'
import { todayISO } from '../../domain/dates'
import type { ReceiptData } from '../../domain/receipt'
import type { TransactionInput } from '../../domain/transactions'

/**
 * يحوّل ما قُرئ من الفاتورة إلى قيم أولية لمصروف: حساب بعملة الفاتورة إن وُجد،
 * والفئة المقترحة إن كانت ضمن فئات المستخدم الحالية، واسم المحل وصفاً.
 */
export function receiptToInput(receipt: ReceiptData, accounts: Account[], categories: Category[]): TransactionInput {
  const account = (receipt.currency && accounts.find((a) => a.currency === receipt.currency)) || accounts[0]
  const category = categories.find((c) => c.kind === 'expense' && !c.archived && c.name === receipt.suggestedCategory)
  return {
    type: 'expense',
    amountMinor: receipt.totalMinor ?? 0,
    accountId: account?.id ?? '',
    date: receipt.date ?? todayISO(),
    categoryId: category?.id ?? null,
    description: receipt.merchant ?? '',
  }
}
