import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import { signedAmount, transactionTypeLabels, type Transaction } from '../../domain/transactions'

type Props = { transaction: Transaction; accountName: string; categoryName?: string }

export function TransactionRow({ transaction: t, accountName, categoryName }: Props) {
  const typeLabel = transactionTypeLabels[t.type]
  const title = t.description || categoryName || typeLabel
  // لا يتكرر اسم الفئة: إذا صار عنواناً يُعرض النوع تحته.
  const subtitle = t.description && categoryName ? categoryName : typeLabel
  return (
    <Link to={`/transactions/${t.id}`} className="list-item">
      <span className={`list-item__icon tx-icon tx-icon--${t.type}`}>
        <Icon name={t.type === 'income' ? 'arrowDown' : 'arrowUp'} size={20} />
      </span>
      <span className="list-item__main">
        <span className="list-item__title">{title}</span>
        <span className="list-item__meta">
          {subtitle} · {accountName}
        </span>
      </span>
      <Money minor={signedAmount(t)} currency={t.currency} signed className="list-item__amount" />
    </Link>
  )
}
