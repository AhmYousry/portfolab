import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  isValidElement,
  useContext,
  useState,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyStatus, PromptBlock, useClipboardCopy } from './PromptBlock'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

export type CodeAction = 'copy' | 'reveal'
export interface CodeBlockInfo {
  language: string
  promptId?: string
}
type CodeActionHandler = (action: CodeAction, block: CodeBlockInfo) => void
const CodeActionContext = createContext<CodeActionHandler | null>(null)

const PROMPT_META = /\bprompt=([A-Za-z0-9_-]{1,32})\b/
const PROMPT_FENCE = /^ {0,3}(?:`{3,}|~{3,})[^\n]*\bprompt=[A-Za-z0-9_-]/m

export function promptIdFromMeta(meta: string): string | undefined {
  return PROMPT_META.exec(meta)?.[1]
}

export function hasPromptBlocks(source: string): boolean {
  return PROMPT_FENCE.test(source)
}

function CodeBlock({
  language,
  code,
  spoiler,
  promptId,
}: {
  language: string
  code: string
  spoiler: boolean
  promptId?: string
}) {
  const [revealed, setRevealed] = useState(!spoiler)
  const onAction = useContext(CodeActionContext)
  const { state: copyState, copy } = useClipboardCopy(() =>
    onAction?.('copy', { language, promptId }),
  )
  const copied = copyState === 'copied'

  const spoilerToggle = spoiler ? (
    <button
      type="button"
      onClick={() => {
        if (!revealed) onAction?.('reveal', { language, promptId })
        setRevealed((v) => !v)
      }}
      data-analytics-id="code-spoiler-toggle"
      aria-expanded={revealed}
      className="inline-flex items-center gap-1 text-amber-2 hover:text-amber"
    >
      {revealed ? (
        <EyeOff className="size-3.5" aria-hidden />
      ) : (
        <Eye className="size-3.5" aria-hidden />
      )}
      {revealed ? 'اخفي الحل' : 'اكشف الحل (spoiler)'}
    </button>
  ) : null

  const hiddenNotice = (
    <p className="p-6 text-sm text-muted">
      ده الحل المرجعي. جرب بنفسك الأول، وبعدين قارن. الكشف مش هيأثر على تقدمك.
    </p>
  )

  if (promptId) {
    return (
      <PromptBlock
        code={code}
        revealed={revealed}
        spoilerToggle={spoilerToggle}
        hiddenNotice={hiddenNotice}
        copyState={copyState}
        onCopy={(text) => void copy(text)}
      />
    )
  }

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-line bg-[#0c0c0c]">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-dim">
        <span dir="ltr" className="font-mono">
          {language || 'text'}
        </span>
        <span className="flex items-center gap-3">
          {spoilerToggle}
          {revealed && (
            <button
              type="button"
              onClick={() => void copy(code)}
              data-analytics-id="code-copy"
              className="inline-flex items-center gap-1 hover:text-paper"
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
              {copied ? 'اتنسخ' : 'نسخ'}
            </button>
          )}
        </span>
      </figcaption>
      {revealed ? (
        <pre
          dir="ltr"
          className="overflow-x-auto p-4 text-left text-sm leading-6 text-paper/90"
          tabIndex={0}
        >
          <code>{code}</code>
        </pre>
      ) : (
        hiddenNotice
      )}
      <CopyStatus state={copyState} />
    </figure>
  )
}

type PreProps = ComponentProps<'pre'> & {
  node?: { children?: { properties?: { className?: unknown }; data?: { meta?: string } }[] }
}

function Pre({ children, node }: PreProps) {
  const codeNode = node?.children?.[0]
  const className = codeNode?.properties?.className
  const classes = Array.isArray(className) ? className.map(String) : []
  const language = classes.find((c) => c.startsWith('language-'))?.replace('language-', '') ?? ''
  const meta = codeNode?.data?.meta ?? ''
  const code = textOf(children).replace(/\n$/, '')
  return (
    <CodeBlock
      key={`${language}\u0000${meta}\u0000${code}`}
      language={language}
      code={code}
      spoiler={/\bspoiler\b/.test(meta)}
      promptId={promptIdFromMeta(meta)}
    />
  )
}

export function Markdown({
  source,
  onCodeAction,
}: {
  source: string
  onCodeAction?: CodeActionHandler
}) {
  return (
    <CodeActionContext.Provider value={onCodeAction ?? null}>
      <div className="prose-lesson">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: Pre as never,
            a: ({ href, children }) => {
              const external = href?.startsWith('http')
              return (
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    </CodeActionContext.Provider>
  )
}
