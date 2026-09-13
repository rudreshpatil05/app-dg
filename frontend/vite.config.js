import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_PORT = 5173

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: DEFAULT_PORT,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: DEFAULT_PORT,
    strictPort: false,
  },
  ...(command === 'build' ? {} : {})
}))
