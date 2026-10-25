import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * رسالة نجاح قصيرة تُمرَّر مع الانتقال: navigate(path, { state: { flash: '...' } }).
 * تُقرأ مرة واحدة ثم تُزال من سجل المتصفح حتى لا تعود عند إعادة التحميل.
 */
export function useFlash(): string | undefined {
  const location = useLocation()
  const navigate = useNavigate()
  const incoming = (location.state as { flash?: string } | null)?.flash
  const [message] = useState(incoming)

  useEffect(() => {
    if (incoming) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }, [incoming, location.pathname, location.search, navigate])

  return message
}
