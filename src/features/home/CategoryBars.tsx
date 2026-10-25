import { Link } from 'react-router'
import { Money } from '../../components/Money'
import type { CategoryShare } from '../../domain/categories'
import type { Currency } from '../../domain/money'
import { NO_CATEGORY } from '../../domain/transactions'

function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return '<1%'
  return `${Math.round(share * 100)}%`
}

type Props = {
  shares: CategoryShare[]
  currency: Currency
  /** رابط سجل العمليات المصفّى لكل فئة (الفترة نفسها). */
  linkFor: (categoryId: string) => string
  label: string
}

/**
 * قائمة أعمدة أفقية مرتبة من الأكبر: لون واحد (الحجم لا الهوية)، واسم الفئة
 * ومبلغها ونسبتها نصاً بجانب كل عمود، فلا حاجة لمفتاح ألوان أو تلميح.
 * طول العمود نسبةً إلى أكبر فئة؛ والنسبة المكتوبة من مجموع مصاريف هذه العملة.
 */
export function CategoryBars({ shares, currency, linkFor, label }: Props) {
  const max = shares[0]?.amountMinor ?? 0
  return (
    <ul className="bars" aria-label={label}>
      {shares.map((s) => (
        <li key={s.categoryId ?? NO_CATEGORY}>
          <Link to={linkFor(s.categoryId ?? NO_CATEGORY)} className="bar-row">
            <span className="bar-row__head">
              <span className="bar-row__name">{s.name}</span>
              <span className="bar-row__value">
                <Money minor={s.amountMinor} currency={currency} />
                <bdi className="bar-row__share num">{formatShare(s.share)}</bdi>
              </span>
            </span>
            <span className="bar-row__track" aria-hidden="true">
              <span className="bar-row__bar" style={{ inlineSize: `${Math.max((s.amountMinor / max) * 100, 1)}%` }} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
