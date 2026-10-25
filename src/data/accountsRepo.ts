import { validateAccount, type Account, type AccountInput } from '../domain/accounts'
import { db } from './db'
import { ValidationError } from './errors'

export { ValidationError }

/** الحسابات بترتيب إنشائها. */
export async function listAccounts(): Promise<Account[]> {
  const all = await db.accounts.toArray()
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

function clean(input: AccountInput): AccountInput {
  return { ...input, name: input.name.trim() }
}

export async function createAccount(input: AccountInput): Promise<Account> {
  return db.transaction('rw', db.accounts, async () => {
    const errors = validateAccount(input, await db.accounts.toArray())
    if (errors.name) throw new ValidationError(errors)

    const now = new Date().toISOString()
    const account: Account = { ...clean(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    await db.accounts.add(account)
    return account
  })
}

/** عمليات الحساب وتحويلاته (صادرة أو واردة). */
async function countTransactions(accountId: string): Promise<number> {
  const [transactions, outgoing, incoming] = await Promise.all([
    db.transactions.where('accountId').equals(accountId).count(),
    db.transfers.where('fromAccountId').equals(accountId).count(),
    db.transfers.where('toAccountId').equals(accountId).count(),
  ])
  return transactions + outgoing + incoming
}

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  await db.transaction('rw', db.accounts, db.transactions, db.transfers, async () => {
    const all = await db.accounts.toArray()
    const errors = validateAccount(input, all.filter((a) => a.id !== id))
    if (errors.name) throw new ValidationError(errors)

    // عمليات الحساب محفوظة بعملته؛ تغيير العملة بعدها يخلط العملات.
    const current = all.find((a) => a.id === id)
    if (current && current.currency !== input.currency && (await countTransactions(id)) > 0) {
      throw new ValidationError({ currency: 'لا يمكن تغيير عملة حساب له عمليات أو تحويلات. أنشئ حساباً جديداً بالعملة الأخرى.' })
    }

    const changed = await db.accounts.update(id, { ...clean(input), updatedAt: new Date().toISOString() })
    if (!changed) throw new Error('الحساب غير موجود.')
  })
}

/**
 * يحذف الحساب. يبقى حساب واحد على الأقل حتى يكون للعمليات مكان تُسجَّل فيه،
 * ولا يُحذف حساب له عمليات حتى لا تبقى عمليات بلا حساب.
 */
export async function deleteAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.transactions, db.transfers, async () => {
    if ((await db.accounts.count()) <= 1) {
      throw new ValidationError({ account: 'لا يمكن حذف آخر حساب. أضف حساباً آخر أولاً.' })
    }
    const count = await countTransactions(id)
    if (count > 0) {
      throw new ValidationError({ account: 'لا يمكن حذف حساب له عمليات أو تحويلات مسجّلة. احذفها أولاً.' })
    }
    await db.accounts.delete(id)
  })
}
