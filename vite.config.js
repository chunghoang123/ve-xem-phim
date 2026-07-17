import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['puma-postwar-absently.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
