import { describe, expect, it } from 'vitest'
// Importing the API layer installs the Zod error map that shapes these
// messages. It is the only place the app parses anything, so this is also how
// the messages get configured in a real request.
import '@/lib/api'
import {
  createExerciseSchema,
  createMemberSchema,
  forgeGamesQuerySchema,
  memberIdSchema,
} from '@/lib/validation'
import type { ZodTypeAny } from 'zod'

const firstMessage = (schema: ZodTypeAny, input: unknown, field: string) => {
  const result = schema.safeParse(input)
  if (result.success) throw new Error('expected a validation failure')
  return result.error.issues.find((i) => i.path.join('.') === field)?.message
}

describe('validation messages shown to the coach', () => {
  it('says a missing field is required, not "expected string, received undefined"', () => {
    expect(firstMessage(memberIdSchema, {}, 'id')).toBe('Required')
  })

  it('names the value that was actually sent for a bad option', () => {
    const message = firstMessage(
      createExerciseSchema,
      { name: 'Squat', category: 'strength', movementPattern: 'squat' },
      'category'
    )
    // The received value is the half Zod 4 dropped, and the half that says
    // what to fix.
    expect(message).toContain("received 'strength'")
    expect(message).toContain("'compound'")
  })

  it('states a numeric bound plainly', () => {
    expect(firstMessage(forgeGamesQuerySchema, { memberId: 'm1', months: 99 }, 'months')).toBe(
      'Must be at most 24'
    )
  })

  it('leaves messages written into the schema alone', () => {
    expect(
      firstMessage(createMemberSchema, { firstName: 'A', lastName: 'B', email: 'nope' }, 'email')
    ).toBe('Enter a valid email')
    expect(firstMessage(createExerciseSchema, { name: 'S' }, 'name')).toBe('Name is required')
  })
})
