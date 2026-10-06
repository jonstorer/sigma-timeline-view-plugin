import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
//import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    //basicSsl()
  ],
  server: { port: 3030 },
  // Deployed under /gantt/, not the domain root (see scripts/deploy.sh) — Vite
  // defaults to root-absolute asset paths in the built index.html, which 404s
  // once the app is actually served from a subdirectory. Only for `build`:
  // the dev server still serves from `/` so the documented localhost:3030 URL
  // keeps working unchanged.
  base: command === 'build' ? '/gantt/' : '/',
}))
