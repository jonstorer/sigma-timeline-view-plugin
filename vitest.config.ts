import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts because vitest ships its own bundled
// copy of vite, and mixing the two type sets in one file produces a Plugin
// type mismatch on `@vitejs/plugin-react`. Vitest's built-in transformer
// handles JSX without that plugin.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Pinned to a negative UTC offset so week-snapping's date-boundary math
    // (src/weekSpan.ts) is actually exercised: on a UTC CI runner, the
    // UTC-midnight-renders-as-previous-local-day bug this module fixes can't
    // reproduce at all.
    env: { TZ: 'America/Los_Angeles' },
  },
})
