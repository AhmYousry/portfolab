// eslint-disable-next-line no-unused-vars
export default function TaskList({ tasks, onEdit, onToggle, onDelete }) {
  // TODO (Module 4):
  // - Empty state when there are no tasks (role="status")
  // - One <li> per task: checkbox to toggle done (with aria-label), title, description,
  //   priority badge, status, due date, Edit and Delete buttons
  if (tasks.length === 0) return <p className="empty">TODO: empty state</p>
  return <ul className="task-list">{/* TODO */}</ul>
}
