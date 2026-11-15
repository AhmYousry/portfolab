import { prisma } from '../db.js'

function toDate(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(`${value}T00:00:00.000Z`)
}

function orderBy(sort) {
  const direction = sort.startsWith('-') ? 'desc' : 'asc'
  const field = sort.replace('-', '')
  if (field === 'dueDate')
    return [{ dueDate: { sort: direction, nulls: 'last' } }, { createdAt: 'desc' }]
  return [{ createdAt: direction }]
}

export function toResponse(task) {
  return {
    ...task,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
  }
}

export async function listTasks({ status, priority, search, sort }) {
  const tasks = await prisma.task.findMany({
    where: {
      status,
      priority,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: orderBy(sort),
  })
  return tasks.map(toResponse)
}

export async function getTask(id) {
  const task = await prisma.task.findUnique({ where: { id } })
  return task ? toResponse(task) : null
}

export async function createTask(input) {
  const task = await prisma.task.create({ data: { ...input, dueDate: toDate(input.dueDate) } })
  return toResponse(task)
}

export async function updateTask(id, input) {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) return null
  const task = await prisma.task.update({
    where: { id },
    data: { ...input, dueDate: toDate(input.dueDate) },
  })
  return toResponse(task)
}

export async function deleteTask(id) {
  const result = await prisma.task.deleteMany({ where: { id } })
  return result.count > 0
}
