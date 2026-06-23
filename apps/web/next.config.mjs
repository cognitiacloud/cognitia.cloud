/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // The app uses NodeNext-style explicit `.js` import specifiers (required by
  // tsc/vitest). Teach webpack to resolve those specifiers to their `.ts`/`.tsx`
  // sources so `next build` matches the typecheck/test resolution. Purely a
  // build-time resolver alias — it changes no rendered output.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};
export default nextConfig;
