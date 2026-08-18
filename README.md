# La Forge — Coach Tool

Internal, iPad-first coaching tool for La Forge (Levallois-Perret). Member
assessment, personalised warm-ups, performance tracking, monthly benchmarks and
program generation. Coach-only: members never log in.

Out of scope by design: class booking (Glofox), billing, member-facing app.

## Stack

Next.js 16 (App Router) · React 19 · PostgreSQL + Prisma · NextAuth
(credentials, JWT) · Tailwind + shadcn/ui · Recharts

Requires Node 20.9 or newer.

## Local setup

1. **Create the database.** Open SQL Shell (psql), press Enter through the
   prompts, enter your PostgreSQL password, then:

   ```
   \l
   CREATE DATABASE la_forge_db;
   \q
   ```

2. **Configure the environment.** Copy `.env.example` to `.env` and fill in
   `DATABASE_URL`, `NEXTAUTH_SECRET` and `COACH_PASSWORD`.

3. **Install, migrate, seed, create the login, run:**

```bash
npm install && npm run db:deploy && npm run db:seed && npm run coach && npm run dev
```

The app is at http://localhost:3000. Blank out `COACH_PASSWORD` in `.env` once
`npm run coach` has applied it — it is not needed again until you change it.

The seed is idempotent — it refreshes the exercise library from
`data/exercise_library.csv` and touches nothing else. Safe to re-run any time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Generates the Prisma client, then builds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest, single run — needs the database (see below) |
| `npm run test:watch` | Vitest, watch mode |
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (any environment) |
| `npm run db:seed` | Exercise library import |
| `npm run db:studio` | Prisma Studio |
| `npm run coach` | Create the coach login, or change its password |

Most tests are pure functions, but the login throttle keeps its counters in a
table and its tests run against the real thing rather than a stand-in — the
property they check is that counting survives being shared between processes,
which only the SQL provides. So `npm test` needs `DATABASE_URL` set and
`npm run db:deploy` already run. They use the `LoginAttempt` table only, and
clear it between cases; no other data is touched.

## The coach login

One command handles the account, whether it exists yet or not:

```bash
npm run coach
```

It reads `COACH_EMAIL` and `COACH_PASSWORD` from `.env` — creating the account
the first time, changing the password on later runs, and doing nothing at all if
the password is already the one on file. Blank `COACH_PASSWORD` again afterwards
so it is not left sitting on disk. Passwords are bcrypt-hashed and **never**
stored in the repository.

It refuses a password under 12 characters, and refuses one that matches the
database password in `DATABASE_URL` — sharing those means a single leaked
credential opens both the app and the database.

Sign-in accepts the account's email or its name. Changing the password does not
end sessions already issued, because they are stateless JWTs; rotate
`NEXTAUTH_SECRET` to invalidate every session at once.

Seeding handles reference data only and needs no secrets. `scripts/safe-seed.ts`
refuses to run if the seed file contains any `delete` or `deleteMany` call, so
seeding can never wipe member data.

## Deployment

Netlify, rebuilding from `main` on every push: https://laforgeoctave.netlify.app.
The build settings live in `netlify.toml` rather than in the Netlify UI, so a
deploy cannot silently change shape if Netlify's inference ever guesses
differently.

The hosted database is Neon, in `us-east-2` to match Netlify's default function
region — the app-to-database hop stays inside one datacenter. There are two
branches: production, and a `preview` branch that deploy previews point at. A
Neon branch is a copy-on-write clone, so a freshly created one already holds the
schema and the seeded library and needs no migrate or seed of its own.

Netlify is always given the **pooled** connection string. Migrations are run by
hand against the **direct** one, which is why the datasource in
`prisma/schema.prisma` needs no `directUrl`.

`binaryTargets` in that same file is what makes the deploy work at all: Netlify
builds on Ubuntu but runs functions on Amazon Linux, so naming the Lambda engine
explicitly is the difference between working route handlers and every one of
them failing with "could not locate the Query Engine".

### Environment variables

Set per Netlify deploy context, never site-wide:

| Variable | `production` | `deploy-preview` |
|---|---|---|
| `DATABASE_URL` | production branch, pooled | `preview` branch, pooled |
| `NEXTAUTH_SECRET` | its own value | a different value |
| `NEXTAUTH_URL` | the site URL | unset |
| `AUTH_TRUST_HOST` | unset | `true` |

The database split is the point of the exercise: sharing one `DATABASE_URL`
would let a deploy preview write to real member data, and would let concurrent
deploys race each other against it. Separate secrets mean a leaked preview
session cookie cannot be replayed against production.

`NEXTAUTH_URL` cannot be set for previews, because every pull request gets its
own hostname and a context variable holds one static value. NextAuth derives the
origin from the request only when `AUTH_TRUST_HOST` is set (or when it detects
Vercel), and otherwise falls back to `http://localhost:3000` — so previews need
the flag. Production must *not* have it: trusting an inbound `Host` header on
the real origin is a header-injection vector, and production has an explicit
`NEXTAUTH_URL` anyway.

### Migrations

Deliberately not part of the build, for the reason spelled out in
`netlify.toml`. Run them from a developer machine with `DATABASE_URL` pointed at
the direct string for whichever branch is being migrated:

```bash
npm run db:deploy && npm run db:seed && npm run coach
```

`npm run coach` is only needed when first setting a database up, or to change
the password afterwards.

A preview branch is frozen at the moment it was cloned, so a new migration on
`main` leaves it behind. Recreating the branch from production is usually less
work than migrating it, but its connection string changes, so `DATABASE_URL` on
the `deploy-preview` context has to be updated to match.

## Modules

| Module | Route | Notes |
|---|---|---|
| 1 — Body assessment | `/dashboard/assessment` | 8-step intake. Produces restriction tags + contraindication areas that drive Modules 2 and 6. |
| 2 — Warm-up generator | `/dashboard/warmup` | Fixed Part 1 (coach text) + generated Part 2. Ranks drills by restriction severity, fills a 5-minute budget, excludes contraindicated drills. |
| 3 — Performance tracking | `/dashboard/performance` | Five compounds + three cardio benchmarks only. Flow sessions log with no data entry. |
| 4 — Monthly Forge Games | `/dashboard/forge-games` | Five benchmarks a month, one score per benchmark per month, month-over-month deltas. |
| 5 — Progress dashboard | `/dashboard/members/[id]` | Strengths / areas to improve / recommendations, all derived from stored results. |
| 6A — Exercise library | `/dashboard/library` | Coach-owned CRUD. Seeded from the studio CSV. Archive rather than delete. |
| 6B — Program generator | `/dashboard/generator` | 4-8 week cycles, week-by-week Blocks A/B/C. Always saved as a draft until the coach validates. |

## Progression rules (Module 3 / 6C)

Implemented literally, in `lib/progression.ts` — no estimation, no AI:

- **Week 1, calibration.** 4 sets of 5. Raise the load each set until set 4 sits
  at RPE 7-8. That load is the cycle's reference weight.
- **Following weeks.** 3 sets of 3-5 reps at the reference weight. Add reps
  before weight. Only a clean 3×5 unlocks a load increase (5 kg on squat and
  deadlift, 2.5 kg elsewhere), and the next session restarts at 3×3.
- Cardio benchmarks target 1% off the member's personal best, not their last
  attempt.

## Architecture notes

- `lib/forge.ts` holds the shared vocabulary (tracked movements, benchmarks,
  restriction tags, contraindication areas). Everything else filters against it.
- `lib/api.ts` wraps every route handler with auth, Zod validation and uniform
  error shaping, so routes contain only domain logic.
- Assessment free text ("left knee", "rotator cuff 2021") is normalised into
  canonical contraindication areas, which is what makes drill and exercise
  filtering a plain set intersection.
- The program generator is deterministic. Re-generating the same inputs produces
  the same cycle; week-to-week variety comes from a rotating slice of the
  library, not randomness.

## Known limitations

- Two transitive advisories remain in `npm audit --omit=dev`, both inside
  Next's own dependencies and neither fixable from here: a bundled `postcss`,
  and `sharp` (libvips CVEs). `sharp` backs the Image Optimization API, which
  this app does not use — `images.unoptimized` is set.
- `react-hooks/set-state-in-effect` warns on five dashboard screens. They use
  the fetch-on-mount pattern, which the rule that shipped with ESLint 9 flags.
  Pre-existing rather than a regression; reworking their data loading is its
  own change. See `eslint.config.mjs`.
- Prisma warns that `generator client` has no explicit `output` path, which
  Prisma 7 will require. Unrelated to the app; worth doing with that upgrade.
- Fonts are pulled from Google Fonts at build time. On a machine with TLS
  interception the download fails and Next silently falls back to system fonts;
  self-hosting the three families would remove the build-time network call.
- No offline/PWA support yet. The brief implies it for gym conditions.
- Deploy previews have no `NEXTAUTH_URL`, which has two harmless consequences:
  `metadataBase` in `app/layout.tsx` falls back to `http://localhost:3000`, so
  Open Graph URLs in preview HTML are wrong, and NextAuth derives its
  secure-cookie flag from that variable, so preview session cookies are not
  marked `Secure`. Both are confined to previews and neither affects production.
