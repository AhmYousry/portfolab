// eslint-disable-next-line no-unused-vars
import { useCallback, useEffect, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { createTask, deleteTask, fetchTasks, updateTask } from './api.js'
import Filters from './components/Filters.jsx'
import TaskForm from './components/TaskForm.jsx'
import TaskList from './components/TaskList.jsx'

const INITIAL_FILTERS = { search: '', status: '', priority: '', sort: '-createdAt' }

export default function App() {
  const [tasks] = useState([])
  const [filters, setFilters] = useState(INITIAL_FILTERS)

  // TODO (Module 4/5):
  // 1. Keep a request status: 'loading' | 'ready' | 'error'
  // 2. Load tasks from the API when filters change (debounce search a little)
  // 3. Implement handleSave / handleToggle / handleDelete, then reload
  // 4. Render loading, error (with "Try again") and ready states

  async function handleSave(input) {
    console.log('TODO save', input)
  }

  return (
    <main className="container">
      <header>
        <h1>TaskFlow Lite</h1>
        <p className="muted">Starter — follow the lessons to make this work.</p>
      </header>
      <TaskForm onSave={handleSave} />
      <Filters value={filters} onChange={setFilters} />
      <TaskList tasks={tasks} onEdit={() => {}} onToggle={() => {}} onDelete={() => {}} />
    </main>
  )
}
