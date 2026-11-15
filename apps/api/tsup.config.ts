import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/server.ts',
    'src/scripts/import-content.ts',
    'src/scripts/seed.ts',
    'src/scripts/reconcile-payments.ts',
    'src/scripts/purge-analytics.ts',
  ],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: ['@pb/shared'],
})
