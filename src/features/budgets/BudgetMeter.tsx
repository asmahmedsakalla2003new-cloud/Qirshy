import { Icon } from '../../components/Icon'
import { Money } from '../../components/Money'
import type { BudgetStatus } from '../../domain/budgets'
import type { Currency } from '../../domain/money'

const levelText = { ok: undefined, near: 'اقتربت من الحد', over: 'وصلت إلى الحد' } as const

/**
 * مقياس الميزانية: التعبئة تحمل الحالة (زمردي ← كهرماني ← أحمر) والمسار درجة فاتحة
 * من اللون نفسه. الحالة تُكتب نصاً مع أيقونة، فلا تعتمد على اللون وحده.
 */
export function BudgetMeter({ status, currency }: { status: BudgetStatus; currency: Currency }) {
  const fill = Math.min(status.percent, 100)
  const label = levelText[status.level]
  return (
    <div className={`meter meter--${status.level}`}>
      <div className="meter__head">
        <span>
          صُرف <Money minor={status.spentMinor} currency={currency} /> من{' '}
          <Money minor={status.limitMinor} currency={currency} />
        </span>
        <bdi className="num meter__percent">{Math.round(status.percent)}%</bdi>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-label="نسبة الاستهلاك"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={`${Math.round(status.percent)}%`}
      >
        <span className="meter__fill" style={{ inlineSize: `${fill}%` }} />
      </div>
      <div className="meter__foot">
        {status.remainingMinor >= 0 ? (
          <span>
            المتبقي <Money minor={status.remainingMinor} currency={currency} />
          </span>
        ) : (
          <span className="meter__over">
            تجاوزت بـ <Money minor={-status.remainingMinor} currency={currency} />
          </span>
        )}
        {label && (
          <span className="meter__status">
            <Icon name="alert" size={16} />
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
