/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  // @cognitia/core ships raw TypeScript (main -> src/index.ts), so Next must
  // compile it as part of the app build.
  transpilePackages: ['@cognitia/core'],
};
export default nextConfig;
