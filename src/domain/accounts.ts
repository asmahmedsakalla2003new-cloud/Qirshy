import { signedAmount, type Transaction } from './transactions'
import { transferEffect, type Transfer } from './transfers'
import type { Currency } from './money'

/**
 * الحسابات والمحافظ (القرار C13): يُدخل المستخدم الرصيد بنفسه،
 * ولا يرتبط التطبيق بأي بنك أو محفظة أو خدمة خارجية.
 */
export const ACCOUNT_TYPES = ['cash', 'bank', 'jawwalpay', 'palpay'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const accountTypeLabels: Record<AccountType, string> = {
  cash: 'نقد (كاش)',
  bank: 'حساب بنكي',
  jawwalpay: 'جوال باي',
  palpay: 'بال باي',
}

/** الاسم المقترح عند اختيار النوع؛ يمكن للمستخدم تغييره. */
export const defaultAccountNames: Record<AccountType, string> = {
  cash: 'نقد',
  bank: 'البنك',
  jawwalpay: 'جوال باي',
  palpay: 'بال باي',
}

export type Account = {
  id: string
  name: string
  type: AccountType
  /** لكل حساب عملة واحدة. البنك بعملتين = حسابان. */
  currency: Currency
  /** الرصيد الذي أدخله المستخدم عند إنشاء الحساب، بأصغر وحدة. قد يكون سالباً (سحب على المكشوف). */
  openingBalanceMinor: number
  createdAt: string
  updatedAt: string
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'openingBalanceMinor'>

export const ACCOUNT_NAME_MAX = 40

export type AccountErrors = Partial<Record<'name', string>>

/** يتحقق من بيانات الحساب. otherAccounts: الحسابات الأخرى الموجودة لمنع تكرار الاسم. */
export function validateAccount(input: AccountInput, otherAccounts: Pick<Account, 'name' | 'currency'>[]): AccountErrors {
  const name = input.name.trim()
  if (name === '') return { name: 'أدخل اسم الحساب.' }
  if (name.length > ACCOUNT_NAME_MAX) return { name: `الاسم طويل؛ الحد ${ACCOUNT_NAME_MAX} حرفاً.` }

  const duplicate = otherAccounts.some((a) => a.name.trim() === name && a.currency === input.currency)
  if (duplicate) return { name: 'يوجد حساب بالاسم والعملة نفسيهما. اختر اسماً مختلفاً.' }

  return {}
}

/**
 * الرصيد الحالي للحساب = الرصيد الافتتاحي + الدخل − المصروف + التحويلات الواردة − الصادرة.
 * transactions وtransfers: الكل، ويُؤخذ منها ما يخص الحساب. الديون لا تؤثر على الرصيد.
 */
export function accountBalance(
  account: Pick<Account, 'id' | 'openingBalanceMinor'>,
  transactions: Pick<Transaction, 'accountId' | 'type' | 'amountMinor'>[],
  transfers: Pick<Transfer, 'fromAccountId' | 'toAccountId' | 'fromAmountMinor' | 'toAmountMinor'>[],
): number {
  const fromTransactions = transactions
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + signedAmount(t), 0)
  return account.openingBalanceMinor + fromTransactions + transferEffect(account.id, transfers)
}
