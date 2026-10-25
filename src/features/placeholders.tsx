import { EmptyState } from '../components/EmptyState'

/*
 * شاشات مؤقتة للمرحلة 1: تثبّت التنقل فقط، وتُستبدل بمحتواها الفعلي في المراحل القادمة.
 */

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
