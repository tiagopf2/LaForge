import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ZodError, z, type ZodTypeAny, type output } from 'zod'
import { authOptions } from '@/lib/auth'

/**
 * Restores readable validation messages for the coach.
 *
 * Zod 4 rewrote its default messages for developers rather than end users:
 * a missing field became "Invalid input: expected string, received undefined"
 * instead of "Required", and a bad enum stopped reporting the value that was
 * actually sent -- the most useful half of that message when a request is
 * being debugged. `toResponse` below puts these straight in front of the coach
 * as `field: message`, so the wording is user-facing text, not a developer
 * detail.
 *
 * Only Zod's own defaults are replaced. A message written into a schema always
 * wins over this map, so 'Enter a valid email' and 'must look like 2026-07' in
 * lib/validation.ts are untouched. Returning undefined for anything not handled
 * here falls back to Zod's default rather than inventing a worse one.
 *
 * This is global configuration, and it lives here because `route()` below is
 * the only place in the app that parses anything -- so the config is always in
 * effect wherever a schema is actually used.
 */
const quote = (v: unknown) => (typeof v === 'string' ? `'${v}'` : String(v))

z.config({
  customError: (issue) => {
    const input = (issue as { input?: unknown }).input

    switch (issue.code) {
      case 'invalid_type':
        // Zod reports a missing key and a wrong-typed value with the same code.
        // Undefined input is the missing one, and "Required" is what a coach
        // looking at a form needs to read.
        return input === undefined
          ? 'Required'
          : `Expected ${(issue as { expected?: string }).expected}, received ${typeof input}`

      case 'invalid_value': {
        const values = (issue as { values?: readonly unknown[] }).values
        if (!values?.length) return undefined
        return `Expected ${values.map(quote).join(' | ')}, received ${quote(input)}`
      }

      case 'too_small': {
        const { minimum, origin } = issue as { minimum?: number; origin?: string }
        return origin === 'string'
          ? `Must be at least ${minimum} characters`
          : `Must be at least ${minimum}`
      }

      case 'too_big': {
        const { maximum, origin } = issue as { maximum?: number; origin?: string }
        return origin === 'string'
          ? `Must be at most ${maximum} characters`
          : `Must be at most ${maximum}`
      }

      default:
        return undefined
    }
  },
})

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export const badRequest = (message: string) => new ApiError(400, message)
export const notFound = (message: string) => new ApiError(404, message)

/**
 * Every route in this app is coach-only. `proxy.ts` already blocks
 * unauthenticated requests, but route handlers re-check so the API stays safe
 * if the matcher is ever edited.
 */
async function requireCoach() {
  const session = await getServerSession(authOptions)
  if (!session?.user) throw new ApiError(401, 'Unauthorized')

  // The role is copied from the database row into the JWT at sign-in, so a
  // session can only carry `coach` if the account had it. Checking it here
  // means adding a non-coach account later cannot silently grant full member
  // access — the routes would have to opt that role in deliberately.
  if ((session.user as { role?: string }).role !== 'coach') {
    throw new ApiError(403, 'Forbidden')
  }

  return session
}

type Handler<S extends ZodTypeAny> = (ctx: {
  input: output<S>
  request: Request
}) => Promise<unknown>

/**
 * Wraps a route handler with auth, body/query validation and uniform error
 * shaping, so individual routes only contain domain logic.
 *
 * The handler receives the schema's *output* type, so coercions and defaults
 * (`z.coerce.number()`, `.default(6)`) are already applied.
 */
export function route<S extends ZodTypeAny>(schema: S, handler: Handler<S>) {
  // Next 15 made the dynamic segment a promise. Every route in the app goes
  // through this wrapper, so awaiting it here is the only change needed.
  return async (request: Request, segment?: { params?: Promise<Record<string, string>> }) => {
    try {
      await requireCoach()

      const raw =
        request.method === 'GET' || request.method === 'DELETE'
          ? Object.fromEntries(new URL(request.url).searchParams)
          : await request.json().catch(() => {
              throw badRequest('Request body must be valid JSON')
            })

      const params = (await segment?.params) ?? {}
      const input = schema.parse({ ...raw, ...params })
      const data = await handler({ input, request })
      return NextResponse.json(data ?? { ok: true })
    } catch (error) {
      return toResponse(error)
    }
  }
}

function toResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof ZodError) {
    const first = error.issues[0]
    const field = first?.path.join('.')
    return NextResponse.json(
      { error: field ? `${field}: ${first.message}` : (first?.message ?? 'Invalid input') },
      { status: 400 }
    )
  }

  // Prisma surfaces a unique-constraint violation as P2002.
  if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
    return NextResponse.json({ error: 'That record already exists' }, { status: 409 })
  }

  console.error('Unhandled API error:', error)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}
