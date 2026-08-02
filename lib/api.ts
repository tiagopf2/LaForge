import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ZodError, type ZodTypeAny, type output } from 'zod'
import { authOptions } from '@/lib/auth'

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
