import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'

const swatches = [
  ['--color-primary', 'زمردي — الإجراءات'],
  ['--color-brand', 'نيلي — الهوية'],
  ['--color-danger', 'خطأ / تجاوز'],
  ['--color-warning', 'تحذير / اقتراب'],
  ['--color-text-muted', 'نص ثانوي'],
  ['--color-surface-muted', 'سطح ثانوي'],
] as const

/** صفحة معاينة لعناصر نظام التصميم (للمراجعة أثناء التطوير). */
export function DesignSystemScreen() {
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const amountError = touched && amount.trim() === '' ? 'أدخل المبلغ.' : undefined

  return (
    <div className="stack">
      <p>
        <Link to="/settings">→ العودة إلى الإعدادات</Link>
      </p>
      <h1 className="page-title">نظام التصميم</h1>

      <Card>
        <h2 className="section-title">الألوان</h2>
        <ul className="swatches">
          {swatches.map(([token, label]) => (
            <li key={token} className="swatch">
              <span className="swatch__chip" style={{ background: `var(${token})` }} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="section-title">الخطوط</h2>
        <h1>عنوان رئيسي</h1>
        <h2>عنوان قسم</h2>
        <h3>عنوان فرعي</h3>
        <p>نص أساسي: سجّلت مصروف بقالة بقيمة <span className="num">125.50 ₪</span> اليوم.</p>
        <p className="muted">نص ثانوي للتوضيحات والتواريخ.</p>
      </Card>

      <Card>
        <h2 className="section-title">الأزرار</h2>
        <div className="row-wrap">
          <Button>حفظ العملية</Button>
          <Button variant="secondary">إلغاء</Button>
          <Button variant="ghost">عرض الكل</Button>
          <Button variant="danger">حذف العملية</Button>
          <Button disabled>غير متاح</Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">الحقول</h2>
        <div className="stack">
          <TextField
            label="المبلغ"
            inputMode="decimal"
            placeholder="0.00"
            hint="بالشيكل"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setTouched(true)}
            error={amountError}
          />
          <TextField label="الوصف" hint="اختياري" />
          <TextField label="حقل فيه خطأ" defaultValue="-5" error="يجب أن يكون المبلغ أكبر من صفر." />
        </div>
      </Card>

      <Card>
        <h2 className="section-title">رسائل الحالة</h2>
        <div className="stack">
          <Alert tone="success" title="تم الحفظ">أُضيفت العملية بنجاح.</Alert>
          <Alert tone="warning" title="اقتربت من الميزانية">استهلكت 80% من ميزانية البقالة لهذا الشهر.</Alert>
          <Alert tone="danger" title="تعذّر الحفظ">لم نتمكن من حفظ العملية. حاول مرة أخرى.</Alert>
          <Alert tone="info">بياناتك محفوظة على هذا الجهاز فقط.</Alert>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">الحالة الفارغة</h2>
        <EmptyState
          title="لا توجد عمليات"
          description="أضف أول مصروف لتبدأ متابعة ميزانيتك."
          action={<Button>إضافة مصروف</Button>}
        />
      </Card>
    </div>
  )
}
