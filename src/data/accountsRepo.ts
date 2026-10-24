import { validateAccount, type Account, type AccountInput } from '../domain/accounts'
import { db } from './db'

/** خطأ تحقق برسائل عربية جاهزة للعرض، مفهرسة باسم الحقل. */
export class ValidationError extends Error {
  readonly errors: Record<string, string>

  constructor(errors: Record<string, string>) {
    super(Object.values(errors).join(' '))
    this.errors = errors
  }
}

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

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    const others = (await db.accounts.toArray()).filter((a) => a.id !== id)
    const errors = validateAccount(input, others)
    if (errors.name) throw new ValidationError(errors)

    const changed = await db.accounts.update(id, { ...clean(input), updatedAt: new Date().toISOString() })
    if (!changed) throw new Error('الحساب غير موجود.')
  })
}

/** يحذف الحساب. يبقى حساب واحد على الأقل حتى يكون للعمليات مكان تُسجَّل فيه. */
export async function deleteAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    if ((await db.accounts.count()) <= 1) {
      throw new ValidationError({ account: 'لا يمكن حذف آخر حساب. أضف حساباً آخر أولاً.' })
    }
    await db.accounts.delete(id)
  })
}
