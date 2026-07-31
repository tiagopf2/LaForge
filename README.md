# La Forge — Coach Tool

Internal, iPad-first coaching tool for La Forge (Levallois-Perret). Member
assessment, personalised warm-ups, performance tracking, monthly benchmarks and
program generation. Coach-only: members never log in.

Out of scope by design: class booking (Glofox), billing, member-facing app.

## Stack

Next.js 14 (App Router) · PostgreSQL + Prisma · NextAuth (credentials, JWT) ·
Tailwind + shadcn/ui · Recharts

## Local setup

1. **Create the database.** Open SQL Shell (psql), press Enter through the
   prompts, enter your PostgreSQL password, then:

   ```
   \l
   CREATE DATABASE la_forge_db;
   \q
   ```

2. **Configure the environment.** Copy `.env.example` to `.env` and fill in
   `DATABASE_URL`, `NEXTAUTH_SECRET` and `SEED_COACH_PASSWORD`.

3. **Install, migrate, seed, run:**

```bash
npm install && npm run db:deploy && npm run db:seed && npm run dev
```

The app is at http://localhost:3000.

The seed is idempotent — it upserts the coach account and refreshes the exercise
library from `data/exercise_library.csv`. Safe to re-run any time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Generates the Prisma client, then builds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:deploy` | Apply pending migrations (any environment) |
| `npm run db:seed` | Coach account + exercise library import |
| `npm run db:studio` | Prisma Studio |

## Coach accounts

The first `npm run db:seed` on an empty database creates the coach login from
`SEED_COACH_EMAIL` / `SEED_COACH_NAME` / `SEED_COACH_PASSWORD` in `.env`.
Passwords are bcrypt-hashed and **never** stored in the repository.

Re-seeding leaves an existing account alone — it only refreshes the exercise
library — so the secret is only needed once. To add a second coach, set the
three variables to the new values and run the seed again.

`scripts/safe-seed.ts` refuses to run if the seed file contains any `delete` or
`deleteMany` call, so seeding can never wipe member data.

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

- **Next.js has open advisories that need a major upgrade.** `next@14.2.35` is
  the newest 14.x. The remaining advisories (mostly cache poisoning and SSRF on
  publicly-exposed deployments) are only fixed in Next 16. Worth scheduling; not
  urgent for a studio-internal deployment on the local network.
- Remaining `npm audit` findings beyond Next are all ESLint dev tooling and
  never ship.
- Fonts are pulled from Google Fonts at build time. On a machine with TLS
  interception the download fails and Next silently falls back to system fonts;
  self-hosting the three families would remove the build-time network call.
- No offline/PWA support yet. The brief implies it for gym conditions.
