import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Card } from '../../components/Card'
import { Icon, type IconName } from '../../components/Icon'
import { Money } from '../../components/Money'
import { listAccounts } from '../../data/accountsRepo'
import { accountBalance, accountTypeLabels, type AccountType } from '../../domain/accounts'
import { CURRENCIES, currencyLabels } from '../../domain/money'

const accountTypeIcons: Record<AccountType, IconName> = {
  cash: 'coins',
  bank: 'bank',
  jawwalpay: 'phone',
  palpay: 'phone',
}

export function AccountsScreen() {
  const accounts = useLiveQuery(listAccounts)
  if (!accounts) return null

  // إجمالي كل عملة على حدة؛ لا تُجمع العملتان في رقم واحد.
  const totals = CURRENCIES.map((currency) => ({
    currency,
    minor: accounts.filter((a) => a.currency === currency).reduce((sum, a) => sum + accountBalance(a), 0),
    count: accounts.filter((a) => a.currency === currency).length,
  })).filter((t) => t.count > 0)

  return (
    <div className="stack">
      <p>
        <Link to="/settings">→ الإعدادات</Link>
      </p>
      <h1 className="page-title">الحسابات والمحافظ</h1>

      <div className="totals">
        {totals.map((t) => (
          <Card key={t.currency} className="total">
            <p className="total__label">مجموع أرصدة {currencyLabels[t.currency]}</p>
            <Money minor={t.minor} currency={t.currency} className="total__value" />
          </Card>
        ))}
      </div>

      <ul className="list" aria-label="الحسابات">
        {accounts.map((a) => (
          <li key={a.id}>
            <Link to={`/settings/accounts/${a.id}`} className="list-item">
              <span className="list-item__icon">
                <Icon name={accountTypeIcons[a.type]} />
              </span>
              <span className="list-item__main">
                <span className="list-item__title">{a.name}</span>
                <span className="list-item__meta">
                  {accountTypeLabels[a.type]} · {currencyLabels[a.currency]}
                </span>
              </span>
              <Money minor={accountBalance(a)} currency={a.currency} className="list-item__amount" />
              <Icon name="chevron" size={18} />
            </Link>
          </li>
        ))}
      </ul>

      <Link to="/settings/accounts/new" className="btn btn--primary btn--md btn--full">
        <Icon name="plus" size={20} />
        إضافة حساب
      </Link>

      <p className="muted small">
        الأرصدة تُدخلها أنت. قِرْش لا يتصل بالبنك ولا بمحافظ جوال باي أو بال باي.
      </p>
    </div>
  )
}
