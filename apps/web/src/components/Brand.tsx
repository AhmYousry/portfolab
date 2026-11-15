import { BRAND } from '@pb/shared'

export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="pl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc861" />
          <stop offset="1" stopColor="#f5a524" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#pl-mark)" />
      <path
        d="M11 24V8h6.2a5 5 0 0 1 0 10H15"
        fill="none"
        stroke="#080808"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.5" cy="23" r="2.5" fill="#080808" />
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
