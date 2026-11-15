import { useState } from 'react'

export function validateTask(values) {
  const errors = {}
  // TODO (Module 4): title is required and max 120 chars.
  // Return { title: 'Title is required' } for a blank title.
  void values
  return errors
}

export default function TaskForm({ onSave }) {
  const [title, setTitle] = useState('')

  // TODO (Module 4):
  // - Add description, status, priority and dueDate fields (each with a <label htmlFor>)
  // - Validate with validateTask before calling onSave and show the error under the field
  // - Disable the submit button while saving; show server errors with role="alert"
  // - Support editing an existing task (task prop) and a Cancel button

  async function handleSubmit(event) {
    event.preventDefault()
    await onSave({ title })
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>New task</h2>
      <label htmlFor="title">Title</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="actions">
        <button type="submit">Add task</button>
      </div>
    </form>
  )
}
