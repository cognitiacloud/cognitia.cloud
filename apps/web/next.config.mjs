/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // The monorepo's TS sources use NodeNext-style extensionful imports (`./x.js`
  // resolving to `./x.ts`). Teach webpack the same mapping so `next build` can
  // resolve them the way `tsc` already does.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};
export default nextConfig;
