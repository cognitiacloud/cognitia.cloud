/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Demo app: lint is run at the monorepo level (typecheck); skip during build.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
