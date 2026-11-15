import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_URL = process.env.VITE_API_PROXY ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': API_URL },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
})
