import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className,
  ...rest
}: Props) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--full', className]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
