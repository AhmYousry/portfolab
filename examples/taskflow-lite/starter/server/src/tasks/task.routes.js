import { Router } from 'express'
import { HttpError } from '../http.js'

export const taskRouter = Router()

// TODO (Module 3, lesson "crud"): implement the five endpoints from your API contract.
// - Validate input with validate(schema, value) from ../http.js
// - 201 for create, 204 for delete, 404 when the task does not exist
// - Never send raw database errors to the client (the error handler in http.js does this for you)

taskRouter.all('/{*splat}', () => {
  throw new HttpError(501, 'Not implemented yet — this is your job in Module 3')
})
