/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume the workspace packages as TypeScript source.
  transpilePackages: [
    '@cognitia/config',
    '@cognitia/db',
    '@cognitia/core',
    '@cognitia/llm',
    '@cognitia/apify',
    '@cognitia/adapters',
    '@cognitia/vision',
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
