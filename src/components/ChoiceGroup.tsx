import { useId } from 'react'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  legend: string
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
}

/** مجموعة اختيار واحد (أزرار راديو بشكل شرائح). تعمل بلوحة المفاتيح بالأسهم. */
export function ChoiceGroup<T extends string>({ legend, options, value, onChange }: Props<T>) {
  const name = useId()
  return (
    <fieldset className="choice-group">
      <legend className="field__label">{legend}</legend>
      <div className="choice-group__options">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="choice__label">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
