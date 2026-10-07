import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_PORT = 5173
const DEFAULT_BACKEND_PORT = 8000
const backendPortFile = path.resolve(__dirname, '../backend/.server-port')

function getBackendPort() {
  const configuredPort = Number(process.env.VITE_BACKEND_PORT)
  if (Number.isInteger(configuredPort) && configuredPort > 0) return configuredPort

  try {
    const savedPort = Number(fs.readFileSync(backendPortFile, 'utf8').trim())
    return Number.isInteger(savedPort) && savedPort > 0 ? savedPort : DEFAULT_BACKEND_PORT
  } catch {
    return DEFAULT_BACKEND_PORT
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: DEFAULT_PORT,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${getBackendPort()}`,
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
