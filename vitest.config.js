import { defineConfig } from 'vitest/config'

// happy-dom because some checkers (HTML, JSON) rely on browser globals
// (DOMParser, btoa, etc.). jsdom would also work but happy-dom is faster.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals:     true,
    include:     ['tests/**/*.test.js'],
    exclude:     ['node_modules/**', 'dist/**'],
  },
})
