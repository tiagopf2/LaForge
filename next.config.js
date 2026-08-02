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
