import { Check, Copy, MessageSquareText } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Button } from './ui'

const COPY_RESET_MS = 1500
const FIELD_ROWS = 2
const FIELD_LIST_STYLE: CSSProperties = { listStyle: 'none', paddingInlineStart: 0, margin: 0 }
const FIELD_ITEM_STYLE: CSSProperties = { margin: 0 }
const PLACEHOLDER = /\{\{\s*([^{}\n]+?)\s*\}\}/g

export function placeholderKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = placeholderKey(match[1] ?? '')
    if (key) seen.add(key)
  }
  return [...seen]
}

export function fillPrompt(template: string, values: ReadonlyMap<string, string>): string {
  return template.replace(PLACEHOLDER, (whole: string, raw: string) => {
    const value = values.get(placeholderKey(raw))
    return value?.trim() ? value : whole
  })
}

type Segment = { kind: 'text'; text: string } | { kind: 'field'; key: string; raw: string }

function splitTemplate(template: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = placeholderKey(match[1] ?? '')
    if (!key) continue
    if (match.index > cursor)
      segments.push({ kind: 'text', text: template.slice(cursor, match.index) })
    segments.push({ kind: 'field', key, raw: match[0] })
    cursor = match.index + match[0].length
  }
  if (cursor < template.length) segments.push({ kind: 'text', text: template.slice(cursor) })
  return segments
}

export type CopyState = 'idle' | 'copied' | 'failed'

export function useClipboardCopy(onCopied: () => void) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy(text: string) {
    clearTimeout(timer.current)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setState('copied')
      onCopied()
      timer.current = setTimeout(() => setState('idle'), COPY_RESET_MS)
    } catch {
      setState('failed')
    }
  }

  return { state, copy }
}

export function CopyStatus({ state }: { state: CopyState }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        state === 'failed'
          ? 'border-t border-rose/40 bg-rose/5 px-4 py-2 text-sm leading-6 text-rose'
          : 'sr-only'
      }
    >
      {state === 'copied' && 'اتنسخ.'}
      {state === 'failed' &&
        'المتصفح منع النسخ. حدد النص بنفسك وانسخه (Ctrl+C، أو ضغطة طويلة على الموبايل).'}
    </p>
  )
}

function PromptFields({
  code,
  copyState,
  onCopy,
}: {
  code: string
  copyState: CopyState
  onCopy: (text: string) => void
}) {
  const baseId = useId()
  const [values, setValues] = useState<ReadonlyMap<string, string>>(() => new Map())
  const fields = extractPlaceholders(code)
  const remaining = fields.filter((key) => !values.get(key)?.trim()).length
  const helpId = `${baseId}-help`
  const remainingId = `${baseId}-remaining`

  function update(key: string, value: string) {
    setValues((prev) => new Map(prev).set(key, value))
  }

  return (
    <>
      <div className="ph-no-capture">
        <div className="space-y-4 p-4">
          <p className="text-sm font-semibold text-paper/90">
            خصّص البرومبت لمشروعك ({fields.length} {fields.length === 1 ? 'خانة' : 'خانات'})
          </p>
          <p id={helpId} className="text-xs leading-6 text-dim">
            اسم كل خانة بالإنجليزي بيوصف المطلوب. اكتب قيمتك أنت، ويُفضّل بالإنجليزي وباختصار. أمثلة
            مناسبة موجودة في شرح الخطوة فوق.
          </p>
          <ol className="grid gap-3" style={FIELD_LIST_STYLE}>
            {fields.map((key, index) => {
              const inputId = `${baseId}-field-${index}`
              return (
                <li key={key} style={FIELD_ITEM_STYLE}>
                  <label htmlFor={inputId} className="mb-2 flex items-center gap-2 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber/15 text-xs font-semibold text-amber-2">
                      {index + 1}
                    </span>
                    <bdi dir="ltr" className="font-mono text-paper/90">
                      {key}
                    </bdi>
                  </label>
                  <textarea
                    id={inputId}
                    dir="auto"
                    rows={FIELD_ROWS}
                    autoComplete="off"
                    spellCheck={false}
                    aria-required="true"
                    aria-describedby={helpId}
                    value={values.get(key) ?? ''}
                    onChange={(event) => update(key, event.target.value)}
                    className="block w-full resize-y rounded-xl border border-line-2 bg-ink px-4 py-2.5 font-mono text-sm leading-6 text-paper placeholder:text-dim"
                  />
                </li>
              )
            })}
          </ol>
        </div>
        <div className="border-t border-line">
          <p className="px-4 pt-3 text-xs text-dim">المعاينة النهائية، ودي بالظبط اللي هتتنسخ:</p>
          <pre
            dir="ltr"
            className="ph-mask overflow-x-auto whitespace-pre-wrap p-4 text-left text-sm leading-6 text-paper/90"
            tabIndex={0}
            data-testid="prompt-preview"
          >
            <code>
              {splitTemplate(code).map((segment, i) => {
                if (segment.kind === 'text') return <span key={i}>{segment.text}</span>
                const value = values.get(segment.key)
                return value?.trim() ? (
                  <span key={i} className="rounded bg-teal/15 px-0.5 text-teal">
                    {value}
                  </span>
                ) : (
                  <span key={i} className="rounded bg-amber/15 px-0.5 text-amber-2">
                    {segment.raw}
                  </span>
                )
              })}
            </code>
          </pre>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <Button
          type="button"
          className="px-4 py-2 text-sm"
          disabled={remaining > 0}
          aria-describedby={remainingId}
          data-analytics-id="code-copy"
          onClick={() => onCopy(fillPrompt(code, values))}
        >
          {copyState === 'copied' ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copyState === 'copied' ? 'اتنسخ' : 'انسخ البرومبت'}
        </Button>
        <span id={remainingId} className="text-xs text-dim">
          {remaining > 0
            ? `فاضل ${remaining} من ${fields.length} قبل النسخ`
            : 'جاهز. انسخه والصقه في الشات بتاعك.'}
        </span>
      </div>
    </>
  )
}

export function PromptBlock({
  code,
  revealed,
  spoilerToggle,
  hiddenNotice,
  copyState,
  onCopy,
}: {
  code: string
  revealed: boolean
  spoilerToggle: ReactNode
  hiddenNotice: ReactNode
  copyState: CopyState
  onCopy: (text: string) => void
}) {
  const hasFields = extractPlaceholders(code).length > 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-amber/40 bg-[#0c0c0c]">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-amber/30 bg-amber/5 px-4 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-2">
          <MessageSquareText className="size-4" aria-hidden /> برومبت لمساعد الـAI بتاعك
        </span>
        <span className="flex items-center gap-3 text-xs text-dim">
          {spoilerToggle}
          {revealed && !hasFields && (
            <button
              type="button"
              onClick={() => onCopy(code)}
              data-analytics-id="code-copy"
              className="inline-flex items-center gap-1 hover:text-paper"
            >
              {copyState === 'copied' ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copyState === 'copied' ? 'اتنسخ' : 'نسخ'}
            </button>
          )}
        </span>
      </figcaption>
      <p className="border-b border-line px-4 py-2 text-xs leading-6 text-muted">
        <strong className="text-paper/90">فين تلصقه؟</strong> في شات مساعد الـAI اللي فاتحه بنفسك في
        تاب تانية. مش هنا في الموقع، ومش في التيرمنال.
      </p>
      {!revealed ? (
        hiddenNotice
      ) : hasFields ? (
        <PromptFields code={code} copyState={copyState} onCopy={onCopy} />
      ) : (
        <pre
          dir="ltr"
          className="overflow-x-auto p-4 text-left text-sm leading-6 text-paper/90"
          tabIndex={0}
        >
          <code>{code}</code>
        </pre>
      )}
      <CopyStatus state={copyState} />
    </figure>
  )
}
