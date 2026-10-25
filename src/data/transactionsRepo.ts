import { validateTransaction, type Transaction, type TransactionInput } from '../domain/transactions'
import { db } from './db'
import { ValidationError } from './errors'

export function listTransactions(): Promise<Transaction[]> {
  return db.transactions.toArray()
}

export function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id)
}

/**
 * يتحقق من العملية ويحدد عملتها من الحساب. العملة تُؤخذ من الحساب دائماً،
 * فلا يمكن تسجيل مبلغ بالدولار في حساب بالشيكل.
 */
async function prepare(input: TransactionInput): Promise<Pick<Transaction, 'currency'> & TransactionInput> {
  const errors = validateTransaction(input)
  if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)

  const account = await db.accounts.get(input.accountId)
  if (!account) throw new ValidationError({ accountId: 'الحساب المختار غير موجود.' })

  if (input.categoryId) {
    const category = await db.categories.get(input.categoryId)
    if (!category || category.kind !== input.type) {
      throw new ValidationError({ categoryId: 'الفئة المختارة لا تناسب نوع العملية.' })
    }
  }

  return { ...input, description: input.description.trim(), currency: account.currency }
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return db.transaction('rw', db.transactions, db.accounts, db.categories, async () => {
    const now = new Date().toISOString()
    const transaction: Transaction = { ...(await prepare(input)), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    await db.transactions.add(transaction)
    return transaction
  })
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  await db.transaction('rw', db.transactions, db.accounts, db.categories, async () => {
    const changed = await db.transactions.update(id, { ...(await prepare(input)), updatedAt: new Date().toISOString() })
    if (!changed) throw new Error('العملية غير موجودة.')
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
}
