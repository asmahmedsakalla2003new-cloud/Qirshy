import { useId, type SelectHTMLAttributes } from 'react'

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string
  options: { value: string; label: string }[]
}

/** قائمة منسدلة أصلية من المتصفح بعنوان ظاهر دائماً. */
export function SelectField({ label, options, className, ...rest }: Props) {
  const id = useId()
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field__input field__select" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
