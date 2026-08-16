const isDev = process.env.NODE_ENV !== 'production'

/**
 * Content-Security-Policy.
 *
 * `script-src` still needs `'unsafe-inline'`: the App Router inlines its
 * hydration and Flight payloads as <script> tags with no nonce unless one is
 * stamped per request in `proxy.ts`. Even so the policy is worth having — it
 * blocks loading script from any other origin and stops an injected payload
 * from exfiltrating member data via `connect-src`/`img-src`/`form-action`.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // React Refresh compiles with eval, so dev needs the extra allowance.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Tailwind is compiled ahead of time, but framer-motion and recharts write
  // inline style attributes at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // next/font self-hosts at build time, so no external font origin is needed.
  "font-src 'self' data:",
  // The dashboard only ever talks to its own routes. `ws:` is the dev HMR socket.
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The gitignored LaForge/ clone carries its own lockfile, so Next cannot infer
  // which directory is the workspace root. Pin it to this one.
  turbopack: { root: __dirname },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // No `eslint` key: Next 16 removed `next lint` and no longer runs ESLint
  // during the build, so the setting is rejected as unrecognised. Lint is
  // enforced by its own CI step (`npm run lint`) instead.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // Member health data is internal-only: keep it out of caches, search
        // engines and cross-origin embeds.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          // Nothing in the app uses these, so deny them outright rather than
          // leaving them available to injected script.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          // Ignored by browsers over plain HTTP, so it is inert in local dev and
          // takes effect once the studio serves the app over TLS.
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]),
        ],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ]
  },
}

module.exports = nextConfig
