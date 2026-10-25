import { formatMonth, shiftMonth } from '../domain/months'
import { Icon } from './Icon'

type Props = {
  month: string
  onChange: (month: string) => void
  /** آخر شهر مسموح (مثل الشهر الحالي في الملخص). بلا حد إن لم يُحدد. */
  max?: string
  titleId?: string
}

/** التنقل بين الأشهر. في RTL: السابق على اليمين والتالي على اليسار. */
export function MonthNav({ month, onChange, max, titleId }: Props) {
  return (
    <div className="month-nav">
      <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => onChange(shiftMonth(month, -1))}>
        <Icon name="chevronRight" size={20} />
      </button>
      <h2 id={titleId} className="month-nav__title">
        {formatMonth(month)}
      </h2>
      <button
        type="button"
        className="icon-btn"
        aria-label="الشهر التالي"
        disabled={max !== undefined && month >= max}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <Icon name="chevron" size={20} />
      </button>
    </div>
  )
}
