import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
