import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// `.mts` is loaded as ESM, where `__dirname` does not exist. `import.meta.dirname`
// would read better but is not typed by the @types/node this project pins, so
// derive it from the module URL instead — that works on every Node version.
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // The rate-limit tests talk to PostgreSQL and read DATABASE_URL from
    // process.env. Vite only exposes VITE_-prefixed variables to import.meta,
    // so .env has to be loaded explicitly, in each worker. dotenv leaves
    // variables that are already set alone, so CI — which sets DATABASE_URL
    // directly and ships no .env — is unaffected.
    setupFiles: ['dotenv/config'],
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
})
