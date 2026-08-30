import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// `.mts` is loaded as ESM, where `__dirname` does not exist. `import.meta.dirname`
// would read better but is not typed by the @types/node this project pins, so
// derive it from the module URL instead — that works on every Node version.
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // Claude Code checks worktrees out *inside* the repo, at
    // .claude/worktrees/<name>, and each one is a full copy of the project --
    // tests included. Without this they match `include` and the suite runs
    // twice. That is not merely slow: the rate-limit tests keep their counters
    // in the LoginAttempt table and clear it between cases, so two copies
    // running at once delete each other's rows and both report failures that
    // have nothing to do with the code under test. `exclude` replaces the
    // defaults rather than extending them, hence the spread -- dropping it
    // would put node_modules back in scope.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
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
