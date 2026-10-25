import { formatMoney, type Currency } from '../domain/money'

type Props = {
  minor: number
  currency: Currency
  /** يُظهر «+» للموجب ويلوّن الموجب أخضر والسالب أحمر (للعمليات). */
  signed?: boolean
  className?: string
}

/** يعرض مبلغاً مع عملته، معزولاً عن اتجاه النص العربي حتى لا تنقلب الإشارة أو الرمز. */
export function Money({ minor, currency, signed = false, className }: Props) {
  const classes = ['num', minor < 0 && 'money--negative', signed && minor > 0 && 'money--positive', className]
  return (
    <bdi dir="ltr" className={classes.filter(Boolean).join(' ')}>
      {signed && minor > 0 ? '+' : ''}
      {formatMoney(minor, currency)}
    </bdi>
  )
}
