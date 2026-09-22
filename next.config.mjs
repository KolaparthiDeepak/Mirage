/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plan 20 — self-hosting: a standalone build bundles only the traced
  // dependencies a `node server.js` needs into .next/standalone, instead of
  // requiring `npm install` inside the image. No effect on Vercel, which
  // already does its own equivalent tracing.
  output: "standalone",
};
export default nextConfig;
