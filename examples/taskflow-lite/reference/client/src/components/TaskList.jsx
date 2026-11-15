const STATUS_LABELS = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' }

export default function TaskList({ tasks, onEdit, onToggle, onDelete }) {
  if (tasks.length === 0) {
    return (
      <p className="empty" role="status">
        No tasks yet. Add your first one above, or clear the filters.
      </p>
    )
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className={`card task ${task.status === 'DONE' ? 'done' : ''}`}>
          <div className="task-main">
            <input
              type="checkbox"
              checked={task.status === 'DONE'}
              onChange={() => onToggle(task)}
              aria-label={`Mark "${task.title}" as ${task.status === 'DONE' ? 'not done' : 'done'}`}
            />
            <div>
              <h3>{task.title}</h3>
              {task.description && <p className="muted">{task.description}</p>}
              <p className="meta">
                <span className={`badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
                <span>{STATUS_LABELS[task.status]}</span>
                {task.dueDate && <span>Due {task.dueDate}</span>}
              </p>
            </div>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => onEdit(task)}>
              Edit
            </button>
            <button className="danger" onClick={() => onDelete(task)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
