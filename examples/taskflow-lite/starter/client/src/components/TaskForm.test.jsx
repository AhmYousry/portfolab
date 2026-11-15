import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TaskForm, { validateTask } from './TaskForm.jsx'

describe('validateTask', () => {
  it('requires a non-blank title', () => {
    expect(validateTask({ title: '   ' })).toEqual({ title: 'Title is required' })
    expect(validateTask({ title: 'Ok' })).toEqual({})
  })
})

describe('TaskForm', () => {
  it('shows a validation error and does not call onSave for an empty title', async () => {
    const onSave = vi.fn()
    render(<TaskForm onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('sends a clean payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TaskForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Title'), '  Write tests  ')
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'HIGH')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Write tests',
      description: null,
      status: 'TODO',
      priority: 'HIGH',
      dueDate: null,
    })
  })

  it('shows the server error message', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Validation failed'))
    render(<TaskForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Title'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Validation failed')
  })
})
