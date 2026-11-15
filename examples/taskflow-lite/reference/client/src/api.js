const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message ?? 'Request failed', body?.error?.details)
  }
  return body.data
}

export function fetchTasks(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  return request(`/api/tasks?${params}`)
}

export const createTask = (input) =>
  request('/api/tasks', { method: 'POST', body: JSON.stringify(input) })

export const updateTask = (id, input) =>
  request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })

export const deleteTask = (id) =>
  request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
