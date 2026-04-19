import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Tell Vite the frontend folder is its root
  root: resolve(__dirname, ''),
  
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:            resolve(__dirname, 'index.html'),
      }
    }
  },

  server: {
    port: 5173,
    // Proxy API calls to the backend so fetch('/api/...') works
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // backend port is 3001
        changeOrigin: true
      },
      '/data': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
