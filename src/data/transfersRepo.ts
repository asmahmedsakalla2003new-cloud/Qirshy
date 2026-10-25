import { validateTransfer, type Transfer, type TransferInput } from '../domain/transfers'
import { db } from './db'
import { ValidationError } from './errors'

export function listTransfers(): Promise<Transfer[]> {
  return db.transfers.toArray()
}

export function getTransfer(id: string): Promise<Transfer | undefined> {
  return db.transfers.get(id)
}

/** يتحقق من التحويل ويأخذ العملتين من الحسابين. */
async function prepare(input: TransferInput) {
  const [from, to] = await Promise.all([db.accounts.get(input.fromAccountId), db.accounts.get(input.toAccountId)])
  const errors = validateTransfer(input, { from: from?.currency, to: to?.currency })
  if (Object.keys(errors).length) throw new ValidationError(errors as Record<string, string>)
  if (!from || !to) throw new ValidationError({ toAccountId: 'أحد الحسابين غير موجود.' })
  return { ...input, description: input.description.trim(), fromCurrency: from.currency, toCurrency: to.currency }
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  return db.transaction('rw', db.transfers, db.accounts, async () => {
    const now = new Date().toISOString()
    const transfer: Transfer = { ...(await prepare(input)), id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    await db.transfers.add(transfer)
    return transfer
  })
}

export async function updateTransfer(id: string, input: TransferInput): Promise<void> {
  await db.transaction('rw', db.transfers, db.accounts, async () => {
    const changed = await db.transfers.update(id, { ...(await prepare(input)), updatedAt: new Date().toISOString() })
    if (!changed) throw new Error('التحويل غير موجود.')
  })
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfers.delete(id)
}
