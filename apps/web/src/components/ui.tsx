import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import type { AnalyticsId } from '@pb/shared'
import { type ClickProps, trackClick } from '../lib/analytics'

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-amber text-ink font-semibold hover:bg-amber-2 shadow-[0_8px_30px_-8px_rgb(245_165_36/0.6)] active:translate-y-px',
  ghost: 'border border-line-2 text-paper hover:border-paper/40 hover:bg-white/5',
  danger: 'border border-rose/60 text-rose hover:bg-rose/10',
  quiet: 'text-muted hover:text-paper',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[0.95rem] transition duration-150 disabled:cursor-not-allowed disabled:opacity-50'

interface Tracking {
  analyticsId?: AnalyticsId
  analyticsProps?: ClickProps
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  analyticsId,
  analyticsProps,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Tracking & { variant?: Variant; loading?: boolean }) {
  // Submit buttons are tracked in the form's onSubmit (covers Enter key), never on click.
  const trackOnClick = analyticsId && props.type !== 'submit'
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
      disabled={loading || props.disabled}
      {...(analyticsId ? { 'data-analytics-id': analyticsId } : {})}
      onClick={(event) => {
        if (trackOnClick) trackClick(analyticsId, analyticsProps)
        onClick?.(event)
      }}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function TrackedLink({
  analyticsId,
  analyticsProps,
  onClick,
  ...props
}: LinkProps & Required<Pick<Tracking, 'analyticsId'>> & Pick<Tracking, 'analyticsProps'>) {
  return (
    <Link
      {...props}
      {...(analyticsId ? { 'data-analytics-id': analyticsId } : {})}
      onClick={(event) => {
        trackClick(analyticsId, analyticsProps)
        onClick?.(event)
      }}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  analyticsId,
  analyticsProps,
  onClick,
  ...props
}: LinkProps & Tracking & { variant?: Variant }) {
  return (
    <Link
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
      {...(analyticsId ? { 'data-analytics-id': analyticsId } : {})}
      onClick={(event) => {
        if (analyticsId) trackClick(analyticsId, analyticsProps)
        onClick?.(event)
      }}
    />
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-ink-2/80 p-6 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  )
}

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'amber' | 'teal' | 'rose' | 'ok'
  children: ReactNode
}) {
  const tones = {
    default: 'border-line-2 text-muted',
    amber: 'border-amber/40 text-amber-2 bg-amber/10',
    teal: 'border-teal/40 text-teal bg-teal/10',
    rose: 'border-rose/40 text-rose bg-rose/10',
    ok: 'border-ok/40 text-ok bg-ok/10',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function Field({ label, error, hint, className = '', ...props }: FieldProps) {
  const id = useId()
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-paper/90">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className="w-full rounded-xl border border-line-2 bg-ink px-4 py-3 text-paper placeholder:text-dim aria-[invalid=true]:border-rose"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-rose">
          {error}
        </p>
      )}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-paper/90">
        {label}
      </label>
      <select
        id={id}
        className="w-full rounded-xl border border-line-2 bg-ink px-4 py-3 text-paper"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Loading({ label = 'بيحمل…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-16 text-muted justify-center">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label}
    </p>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto my-12 max-w-md rounded-2xl border border-rose/40 bg-rose/5 p-6 text-center"
    >
      <AlertTriangle className="mx-auto mb-3 size-6 text-rose" aria-hidden />
      <p className="mb-4">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          جرب تاني
        </Button>
      )}
    </div>
  )
}

export function Notice({
  tone = 'amber',
  children,
}: {
  tone?: 'amber' | 'rose' | 'teal'
  children: ReactNode
}) {
  const tones = {
    amber: 'border-amber/40 bg-amber/5',
    rose: 'border-rose/40 bg-rose/5',
    teal: 'border-teal/40 bg-teal/5',
  }
  return <div className={`rounded-xl border p-4 text-sm leading-7 ${tones[tone]}`}>{children}</div>
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-amber to-teal transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="mb-10">
      {eyebrow && <p className="mb-3 text-sm font-medium text-amber">{eyebrow}</p>}
      <h1 className="text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] font-bold leading-tight">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-lg leading-8 text-muted">{children}</div>}
    </header>
  )
}

export function Ltr({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="font-mono text-[0.9em]">
      {children}
    </bdi>
  )
}
