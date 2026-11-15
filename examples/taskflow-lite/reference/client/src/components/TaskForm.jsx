import { useState } from 'react'

const TITLE_MAX = 120

function initialValues(task) {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'TODO',
    priority: task?.priority ?? 'MEDIUM',
    dueDate: task?.dueDate ?? '',
  }
}

export function validateTask(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Title is required'
  else if (title.length > TITLE_MAX) errors.title = `Title must be ${TITLE_MAX} characters or less`
  return errors
}

export default function TaskForm({ task, onSave, onCancel }) {
  const [values, setValues] = useState(() => initialValues(task))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  function update(field) {
    return (event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validateTask(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    setServerError('')
    try {
      await onSave({
        title: values.title.trim(),
        description: values.description.trim() || null,
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate || null,
      })
      if (!task) setValues(initialValues(null))
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>{task ? 'Edit task' : 'New task'}</h2>

      <label htmlFor="title">Title</label>
      <input
        id="title"
        value={values.title}
        onChange={update('title')}
        aria-invalid={Boolean(errors.title)}
        aria-describedby={errors.title ? 'title-error' : undefined}
      />
      {errors.title && (
        <p id="title-error" className="field-error">
          {errors.title}
        </p>
      )}

      <label htmlFor="description">Description (optional)</label>
      <textarea
        id="description"
        rows={2}
        value={values.description}
        onChange={update('description')}
      />

      <div className="row">
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" value={values.status} onChange={update('status')}>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
        <div>
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={values.priority} onChange={update('priority')}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div>
          <label htmlFor="dueDate">Due date</label>
          <input id="dueDate" type="date" value={values.dueDate} onChange={update('dueDate')} />
        </div>
      </div>

      {serverError && (
        <p role="alert" className="field-error">
          {serverError}
        </p>
      )}

      <div className="actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : task ? 'Save changes' : 'Add task'}
        </button>
        {task && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
