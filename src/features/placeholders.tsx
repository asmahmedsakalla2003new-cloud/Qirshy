import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'

/*
 * شاشات مؤقتة للمرحلة 1: تثبّت التنقل فقط، وتُستبدل بمحتواها الفعلي في المراحل القادمة.
 */

export function HomeScreen() {
  return (
    <>
      <h1 className="page-title">الرئيسية</h1>
      <EmptyState
        title="لا توجد عمليات بعد"
        description="سيظهر هنا ملخص مصاريفك ودخلك بالشيكل والدولار حسب الفئات."
        action={
          <Link to="/transactions" className="btn btn--secondary btn--md">
            عرض العمليات
          </Link>
        }
      />
    </>
  )
}

export function BudgetsScreen() {
  return (
    <>
      <h1 className="page-title">الميزانيات</h1>
      <EmptyState
        title="لم تُحدَّد ميزانية بعد"
        description="ستتمكن من تحديد ميزانية شهرية عامة وميزانية لكل فئة، مع تنبيه عند الاقتراب منها."
      />
    </>
  )
}
