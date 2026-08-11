import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Creates the coach login, or changes its password if it already exists.
 *
 * One command for both cases on purpose. When creating and rotating were
 * separate scripts, the seed silently skipped an existing account and there was
 * no obvious way to change the password afterwards — so the day-one password
 * tended to stay forever. Re-running this is always safe.
 *
 * Credentials come from the environment, never from an argument: argv is
 * visible to other processes and lands in shell history.
 */

/** Long enough that the login throttle is the slow part, not the password. */
const MIN_LENGTH = 12

const email = process.env.COACH_EMAIL
const password = process.env.COACH_PASSWORD

function abort(reason: string): never {
  console.error(`Coach account unchanged: ${reason}`)
  process.exit(1)
}

/**
 * The password from DATABASE_URL, so the login cannot be set to the same
 * string. Sharing it means one leaked credential opens both the app and the
 * database directly.
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
  if (!email || !password) {
    abort(
      'set COACH_EMAIL and COACH_PASSWORD in .env, run `npm run coach`, then\n' +
        '  remove COACH_PASSWORD again so it is not left sitting on disk.'
    )
  }

  if (password.length < MIN_LENGTH) {
    abort(`COACH_PASSWORD must be at least ${MIN_LENGTH} characters.`)
  }

  if (password === databasePassword()) {
    abort('COACH_PASSWORD is the same as the database password in DATABASE_URL.')
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  // Idempotent: re-running with the password already in force is a no-op
  // rather than an error, so this is safe to put in a setup script.
  if (existing && (await bcrypt.compare(password, existing.hashedPassword))) {
    console.log(`Coach account ${email} already has this password — nothing to do.`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { hashedPassword } })
    console.log(`Password changed for ${email}.`)
    console.log('Sessions already issued stay valid until they expire — sign out to end one now.')
  } else {
    await prisma.user.create({ data: { email, hashedPassword, role: 'coach' } })
    console.log(`Coach account created: ${email}`)
  }

  console.log('Remove COACH_PASSWORD from .env now that it is applied.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
