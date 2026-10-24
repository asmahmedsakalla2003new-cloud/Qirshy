import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'

/** يظهر إذا لم يتمكن المتصفح من فتح قاعدة البيانات المحلية. */
export function StartupError() {
  return (
    <main className="welcome">
      <div className="welcome__hero">
        <Logo size={72} />
        <h1>تعذّر فتح قِرْش</h1>
      </div>
      <Alert tone="danger" title="لا يمكن الوصول إلى التخزين على هذا الجهاز">
        <p>يحفظ قِرْش بياناتك داخل المتصفح، لكن المتصفح منع ذلك. قد يحدث هذا في وضع التصفح الخفي، أو إذا كان حفظ بيانات المواقع معطّلاً في إعدادات المتصفح.</p>
      </Alert>
      <p className="muted">افتح التطبيق في نافذة عادية، أو اسمح بحفظ بيانات المواقع، ثم أعد المحاولة.</p>
      <Button size="lg" fullWidth onClick={() => window.location.reload()}>
        إعادة المحاولة
      </Button>
    </main>
  )
}
