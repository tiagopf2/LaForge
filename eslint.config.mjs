import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/**
 * ESLint 9 flat config, replacing .eslintrc.json.
 *
 * Next 16 removed `next lint`, so `npm run lint` calls the ESLint CLI directly
 * and ignore paths live here rather than coming from the Next wrapper.
 */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'prisma/migrations/**',
      // Gitignored leftover clone of this repository. `next lint` never looked
      // at it; the ESLint CLI walks the whole tree, so it has to be excluded
      // explicitly or its stale copies get linted alongside the real files.
      'LaForge/**',
      // Same problem, different source: Claude Code checks worktrees out here,
      // and each is a full copy of the project. Linting them reports hundreds
      // of duplicate problems against files that are not the ones being
      // edited. vitest.config.mts excludes this path for the same reason.
      '.claude/worktrees/**',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      '@next/next/no-img-element': 'off',

      // Surfaced by eslint-plugin-react-hooks v6, which arrived with the Next 16
      // upgrade. It flags the fetch-on-mount pattern in the five dashboard
      // screens — pre-existing code, not a regression from the upgrade, and
      // reworking their data loading is its own change with its own testing.
      // Kept visible as a warning rather than silenced or left blocking CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default config
