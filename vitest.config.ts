import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

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
      '@': resolve(__dirname, './'),
    },
  },
})
