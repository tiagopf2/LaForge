import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

/**
 * Everything except the auth endpoints themselves is coach-only. Route
 * handlers re-check the session, so this is defence in depth rather than the
 * only gate.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/members/:path*',
    '/api/assessments/:path*',
    '/api/performance/:path*',
    '/api/sessions/:path*',
    '/api/warmup/:path*',
    '/api/forge-games/:path*',
    '/api/program-generator/:path*',
    '/api/cycles/:path*',
    '/api/exercises/:path*',
    '/api/insights/:path*',
  ],
}
