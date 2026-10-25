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
import { deleteTransfer, getTransfer } from '../../data/transfersRepo'
import { formatDateLong, formatDateTime } from '../../domain/dates'
import { currencySymbols } from '../../domain/money'
import { exchangeRate } from '../../domain/transfers'

export function TransferDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const flash = useFlash()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()

  const data = useLiveQuery(async () => {
    const transfer = await getTransfer(id)
    if (!transfer) return null
    const [from, to] = await Promise.all([getAccount(transfer.fromAccountId), getAccount(transfer.toAccountId)])
    return { transfer, from, to }
  }, [id])

  if (data === undefined) return null
  if (data === null) {
    return (
      <EmptyState
        title="التحويل غير موجود"
        description="ربما حُذف هذا التحويل."
        action={<Link to="/transactions">العودة إلى العمليات</Link>}
      />
    )
  }
  const { transfer: t, from, to } = data
  const crossCurrency = t.fromCurrency !== t.toCurrency

  async function remove() {
    setConfirming(false)
    try {
      await deleteTransfer(t.id)
      navigate('/transactions', { replace: true, state: { flash: 'حُذف التحويل.' } })
    } catch {
      setError('تعذّر حذف التحويل. حاول مرة أخرى.')
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
        <p className="tx-badge tx-badge--transfer">تحويل</p>
        <h1 className="tx-hero__amount">
          <Money minor={t.fromAmountMinor} currency={t.fromCurrency} />
        </h1>
        <p className="tx-hero__title">
          من {from?.name ?? '—'} إلى {to?.name ?? '—'}
        </p>
      </Card>

      <Card>
        <dl className="details">
          {crossCurrency && (
            <>
              <div>
                <dt>المبلغ الواصل</dt>
                <dd>
                  <Money minor={t.toAmountMinor} currency={t.toCurrency} />
                </dd>
              </div>
              <div>
                <dt>سعر الصرف المحسوب</dt>
                <dd>
                  <bdi dir="ltr" className="num">
                    1 {currencySymbols[t.fromCurrency]} = {exchangeRate(t)} {currencySymbols[t.toCurrency]}
                  </bdi>
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>التاريخ</dt>
            <dd>{formatDateLong(t.date)}</dd>
          </div>
          <div>
            <dt>الوصف</dt>
            <dd>{t.description || <span className="muted">بلا وصف</span>}</dd>
          </div>
          <div>
            <dt>أُضيف في</dt>
            <dd>{formatDateTime(t.createdAt)}</dd>
          </div>
        </dl>
        <p className="muted small">لا يُحتسب التحويل دخلاً ولا مصروفاً، ولا يدخل في الميزانيات.</p>
      </Card>

      <Link to={`/transfers/${t.id}/edit`} className="btn btn--primary btn--lg btn--full">
        تعديل التحويل
      </Link>
      <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirming(true)}>
        حذف التحويل
      </Button>
      <ConfirmDialog
        open={confirming}
        title="حذف التحويل؟"
        confirmLabel="حذف التحويل"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        سيُحذف التحويل، ويُعاد حساب رصيدي «{from?.name ?? 'المصدر'}» و«{to?.name ?? 'الوجهة'}».
      </ConfirmDialog>
    </div>
  )
}
