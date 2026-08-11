import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Rotates an existing coach password.
 *
 * `scripts/seed.ts` only ever *creates* the account — it deliberately leaves an
 * existing one alone so re-seeding to refresh the exercise library cannot
 * disturb the login. That left no supported way to change the password after
 * the fact, which is this script.
 *
 * The new password comes from the environment, never from an argument: argv is
 * visible to every other process on the machine and lands in shell history.
 */

/** Same floor the seed enforces, so the two cannot drift apart. */
const MIN_LENGTH = 12

const newPassword = process.env.NEW_COACH_PASSWORD
/** Which account to rotate. Optional when the database holds exactly one user. */
const targetEmail = process.env.COACH_EMAIL ?? process.env.SEED_COACH_EMAIL

function abort(reason: string): never {
  console.error(`Password not changed: ${reason}`)
  process.exit(1)
}

/**
 * The password from DATABASE_URL, so the coach login cannot be set to the same
 * string. Reusing it means one leaked credential opens both the app and the
 * database directly, which is the specific mistake this script exists to undo.
 */
function databasePassword(): string | null {
  try {
    const parsed = new URL(process.env.DATABASE_URL ?? '')
    return parsed.password ? decodeURIComponent(parsed.password) : null
  } catch {
    return null
  }
}

async function main() {
  if (!newPassword) {
    abort(
      'NEW_COACH_PASSWORD is not set.\n' +
        '  Add it to .env, run `npm run coach:set-password`, then delete the line again.'
    )
  }

  if (newPassword.length < MIN_LENGTH) {
    abort(`NEW_COACH_PASSWORD must be at least ${MIN_LENGTH} characters.`)
  }

  if (newPassword === databasePassword()) {
    abort(
      'NEW_COACH_PASSWORD is the same as the database password in DATABASE_URL.\n' +
        '  Use a different one — sharing it means a single leak opens both.'
    )
  }

  const user = targetEmail
    ? await prisma.user.findUnique({ where: { email: targetEmail } })
    : await (async () => {
        const all = await prisma.user.findMany()
        if (all.length === 1) return all[0]
        if (all.length === 0) abort('there are no accounts yet — run `npm run db:seed` first.')
        abort(
          `there are ${all.length} accounts. Set COACH_EMAIL to say which one to rotate.`
        )
      })()

  if (!user) abort(`no account found for ${targetEmail}.`)

  // A rotation that quietly re-sets the same password looks like it worked and
  // leaves the old credential valid, so refuse it outright.
  if (await bcrypt.compare(newPassword, user.hashedPassword)) {
    abort('that is already the current password — nothing was rotated.')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { hashedPassword: await bcrypt.hash(newPassword, 12) },
  })

  console.log(`Password rotated for ${user.name ?? user.email}.`)
  console.log('Any existing session stays valid until it expires — sign out to end it now.')
  console.log('Remove NEW_COACH_PASSWORD from .env before you forget it is there.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
