import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: Vite serves the SPA and proxies API calls to the running ValencePack backend.
// Build: outputs to dist/; at swap time dist/* is copied into the fork's public/ so
// the existing server.js serves it unchanged (no backend edits required).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  build: {
    outDir: 'dist',
  },
})
