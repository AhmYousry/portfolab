import { useCallback, useEffect, useState } from 'react'
import { createTask, deleteTask, fetchTasks, updateTask } from './api.js'
import Filters from './components/Filters.jsx'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'

const INITIAL_FILTERS = { search: '', status: '', priority: '', sort: '-createdAt' }
const SEARCH_DEBOUNCE_MS = 250

export default function App() {
  const [tasks, setTasks] = useState([])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(async (activeFilters) => {
    setStatus('loading')
    try {
      setTasks(await fetchTasks(activeFilters))
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(filters), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filters, load])

  async function handleSave(input) {
    if (editing) {
      await updateTask(editing.id, input)
      setEditing(null)
    } else {
      await createTask(input)
    }
    await load(filters)
  }

  async function handleToggle(task) {
    await updateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })
    await load(filters)
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    await deleteTask(task.id)
    await load(filters)
  }

  return (
    <main className="container">
      <header>
        <h1>TaskFlow Lite</h1>
        <p className="muted">A small full-stack task manager: React + Express + PostgreSQL.</p>
      </header>

      <TaskForm
        key={editing?.id ?? 'new'}
        task={editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
      <Filters value={filters} onChange={setFilters} />

      {status === 'loading' && <p role="status">Loading tasks…</p>}
      {status === 'error' && (
        <div role="alert" className="alert">
          <p>Could not load tasks: {error}</p>
          <button onClick={() => load(filters)}>Try again</button>
        </div>
      )}
      {status === 'ready' && (
        <TaskList
          tasks={tasks}
          onEdit={setEditing}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}
    </main>
  )
}
