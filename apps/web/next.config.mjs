/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // The GTM proof routes (`/gtm-command-center`, `/gtm-os-integrated-demo`) import
  // the real `@cognitia/*` workspace packages, whose TypeScript sources use
  // explicit `.js` import specifiers (ESM/NodeNext convention). Transpile those
  // packages and teach webpack to resolve a `.js` specifier to its `.ts`/`.tsx`
  // source so the server-only adapters build.
  transpilePackages: [
    '@cognitia/agents',
    '@cognitia/core',
    '@cognitia/db',
    '@cognitia/integrations',
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};
export default nextConfig;
