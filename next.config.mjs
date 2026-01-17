import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  // Silence workspace root inference warning by pinning tracing root
  outputFileTracingRoot: path.join(process.cwd())
};
export default nextConfig;
