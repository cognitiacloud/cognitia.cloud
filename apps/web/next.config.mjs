/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // The /gtm-os-integrated-demo server route imports the workspace TypeScript
  // source packages (@cognitia/agents and its mock-safe transitive deps). Next
  // does not transpile node_modules packages unless they are listed here. These
  // are all pure-JS / server-side and carry no live egress or vendor SDKs (stub
  // adapters only).
  transpilePackages: [
    '@cognitia/agents',
    '@cognitia/core',
    '@cognitia/integrations',
    '@cognitia/db',
  ],
  // Those packages use ESM `.js` import specifiers that point at `.ts` sources
  // (TypeScript NodeNext/Bundler convention). Teach webpack to resolve `.js` →
  // `.ts`/`.tsx` first, falling back to a real `.js`.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};
export default nextConfig;
