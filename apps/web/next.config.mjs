/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // Workspace TS packages (e.g. @cognitia/agents) ship raw .ts via their
  // `main`/`types` entrypoints, so Next must transpile them like local source.
  transpilePackages: ['@cognitia/agents', '@cognitia/core', '@cognitia/db', '@cognitia/integrations'],
  webpack: (config) => {
    // The codebase uses ESM-style `.js` import specifiers that resolve to
    // `.ts`/`.tsx` sources (tsconfig `moduleResolution: "Bundler"`). Teach
    // webpack the same mapping so production builds resolve them.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};
export default nextConfig;
