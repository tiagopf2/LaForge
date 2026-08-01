import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        try {
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { name: credentials.username },
                { email: credentials.username },
              ],
            },
          })
          if (!user) return null
          const isValid = await bcrypt.compare(credentials.password, user.hashedPassword)
          if (!isValid) return null
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