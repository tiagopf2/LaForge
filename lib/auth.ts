import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  clientKey,
  recordFailedLogin,
} from '@/lib/rate-limit'

/**
 * bcrypt hash of a random string that is not any account's password.
 *
 * Compared against when the username does not exist, so a wrong username and a
 * wrong password cost the same time. Without it an unknown username returns in
 * microseconds while a known one pays for a cost-12 hash, which is a clear
 * enough signal to enumerate the coach account name.
 */
const DUMMY_HASH = '$2a$12$iOaayY/BBgIY20VKh7y6d.vtqkVlkMJfAkkPOkPC39UViajGJSVcS'

// No Prisma adapter: this app uses stateless JWT sessions with a credentials
// provider, and the schema intentionally has no Account/Session tables.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null

        // Throttled by source address: this is the one unauthenticated endpoint
        // in the app, guarding a single well-known coach account.
        const key = clientKey(req?.headers as Record<string, unknown> | undefined)

        // The throttle reads the database, so its call sits inside the same
        // try as the user lookup: if the database is unreachable this returns
        // null like any other failed sign-in, rather than surfacing an error.
        // Failing closed costs nothing here, because a login cannot succeed
        // without the database anyway.
        try {
          const limit = await checkLoginRateLimit(key)
          if (!limit.allowed) {
            console.warn(
              `Login throttled for ${key}: too many failed attempts, ${limit.retryAfterSeconds}s remaining.`
            )
            return null
          }

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { name: credentials.username },
                { email: credentials.username },
              ],
            },
          })

          // Always hash, even with no matching user, to keep the timing flat.
          const isValid = await bcrypt.compare(
            credentials.password,
            user?.hashedPassword ?? DUMMY_HASH
          )

          if (!user || !isValid) {
            await recordFailedLogin(key)
            return null
          }

          // Best-effort, deliberately outside the throw path: the password was
          // correct, so a failure to tidy up the counters must not turn a valid
          // sign-in into a rejected one. The stale bucket expires on its own.
          await clearLoginAttempts(key).catch(() => {})

          return { id: user.id, email: user.email, name: user.name, role: user.role }
        } catch {
          return null
        }
      },
    }),
  ],
  // Coaching sessions run on a shared studio iPad: keep the login alive for a
  // working day, then force a fresh sign-in.
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user?.role
        token.id = user?.id
      }
      return token
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).role = token?.role
        ;(session.user as any).id = token?.id
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}