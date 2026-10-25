import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * رسالة قصيرة تُمرَّر مع الانتقال: navigate(path, { state: { flash: '...' } }).
 * key: 'flash' لرسالة النجاح، و'warning' لتنبيه (مثل تجاوز الميزانية).
 * تُقرأ مرة واحدة ثم تُزال من سجل المتصفح حتى لا تعود عند إعادة التحميل.
 */
export function useFlash(key: 'flash' | 'warning' = 'flash'): string | undefined {
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = (location.state as Record<string, string> | null)?.[key]
  const [message] = useState(incoming)

  useEffect(() => {
    if (incoming) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }, [incoming, location.pathname, location.search, navigate])

  return message
}
