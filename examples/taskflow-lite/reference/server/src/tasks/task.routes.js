import { Router } from 'express'
import { HttpError, validate } from '../http.js'
import { createTaskSchema, idSchema, listQuerySchema, updateTaskSchema } from './task.schema.js'
import { createTask, deleteTask, getTask, listTasks, updateTask } from './task.service.js'

export const taskRouter = Router()

taskRouter.get('/', async (req, res) => {
  const query = validate(listQuerySchema, req.query)
  res.json({ data: await listTasks(query) })
})

taskRouter.get('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id)
  const task = await getTask(id)
  if (!task) throw new HttpError(404, 'Task not found')
  res.json({ data: task })
})

taskRouter.post('/', async (req, res) => {
  const input = validate(createTaskSchema, req.body)
  res.status(201).json({ data: await createTask(input) })
})

taskRouter.patch('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id)
  const input = validate(updateTaskSchema, req.body)
  const task = await updateTask(id, input)
  if (!task) throw new HttpError(404, 'Task not found')
  res.json({ data: task })
})

taskRouter.delete('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id)
  const deleted = await deleteTask(id)
  if (!deleted) throw new HttpError(404, 'Task not found')
  res.status(204).end()
})
