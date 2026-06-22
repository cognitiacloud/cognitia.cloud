/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // The workspace packages (consumed server-only by the GTM routes' adapters)
  // ship TypeScript source rather than built JS, so Next must transpile them for
  // a production `next build` to succeed. `@cognitia/agents` re-exports its
  // siblings, so all four are listed.
  transpilePackages: [
    '@cognitia/agents',
    '@cognitia/core',
    '@cognitia/db',
    '@cognitia/integrations',
  ],
  // `pg` (pulled in transitively via the agents barrel → @cognitia/db) is a real
  // Node package with native bindings; keep it external so webpack does not try
  // to bundle it. The GTM lanes themselves never touch it at runtime (mock-only).
  serverExternalPackages: ['pg'],
  webpack: (config) => {
    // Those packages use TS "Bundler" resolution: imports carry `.js`
    // specifiers that actually point at `.ts`/`.tsx` source. Teach webpack to
    // resolve them the same way `tsc` and vitest already do.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};
export default nextConfig;
