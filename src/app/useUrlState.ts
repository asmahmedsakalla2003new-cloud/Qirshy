import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * حالة شاشة تُحفظ في الرابط (لتبقى عند الرجوع إلى الشاشة)، لكنها تُقرأ وتُكتب
 * من حالة محلية تستجيب فوراً. ربط الحقول بالرابط مباشرةً يجعل الاختيار يرتد
 * لحظة ويُسقط أحرفاً عند الكتابة السريعة، لأن تحديث الرابط غير متزامن.
 */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState(
    () => Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>,
  )

  useEffect(() => {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(state) as [K, string][]) if (value) next.set(key, value)
    setParams(next, { replace: true })
  }, [state, setParams])

  const update = (patch: Partial<Record<K, string | undefined>>) =>
    setState((prev) => {
      const next = { ...prev }
      for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) next[key] = value ?? ''
      return next
    })

  return [state, update] as const
}
