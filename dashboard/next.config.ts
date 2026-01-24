import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output for production deployment
  output: 'standalone',
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
