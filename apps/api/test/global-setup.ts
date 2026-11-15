import { execSync } from 'node:child_process'

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://pb:pb_local_dev_only@localhost:5432/portfolio_builder_test'
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  })
}
