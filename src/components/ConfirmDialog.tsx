import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * نافذة تأكيد للإجراءات الخطرة. تعتمد على عنصر <dialog> في المتصفح،
 * فيُحبس التركيز داخلها، ويغلقها مفتاح Esc، ويعود التركيز بعد الإغلاق تلقائياً.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <h2 id="confirm-dialog-title" className="dialog__title">
        {title}
      </h2>
      <div className="dialog__body">{children}</div>
      <div className="dialog__actions">
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} autoFocus>
          إلغاء
        </Button>
      </div>
    </dialog>
  )
}
