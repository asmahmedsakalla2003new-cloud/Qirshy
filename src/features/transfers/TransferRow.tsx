import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import type { Transfer } from '../../domain/transfers'

type Props = { transfer: Transfer; names: Record<string, string> }

/** صف تحويل في السجل: لون محايد وبلا إشارة، لأنه ليس دخلاً ولا مصروفاً. */
export function TransferRow({ transfer: t, names }: Props) {
  const crossCurrency = t.fromCurrency !== t.toCurrency
  return (
    <Link to={`/transfers/${t.id}`} className="list-item">
      <span className="list-item__icon tx-icon tx-icon--transfer">
        <Icon name="swap" size={20} />
      </span>
      <span className="list-item__main">
        <span className="list-item__title">{t.description || 'تحويل'}</span>
        <span className="list-item__meta">
          من {names[t.fromAccountId] ?? '—'} إلى {names[t.toAccountId] ?? '—'}
          {crossCurrency && (
            <>
              {' · وصل '}
              <Money minor={t.toAmountMinor} currency={t.toCurrency} />
            </>
          )}
        </span>
      </span>
      <Money minor={t.fromAmountMinor} currency={t.fromCurrency} className="list-item__amount" />
    </Link>
  )
}
