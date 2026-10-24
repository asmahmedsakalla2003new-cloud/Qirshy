/** شعار قِرْش: عملة زمردية فيها حرف «ق» على خلفية نيلية. مرّر title فارغاً ليكون زخرفياً. */
export function Logo({ size = 64, title = 'قِرْش' }: { size?: number; title?: string }) {
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...a11y}>
      <rect width="64" height="64" rx="16" fill="#312e81" />
      <circle cx="32" cy="32" r="20" fill="#059669" />
      <circle cx="32" cy="32" r="16" fill="none" stroke="#d1fae5" strokeWidth="1.5" opacity="0.6" />
      <text
        x="32"
        y="30"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Cairo Variable', sans-serif"
        fontWeight="700"
        fontSize="22"
        fill="#ffffff"
      >
        ق
      </text>
    </svg>
  )
}
