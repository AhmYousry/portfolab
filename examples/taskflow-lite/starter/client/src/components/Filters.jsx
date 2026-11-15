export default function Filters({ value, onChange }) {
  function update(field) {
    return (event) => onChange({ ...value, [field]: event.target.value })
  }

  return (
    <section className="card filters" aria-label="Filters">
      <div>
        <label htmlFor="search">Search</label>
        <input
          id="search"
          type="search"
          value={value.search}
          onChange={update('search')}
          placeholder="Search by title"
        />
      </div>
      <div>
        <label htmlFor="filter-status">Status</label>
        <select id="filter-status" value={value.status} onChange={update('status')}>
          <option value="">All</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-priority">Priority</label>
        <select id="filter-priority" value={value.priority} onChange={update('priority')}>
          <option value="">All</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <div>
        <label htmlFor="sort">Sort</label>
        <select id="sort" value={value.sort} onChange={update('sort')}>
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="dueDate">Due date (soonest)</option>
          <option value="-dueDate">Due date (latest)</option>
        </select>
      </div>
    </section>
  )
}
