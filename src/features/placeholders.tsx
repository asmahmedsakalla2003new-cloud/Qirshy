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
        description="سيظهر هنا ملخص مصاريفك ودخلك بالشيكل والدولار بعد إضافة أول عملية."
      />
    </>
  )
}

export function TransactionsScreen() {
  return (
    <>
      <h1 className="page-title">العمليات</h1>
      <EmptyState
        title="سجل العمليات فارغ"
        description="ستظهر هنا المصاريف والدخل والتحويلات، مع البحث والتصفية."
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

export function SettingsScreen() {
  return (
    <>
      <h1 className="page-title">الإعدادات</h1>
      <EmptyState
        title="الإعدادات قيد الإنشاء"
        description="ستجد هنا إنشاء نسخة احتياطية واستعادتها، وإعدادات العملات والفئات."
      />
      <p className="dev-link">
        <Link to="/design">معاينة نظام التصميم</Link>
      </p>
    </>
  )
}
