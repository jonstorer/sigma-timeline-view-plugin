import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 3031 },
  // Deployed under /markdown/, not the domain root (see scripts/deploy.sh) —
  // Vite defaults to root-absolute asset paths in the built index.html, which
  // 404s once the app is actually served from a subdirectory (see the gantt
  // plugin's equivalent fix). Only for `build`: the dev server still serves
  // from `/` so the documented localhost URL keeps working unchanged.
  base: command === 'build' ? '/markdown/' : '/',
}))
