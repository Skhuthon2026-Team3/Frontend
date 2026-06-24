import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'https://api.i1000u.store'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to the backend to avoid CORS during local dev.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
