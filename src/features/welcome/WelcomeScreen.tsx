import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { Logo } from '../../components/Logo'
import { completeOnboarding } from '../../data/settingsRepo'

const highlights: { icon: IconName; title: string; text: string }[] = [
  { icon: 'coins', title: 'شيكل ودولار', text: 'سجّل مصاريفك ودخلك بالعملتين، وكل عملة تُحسب وحدها.' },
  { icon: 'offline', title: 'يعمل دون إنترنت', text: 'أضف عملياتك وراجعها في أي وقت، حتى بلا اتصال.' },
  { icon: 'shield', title: 'بياناتك على جهازك', text: 'لا حساب ولا تسجيل دخول، ولا تُرسل بياناتك إلى أي خادم.' },
]

export function WelcomeScreen() {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  async function start() {
    try {
      await completeOnboarding()
      navigate('/', { replace: true })
    } catch {
      setFailed(true)
    }
  }

  return (
    <main className="welcome">
      <div className="welcome__hero">
        <Logo size={88} />
        <h1>أهلاً بك في قِرْش</h1>
        <p className="welcome__lead">طريقة بسيطة ومجانية لمتابعة مصاريفك وميزانيتك.</p>
      </div>

      <ul className="welcome__list">
        {highlights.map((h) => (
          <li key={h.title} className="welcome__item">
            <span className="welcome__icon">
              <Icon name={h.icon} />
            </span>
            <div>
              <h2 className="welcome__item-title">{h.title}</h2>
              <p className="welcome__item-text">{h.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <Alert tone="info" title="احفظ نسخة احتياطية بانتظام">
        بياناتك محفوظة في هذا المتصفح فقط. إذا مسحت بيانات المتصفح ستُحذف، لذا أنشئ نسخة احتياطية من الإعدادات واحتفظ بها في مكان آمن.
      </Alert>

      {failed && (
        <Alert tone="danger" title="تعذّر الحفظ">
          لم نتمكن من حفظ الإعداد على هذا الجهاز. حاول مرة أخرى.
        </Alert>
      )}

      <Button size="lg" fullWidth onClick={start}>
        ابدأ الآن
      </Button>
    </main>
  )
}
