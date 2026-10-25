import { currencyLabels } from '../domain/money'
import type { CurrencySummary } from '../domain/transactions'
import { Card } from './Card'
import { Money } from './Money'

/** الدخل والمصروف والصافي لعملة واحدة. */
export function CurrencySummaryCard({ summary: s }: { summary: CurrencySummary }) {
  return (
    <Card className="summary">
      <p className="total__label">بال{currencyLabels[s.currency]}</p>
      <dl className="summary__rows">
        <div>
          <dt>الدخل</dt>
          <dd>
            <Money minor={s.incomeMinor} currency={s.currency} />
          </dd>
        </div>
        <div>
          <dt>المصروف</dt>
          <dd>
            <Money minor={s.expenseMinor} currency={s.currency} />
          </dd>
        </div>
        <div className="summary__net">
          <dt>الصافي</dt>
          <dd>
            <Money minor={s.netMinor} currency={s.currency} signed />
          </dd>
        </div>
      </dl>
    </Card>
  )
}
