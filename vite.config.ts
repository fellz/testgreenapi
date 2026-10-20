/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 127.0.0.1 явно: дашборд-прокси не достучится до ::1, куда резолвится localhost у Node
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5216, strictPort: true },
  preview: { host: '127.0.0.1', port: 5217, strictPort: true },
  test: { include: ['src/**/*.test.ts'] },
})
