import { Alert } from '../../components/Alert'
import { Money } from '../../components/Money'
import { currencyLabels, type Currency } from '../../domain/money'
import type { Confidence, ReceiptData } from '../../domain/receipt'

const confidenceText: Record<Confidence, string> = {
  high: 'قُرئ بجانب كلمة «الإجمالي»',
  medium: 'قُرئ بجانب «المجموع»؛ تأكد أنه الإجمالي النهائي',
  low: 'تقديري؛ تأكد منه',
}

type Props = { receipt: ReceiptData; accountCurrency?: Currency }

/** لوحة مراجعة فوق نموذج المصروف: ما قُرئ وما يحتاج تأكيداً. لا يُحفظ شيء قبل «حفظ». */
export function ReceiptReview({ receipt, accountCurrency }: Props) {
  const currency = receipt.currency ?? accountCurrency ?? 'ILS'
  const warnings = [...receipt.warnings]
  if (receipt.currency && accountCurrency && receipt.currency !== accountCurrency) {
    warnings.push(`عملة الفاتورة ${currencyLabels[receipt.currency]} والحساب المختار بال${currencyLabels[accountCurrency]}. اختر حساباً بعملة الفاتورة أو صحّح المبلغ.`)
  }

  return (
    <section className="receipt-review stack stack--tight" aria-label="مراجعة الفاتورة">
      <Alert tone="info" title="راجع ما قُرئ من الفاتورة">
        القيم أدناه مقروءة آلياً وقد تحتوي أخطاء. عدّل ما يلزم ثم اضغط «حفظ المصروف».
        {receipt.totalConfidence && <p className="small">المبلغ: {confidenceText[receipt.totalConfidence]}.</p>}
      </Alert>
      {warnings.length > 0 && (
        <Alert tone="warning" title="تحقق من التالي">
          <ul className="steps">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      {receipt.items.length > 0 && (
        <details className="filters">
          <summary>الأصناف المقروءة ({receipt.items.length})</summary>
          <ul className="receipt-items" aria-label="الأصناف المقروءة">
            {receipt.items.map((item, i) => (
              <li key={i}>
                <span>{item.name}</span>
                <Money minor={item.amountMinor} currency={currency} />
              </li>
            ))}
            <li className="receipt-items__sum">
              <span>مجموع الأصناف</span>
              <Money minor={receipt.itemsSumMinor} currency={currency} />
            </li>
          </ul>
        </details>
      )}
    </section>
  )
}
