import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import { signedAmount, transactionTypeLabels, type Transaction } from '../../domain/transactions'

export function TransactionRow({ transaction: t, accountName }: { transaction: Transaction; accountName: string }) {
  return (
    <Link to={`/transactions/${t.id}`} className="list-item">
      <span className={`list-item__icon tx-icon tx-icon--${t.type}`}>
        <Icon name={t.type === 'income' ? 'arrowDown' : 'arrowUp'} size={20} />
      </span>
      <span className="list-item__main">
        <span className="list-item__title">{t.description || transactionTypeLabels[t.type]}</span>
        <span className="list-item__meta">
          {transactionTypeLabels[t.type]} · {accountName}
        </span>
      </span>
      <Money minor={signedAmount(t)} currency={t.currency} signed className="list-item__amount" />
    </Link>
  )
}
