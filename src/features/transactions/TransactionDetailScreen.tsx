import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Money } from '../../components/Money'
import { getAccount } from '../../data/accountsRepo'
import { deleteTransaction, getTransaction } from '../../data/transactionsRepo'
import { formatDateLong, formatDateTime } from '../../domain/dates'
import { signedAmount, transactionTypeLabels } from '../../domain/transactions'

export function TransactionDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const flash = useFlash()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()

  const data = useLiveQuery(async () => {
    const transaction = await getTransaction(id)
    if (!transaction) return null
    return { transaction, account: await getAccount(transaction.accountId) }
  }, [id])

  if (data === undefined) return null
  if (data === null) {
    return (
      <EmptyState
        title="العملية غير موجودة"
        description="ربما حُذفت هذه العملية."
        action={<Link to="/transactions">العودة إلى العمليات</Link>}
      />
    )
  }

  const { transaction: t, account } = data
  const typeLabel = transactionTypeLabels[t.type]

  async function remove() {
    setConfirming(false)
    try {
      await deleteTransaction(t.id)
      navigate('/transactions', { replace: true, state: { flash: 'حُذفت العملية.' } })
    } catch {
      setError('تعذّر حذف العملية. حاول مرة أخرى.')
    }
  }

  return (
    <div className="stack">
      <p>
        <Link to="/transactions">→ العمليات</Link>
      </p>

      {flash && <Alert tone="success">{flash}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="tx-hero">
        <p className={`tx-badge tx-badge--${t.type}`}>{typeLabel}</p>
        <h1 className="tx-hero__amount">
          <Money minor={signedAmount(t)} currency={t.currency} signed />
        </h1>
        <p className="tx-hero__title">{t.description || typeLabel}</p>
      </Card>

      <Card>
        <dl className="details">
          <div>
            <dt>{t.type === 'income' ? 'إلى حساب' : 'من حساب'}</dt>
            <dd>{account?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>التاريخ</dt>
            <dd>{formatDateLong(t.date)}</dd>
          </div>
          <div>
            <dt>الوصف</dt>
            <dd>{t.description || <span className="muted">بلا وصف</span>}</dd>
          </div>
          <div>
            <dt>أُضيفت في</dt>
            <dd>{formatDateTime(t.createdAt)}</dd>
          </div>
          {t.updatedAt !== t.createdAt && (
            <div>
              <dt>آخر تعديل</dt>
              <dd>{formatDateTime(t.updatedAt)}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Link to={`/transactions/${t.id}/edit`} className="btn btn--primary btn--lg btn--full">
        تعديل العملية
      </Link>
      <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirming(true)}>
        حذف العملية
      </Button>

      <ConfirmDialog
        open={confirming}
        title={`حذف ${t.type === 'income' ? 'الدخل' : 'المصروف'}؟`}
        confirmLabel="حذف العملية"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        ستُحذف العملية نهائياً، ويُعاد حساب رصيد «{account?.name ?? 'الحساب'}».
      </ConfirmDialog>
    </div>
  )
}
