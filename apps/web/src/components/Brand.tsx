import { BRAND } from '@pb/shared'

const BRACKETS = 'M9.6 11 5.6 16l4 5M22.4 11l4 5-4 5'
const LETTER_P = 'M12.5 22.2V9.8h3.2a3.85 3.85 0 0 1 0 7.7h-3.2'

export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#0d0d0d" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="none"
        stroke="#f5f2ec"
        strokeOpacity="0.12"
      />
      <path
        d={BRACKETS}
        fill="none"
        stroke="var(--color-teal, #2dd4bf)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={LETTER_P}
        fill="none"
        stroke="var(--color-amber, #f5a524)"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandWordmark() {
  return (
    <span dir="ltr" className="flex items-center gap-2 font-bold tracking-tight">
      <BrandMark />
      <span>
        Portfo<span className="text-amber">lab</span>
      </span>
      <span className="sr-only">{BRAND.name}</span>
    </span>
  )
}
