import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { safeNext } from './Guards'
import { Markdown } from './Markdown'

const SOURCE = `## عنوان

نص عربي مع \`inline code\`.

\`\`\`js
const visible = true
\`\`\`

\`\`\`js spoiler
const answer = 42
\`\`\`

<script>alert(1)</script>
`

describe('Markdown', () => {
  it('renders code blocks left-to-right', () => {
    render(<Markdown source={SOURCE} />)
    const pre = screen.getByText('const visible = true').closest('pre')
    expect(pre).toHaveAttribute('dir', 'ltr')
  })

  it('hides spoiler blocks until revealed', async () => {
    render(<Markdown source={SOURCE} />)
    expect(screen.queryByText('const answer = 42')).not.toBeInTheDocument()
    const reveal = screen.getByRole('button', { name: /اكشف الحل/ })
    expect(reveal).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(reveal)
    expect(screen.getByText('const answer = 42')).toBeInTheDocument()
  })

  it('does not render raw HTML from content', () => {
    const { container } = render(<Markdown source={SOURCE} />)
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('prompt ids', () => {
  it('parses prompt ids from the fence meta', async () => {
    const { promptIdFromMeta } = await import('./Markdown')
    expect(promptIdFromMeta('prompt=F07')).toBe('F07')
    expect(promptIdFromMeta('spoiler prompt=F10')).toBe('F10')
    expect(promptIdFromMeta('spoiler')).toBeUndefined()
  })

  it('copy on a prompt block reports its id; a plain text block has none', async () => {
    const { Markdown } = await import('./Markdown')
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const onCodeAction = vi.fn()
    render(
      <Markdown
        source={'```text prompt=F03\nDesign my model\n```\n\n```text\n[ diagram ]\n```'}
        onCodeAction={onCodeAction}
      />,
    )
    const copyButtons = screen.getAllByRole('button', { name: /نسخ/ })
    await userEvent.click(copyButtons[0] as HTMLElement)
    await userEvent.click(copyButtons[1] as HTMLElement)
    expect(onCodeAction.mock.calls).toEqual([
      ['copy', { language: 'text', promptId: 'F03' }],
      ['copy', { language: 'text', promptId: undefined }],
    ])
  })
})

describe('safeNext', () => {
  it.each([
    [null, '/dashboard'],
    ['/projects/x', '/projects/x'],
    ['//evil.example', '/dashboard'],
    ['https://evil.example', '/dashboard'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})
