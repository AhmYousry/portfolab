export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function validate(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
    throw new HttpError(400, 'Validation failed', details)
  }
  return result.data
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Route not found' } })
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } })
  }
  console.error('[taskflow] unexpected error:', err.message)
  res.status(500).json({ error: { message: 'Something went wrong' } })
}
