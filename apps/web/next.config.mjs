/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // `@cognitia/agents` ships TypeScript source (no build step), so Next must
  // transpile it. Its ESM barrel uses explicit `.js` specifiers that resolve to
  // `.ts` files; `extensionAlias` lets webpack follow them. Together these make
  // `next build` resolve the server-only `/gtm-os-integrated-demo` data path.
  transpilePackages: ['@cognitia/agents', '@cognitia/core', '@cognitia/db', '@cognitia/integrations'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};
export default nextConfig;
