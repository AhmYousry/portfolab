// eslint-disable-next-line no-unused-vars
import { prisma } from '../db.js'

// TODO (Module 3, lesson "crud"): implement each function with Prisma.
// Return plain objects where dueDate is "YYYY-MM-DD" or null (see toResponse).

export function toResponse(task) {
  return {
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
  }
}

// eslint-disable-next-line no-unused-vars
export async function listTasks({ status, priority, search, sort }) {
  // TODO: where (status, priority, title contains search — case-insensitive), orderBy (sort)
  throw new Error('listTasks not implemented yet')
}

// eslint-disable-next-line no-unused-vars
export async function getTask(id) {
  // TODO: return the task or null
  throw new Error('getTask not implemented yet')
}

// eslint-disable-next-line no-unused-vars
export async function createTask(input) {
  // TODO: convert dueDate string to Date before saving
  throw new Error('createTask not implemented yet')
}

// eslint-disable-next-line no-unused-vars
export async function updateTask(id, input) {
  // TODO: return null when the task does not exist
  throw new Error('updateTask not implemented yet')
}

// eslint-disable-next-line no-unused-vars
export async function deleteTask(id) {
  // TODO: return true if something was deleted, false otherwise
  throw new Error('deleteTask not implemented yet')
}
