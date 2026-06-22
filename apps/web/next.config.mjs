/** @type {import('next').NextConfig} */
const nextConfig = {
  // V1 console is intentionally minimal; no images/runtime extras.
  reactStrictMode: true,
  webpack: (config) => {
    // The server-only GTM integrated-demo adapter chain (and its view-models)
    // use NodeNext-style `.js` import specifiers for TypeScript sources, which
    // `tsc` resolves but webpack does not by default. Map `.js`/`.jsx` back to
    // the TS source extensions so the route builds. No behavior change.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};
export default nextConfig;
