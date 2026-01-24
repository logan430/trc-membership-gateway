import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Standalone output for production deployment
  output: 'standalone',
  // Disable x-powered-by header
  poweredByHeader: false,
  // Set explicit workspace root (dashboard is a subdirectory of main project)
  outputFileTracingRoot: path.join(__dirname, '..'),
};

export default nextConfig;
