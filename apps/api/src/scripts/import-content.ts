import { prisma } from '../db.js'
import { env } from '../env.js'
import { importContent } from '../services/content-import.js'

const syncStatus = process.argv.includes('--sync-status')

try {
  const report = await importContent({ contentDir: env.contentDir, syncStatus })
  console.info(`[content] imported ${JSON.stringify(report)} (syncStatus=${syncStatus})`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
