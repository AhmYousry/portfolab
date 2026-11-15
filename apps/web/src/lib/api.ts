import type { ApiEnvelope, ApiError } from '@pb/shared'

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

const NETWORK_ERROR = 'مش قادرين نوصل للسيرفر. اتأكد من الإنترنت وجرب تاني.'
const CSRF_CODE = 'FORBIDDEN'

let csrfToken: string | null = null

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
  const body = (await res.json()) as ApiEnvelope<{ csrfToken: string }>
  csrfToken = body.data?.csrfToken ?? ''
  return csrfToken
}

async function send<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    headers['X-CSRF-Token'] = csrfToken ?? (await fetchCsrf())
  }

  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError(0, 'NETWORK', NETWORK_ERROR)
  }

  const envelope = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok) {
    const error: ApiError = envelope?.error ?? { code: 'UNKNOWN', message: 'حصلت مشكلة غير متوقعة' }
    if (
      res.status === 403 &&
      error.code === CSRF_CODE &&
      method !== 'GET' &&
      !retried &&
      error.message.includes('CSRF')
    ) {
      await fetchCsrf()
      return send<T>(method, path, body, true)
    }
    throw new ApiRequestError(res.status, error.code, error.message, error.details)
  }
  return envelope?.data as T
}

export const api = {
  get: <T>(path: string) => send<T>('GET', path),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => send<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => send<T>('PATCH', path, body ?? {}),
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError) || !Array.isArray(error.details)) return {}
  const out: Record<string, string> = {}
  for (const d of error.details as { path?: string; message?: string }[]) {
    if (d.path && d.message && !out[d.path]) out[d.path] = d.message
  }
  return out
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message
  return 'حصلت مشكلة غير متوقعة'
}
