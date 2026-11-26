import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Markdown, hasPromptBlocks } from './Markdown'
import { extractPlaceholders, fillPrompt } from './PromptBlock'

const TEMPLATE =
  'Build a page for {{project name}}.\nUse {{ primary color }} for buttons.\nRepeat: {{project name}}.'

function fence(id: string, body: string, extra = '') {
  return `\`\`\`text ${extra}prompt=${id}\n${body}\n\`\`\``
}

function mockClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.assign(navigator, { clipboard: { writeText } })
  return writeText
}

const copyButton = () => screen.getByRole('button', { name: /انسخ البرومبت|اتنسخ/ })

describe('placeholder helpers', () => {
  it('extracts unique placeholders in order, normalizing whitespace', () => {
    expect(extractPlaceholders(TEMPLATE)).toEqual(['project name', 'primary color'])
    expect(extractPlaceholders('{{  a   b }} {{a b}} {{ }}')).toEqual(['a b'])
    expect(extractPlaceholders('no fields here')).toEqual([])
  })

  it('replaces repeated placeholders consistently with raw values and keeps unfilled ones', () => {
    const values = new Map([
      ['project name', '  Nile Shop '],
      ['primary color', ' \n\t '],
    ])
    expect(fillPrompt(TEMPLATE, values)).toBe(
      'Build a page for   Nile Shop .\nUse {{ primary color }} for buttons.\nRepeat:   Nile Shop .',
    )
  })

  it('inserts replacement-pattern characters literally', () => {
    const values = new Map([
      ['project name', "$& $1 $$ $` $'"],
      ['primary color', 'red'],
    ])
    expect(fillPrompt(TEMPLATE, values)).toBe(
      "Build a page for $& $1 $$ $` $'.\nUse red for buttons.\nRepeat: $& $1 $$ $` $'.",
    )
  })

  it('is safe for prototype-like labels', () => {
    expect(fillPrompt('{{constructor}} {{__proto__}}', new Map())).toBe(
      '{{constructor}} {{__proto__}}',
    )
  })

  it('detects prompt fences only', () => {
    expect(hasPromptBlocks(fence('A1', 'x'))).toBe(true)
    expect(hasPromptBlocks('```js\nconst prompt=1\n```')).toBe(false)
  })
})

describe('prompt block with placeholders', () => {
  it('keeps copy disabled until every unique field has non-blank text, then copies the filled prompt', async () => {
    const writeText = mockClipboard()
    const onCodeAction = vi.fn()
    render(<Markdown source={fence('P1', TEMPLATE)} onCodeAction={onCodeAction} />)

    expect(screen.getByText(/فين تلصقه/)).toBeInTheDocument()
    const name = screen.getByLabelText(/project name/)
    const color = screen.getByLabelText(/primary color/)
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(copyButton()).toBeDisabled()

    await userEvent.type(name, 'Nile $& Shop')
    expect(copyButton()).toBeDisabled()
    await userEvent.type(color, '   ')
    expect(copyButton()).toBeDisabled()
    await userEvent.clear(color)
    await userEvent.type(color, 'teal')
    expect(copyButton()).toBeEnabled()

    const expected = 'Build a page for Nile $& Shop.\nUse teal for buttons.\nRepeat: Nile $& Shop.'
    expect(screen.getByTestId('prompt-preview')).toHaveTextContent(expected.replace(/\n/g, ' '))
    expect(screen.getByTestId('prompt-preview')).toHaveAttribute('dir', 'ltr')

    await userEvent.click(copyButton())
    expect(writeText).toHaveBeenCalledWith(expected)
    expect(onCodeAction.mock.calls).toEqual([['copy', { language: 'text', promptId: 'P1' }]])
    expect(JSON.stringify(onCodeAction.mock.calls)).not.toContain('Nile')
    expect(screen.getByRole('status')).toHaveTextContent('اتنسخ')
  })

  it('accepts a pasted multi-line error in a textarea and copies it verbatim', async () => {
    const writeText = mockClipboard()
    const pasted = "TypeError: x is $& undefined\n    at main (app.ts:3:7)\n\n  $1 $' done"
    render(<Markdown source={fence('E1', 'Fix this error:\n{{error output}}\nThanks.')} />)

    const field = screen.getByLabelText(/error output/)
    expect(field.tagName).toBe('TEXTAREA')
    await userEvent.click(field)
    await userEvent.paste(pasted)
    expect(field).toHaveValue(pasted)

    const expected = `Fix this error:\n${pasted}\nThanks.`
    expect(screen.getByTestId('prompt-preview').textContent).toBe(expected)
    await userEvent.click(copyButton())
    expect(writeText).toHaveBeenCalledWith(expected)
  })

  it('marks the editable region as excluded from capture', () => {
    render(<Markdown source={fence('P1', TEMPLATE)} />)
    expect(screen.getByLabelText(/project name/).closest('.ph-no-capture')).not.toBeNull()
    expect(screen.getByTestId('prompt-preview')).toHaveClass('ph-mask')
  })

  it('keeps state independent per block with unique field ids', async () => {
    mockClipboard()
    render(<Markdown source={`${fence('A', TEMPLATE)}\n\n${fence('B', TEMPLATE)}`} />)
    const names = screen.getAllByLabelText(/project name/)
    expect(names).toHaveLength(2)
    expect(names[0]?.id).not.toBe(names[1]?.id)

    await userEvent.type(names[0] as HTMLElement, 'First')
    expect(names[0]).toHaveValue('First')
    expect(names[1]).toHaveValue('')
  })

  it('resets typed values when the content changes', async () => {
    mockClipboard()
    const { rerender } = render(<Markdown source={fence('A', TEMPLATE)} />)
    await userEvent.type(screen.getByLabelText(/project name/), 'Kept?')

    rerender(<Markdown source={fence('A', `${TEMPLATE}\nExtra line.`)} />)
    expect(screen.getByLabelText(/project name/)).toHaveValue('')
  })

  it('shows a visible error when the clipboard rejects and reports nothing', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const onCodeAction = vi.fn()
    render(<Markdown source={fence('P1', '{{goal}}')} onCodeAction={onCodeAction} />)
    await userEvent.type(screen.getByLabelText(/goal/), 'Ship it')
    await userEvent.click(copyButton())

    expect(screen.getByRole('status')).toHaveTextContent(/المتصفح منع النسخ/)
    expect(onCodeAction).not.toHaveBeenCalled()
  })

  it('keeps spoiler prompts hidden, without fields or copy, until revealed', async () => {
    const onCodeAction = vi.fn()
    render(<Markdown source={fence('S1', TEMPLATE, 'spoiler ')} onCodeAction={onCodeAction} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /نسخ/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Build a page/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /اكشف الحل/ }))
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(onCodeAction).toHaveBeenCalledWith('reveal', { language: 'text', promptId: 'S1' })
  })
})

describe('blocks without placeholders', () => {
  it('copies prompts without fields directly with the original label', async () => {
    const writeText = mockClipboard()
    render(<Markdown source={fence('F1', 'Explain this change.')} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }))
    expect(writeText).toHaveBeenCalledWith('Explain this change.')
  })

  it('leaves normal code fences unchanged and surfaces clipboard failure', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    render(<Markdown source={'```js\nconst x = "{{not a field}}"\n```'} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/فين تلصقه/)).not.toBeInTheDocument()
    expect(screen.getByText('const x = "{{not a field}}"').closest('pre')).toHaveAttribute(
      'dir',
      'ltr',
    )
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }))
    expect(screen.getByRole('status')).toHaveTextContent(/المتصفح منع النسخ/)
  })
})
