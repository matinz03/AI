import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
