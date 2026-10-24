import { formatMoney, type Currency } from '../domain/money'

/** يعرض مبلغاً مع عملته، معزولاً عن اتجاه النص العربي حتى لا تنقلب الإشارة أو الرمز. */
export function Money({ minor, currency, className }: { minor: number; currency: Currency; className?: string }) {
  return (
    <bdi dir="ltr" className={['num', minor < 0 && 'money--negative', className].filter(Boolean).join(' ')}>
      {formatMoney(minor, currency)}
    </bdi>
  )
}
