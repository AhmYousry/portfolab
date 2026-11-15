import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, type ReactNode, isValidElement, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const COPY_RESET_MS = 1500

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function CodeBlock({
  language,
  code,
  spoiler,
}: {
  language: string
  code: string
  spoiler: boolean
}) {
  const [revealed, setRevealed] = useState(!spoiler)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      setCopied(false)
    }
  }

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-line bg-[#0c0c0c]">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-dim">
        <span dir="ltr" className="font-mono">
          {language || 'text'}
        </span>
        <span className="flex items-center gap-3">
          {spoiler && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
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
          )}
          {revealed && (
            <button
              type="button"
              onClick={copy}
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
        <p className="p-6 text-sm text-muted">
          ده الحل المرجعي. جرب بنفسك الأول، وبعدين قارن. الكشف مش هيأثر على تقدمك.
        </p>
      )}
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
  return <CodeBlock language={language} code={code} spoiler={/\bspoiler\b/.test(meta)} />
}

export function Markdown({ source }: { source: string }) {
  return (
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
  )
}
