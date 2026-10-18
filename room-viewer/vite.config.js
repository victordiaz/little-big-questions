import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The info panel imports ../README.md and ../docs/images from the repo root.
    fs: { allow: ['..'] },
  },
})
