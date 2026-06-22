/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Demo app: lint is run at the monorepo level (typecheck); skip during build.
  eslint: { ignoreDuringBuilds: true },
  // Preserve old demo URLs after the portal restructure.
  async redirects() {
    return [
      { source: '/dashboard', destination: '/portal/dashboard', permanent: false },
      { source: '/customer-mapper', destination: '/portal/customers', permanent: false },
    ];
  },
};
export default nextConfig;
