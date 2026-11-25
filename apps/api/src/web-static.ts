import fs from 'node:fs'
import path from 'node:path'
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'

const HASHED_ASSET_PREFIX = '/assets/'
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
const REVALIDATE_CACHE = 'no-cache'

export class WebDistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebDistError'
  }
}

export function isApiPath(urlPath: string): boolean {
  return urlPath === '/api' || urlPath.startsWith('/api/')
}

function hasDotSegment(urlPath: string): boolean {
  return urlPath.split('/').some((segment) => segment.startsWith('.'))
}

export interface WebHandlers {
  assets: RequestHandler
  spaFallback: RequestHandler
}

// Serves only the built Vite output. Dotfiles are never served, /api is never touched, and the
// HTML fallback answers GET/HEAD navigations without a file extension.
export function webHandlers(distDir: string): WebHandlers {
  const root = path.resolve(distDir)
  const indexFile = path.join(root, 'index.html')
  if (!fs.existsSync(indexFile) || !fs.statSync(indexFile).isFile()) {
    throw new WebDistError(`WEB_DIST_DIR has no index.html (${root}). Build the web app first.`)
  }

  const serve = express.static(root, {
    dotfiles: 'ignore',
    index: false,
    redirect: false,
    fallthrough: true,
    setHeaders: (res, filePath) => {
      const rel = `/${path.relative(root, filePath).split(path.sep).join('/')}`
      res.setHeader(
        'Cache-Control',
        rel.startsWith(HASHED_ASSET_PREFIX) ? IMMUTABLE_CACHE : REVALIDATE_CACHE,
      )
    },
  })

  const assets: RequestHandler = (req, res, next) => {
    if (isApiPath(req.path) || hasDotSegment(req.path)) return next()
    serve(req, res, next)
  }

  const spaFallback = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (isApiPath(req.path) || hasDotSegment(req.path) || path.extname(req.path)) return next()
    if (!req.accepts('html')) return next()
    res.setHeader('Cache-Control', REVALIDATE_CACHE)
    res.sendFile(indexFile, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) next(err)
    })
  }

  return { assets, spaFallback }
}
