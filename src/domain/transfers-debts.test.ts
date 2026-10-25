import { describe, expect, it } from 'vitest'
import { accountBalance } from './accounts'
import { debtStatus, validateDebt, validatePayment, type DebtInput } from './debts'
import { exchangeRate, filterTransfers, transferEffect, validateTransfer, type Transfer, type TransferInput } from './transfers'

const transfer = (p: Partial<Transfer>): Transfer => ({
  id: Math.random().toString(36),
  fromAccountId: 'cash',
  toAccountId: 'bank',
  fromAmountMinor: 10000,
  toAmountMinor: 10000,
  fromCurrency: 'ILS',
  toCurrency: 'ILS',
  date: '2026-10-10',
  description: '',
  createdAt: 'x',
  updatedAt: 'x',
  ...p,
})

describe('التحويلات', () => {
  const input: TransferInput = {
    fromAccountId: 'cash',
    toAccountId: 'bank',
    fromAmountMinor: 10000,
    toAmountMinor: 10000,
    date: '2026-10-10',
    description: '',
  }
  const same = { from: 'ILS' as const, to: 'ILS' as const }

  it('يقبل تحويلاً صحيحاً، ويرفض الحساب نفسه والمبلغ غير الموجب والمستقبل', () => {
    expect(validateTransfer(input, same, '2026-10-25')).toEqual({})
    expect(validateTransfer({ ...input, toAccountId: 'cash' }, same).toAccountId).toBe('اختر حساباً مختلفاً للتحويل إليه.')
    expect(validateTransfer({ ...input, fromAmountMinor: 0 }, same).fromAmount).toBeTruthy()
    expect(validateTransfer({ ...input, date: '2099-01-01' }, same).date).toMatch('المستقبل')
  })

  it('بالعملة نفسها يتساوى المبلغان، وبين عملتين يُقبل الاختلاف', () => {
    expect(validateTransfer({ ...input, toAmountMinor: 9000 }, same).toAmount).toMatch('يتساوى')
    expect(validateTransfer({ ...input, toAmountMinor: 36500 }, { from: 'USD', to: 'ILS' }, '2026-10-25')).toEqual({})
  })

  it('ينقص المصدر ويزيد الوجهة، بمبلغ كل عملة', () => {
    const list = [transfer({}), transfer({ fromAccountId: 'usd', toAccountId: 'cash', fromAmountMinor: 10000, toAmountMinor: 36500 })]
    expect(transferEffect('cash', list)).toBe(-10000 + 36500)
    expect(transferEffect('bank', list)).toBe(10000)
    expect(transferEffect('usd', list)).toBe(-10000)
  })

  it('مجموع أرصدة العملة الواحدة لا يتغيّر بالتحويل بين حساباتها', () => {
    const accounts = [
      { id: 'cash', openingBalanceMinor: 50000 },
      { id: 'bank', openingBalanceMinor: 20000 },
    ]
    const total = (transfers: Transfer[]) => accounts.reduce((s, a) => s + accountBalance(a, [], transfers), 0)
    expect(total([transfer({ fromAmountMinor: 30000, toAmountMinor: 30000 })])).toBe(total([]))
  })

  it('سعر الصرف المشتق للعرض', () => {
    expect(exchangeRate({ fromAmountMinor: 10000, toAmountMinor: 36500 })).toBe(3.65)
    expect(exchangeRate({ fromAmountMinor: 30000, toAmountMinor: 10000 })).toBe(0.3333)
  })

  it('التصفية: تختفي مع نوع مصروف/دخل أو فئة، وتطابق الحساب مصدراً أو وجهة', () => {
    const list = [transfer({ id: 'a', description: 'إيداع' }), transfer({ id: 'b', fromAccountId: 'bank', toAccountId: 'jp' })]
    const ids = (f: Parameters<typeof filterTransfers>[1]) => filterTransfers(list, f, { cash: 'نقد', bank: 'البنك', jp: 'جوال باي' }).map((t) => t.id)
    expect(ids({})).toEqual(['a', 'b'])
    expect(ids({ type: 'expense' })).toEqual([])
    expect(ids({ type: 'transfer' })).toEqual(['a', 'b'])
    expect(ids({ categoryId: 'food' })).toEqual([])
    expect(ids({ accountId: 'bank' })).toEqual(['a', 'b'])
    expect(ids({ accountId: 'jp' })).toEqual(['b'])
    expect(ids({ query: 'ايداع' })).toEqual(['a'])
    expect(ids({ query: 'جوال' })).toEqual(['b'])
  })
})

describe('الديون والدفعات الجزئية', () => {
  const input: DebtInput = {
    direction: 'owed_to_me',
    counterparty: 'أحمد',
    amountMinor: 50000,
    currency: 'ILS',
    date: '2026-10-01',
    dueDate: '2026-11-01',
    notes: '',
  }

  it('التحقق من الدين', () => {
    expect(validateDebt(input, 0, '2026-10-25')).toEqual({})
    expect(validateDebt({ ...input, counterparty: ' ' }).counterparty).toBeTruthy()
    expect(validateDebt({ ...input, amountMinor: 0 }).amount).toBeTruthy()
    expect(validateDebt({ ...input, dueDate: '2026-09-01' }, 0, '2026-10-25').dueDate).toBe('موعد السداد قبل تاريخ الدين.')
    expect(validateDebt({ ...input, amountMinor: 10000 }, 20000, '2026-10-25').amount).toMatch('أقل مما سُدّد')
  })

  it('المتبقي = الأصل − مجموع الدفعات، والتسديد الكامل', () => {
    const debt = { id: 'd1', amountMinor: 50000, dueDate: '2026-11-01' }
    const payments = [
      { debtId: 'd1', amountMinor: 20000 },
      { debtId: 'd1', amountMinor: 5050 },
      { debtId: 'other', amountMinor: 99999 },
    ]
    expect(debtStatus(debt, payments, '2026-10-25')).toEqual({ paidMinor: 25050, remainingMinor: 24950, settled: false, overdue: false })
    expect(debtStatus(debt, payments, '2026-11-02').overdue).toBe(true)
    const full = [...payments, { debtId: 'd1', amountMinor: 24950 }]
    expect(debtStatus(debt, full, '2026-11-02')).toEqual({ paidMinor: 50000, remainingMinor: 0, settled: true, overdue: false })
  })

  it('الدفعة لا تتجاوز المتبقي', () => {
    expect(validatePayment(24950, 24950, '2026-10-20', '2026-10-25')).toEqual({})
    expect(validatePayment(24951, 24950, '2026-10-20', '2026-10-25').amount).toBe('الدفعة أكبر من المتبقي من الدين.')
    expect(validatePayment(0, 24950, '2026-10-20').amount).toBeTruthy()
    expect(validatePayment(100, 24950, '2099-01-01').date).toMatch('المستقبل')
  })
})
