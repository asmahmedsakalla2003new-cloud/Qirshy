import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'danger'

type Props = {
  tone?: Tone
  title?: string
  children: ReactNode
}

/** رسالة حالة داخل الصفحة. رسائل الخطأ والتحذير تُعلَن لقارئ الشاشة فوراً. */
export function Alert({ tone = 'info', title, children }: Props) {
  const urgent = tone === 'danger' || tone === 'warning'
  return (
    <div className={`alert alert--${tone}`} role={urgent ? 'alert' : 'status'}>
      {title && <p className="alert__title">{title}</p>}
      <div className="alert__body">{children}</div>
    </div>
  )
}
