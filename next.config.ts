import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark native modules as external on server side
      config.externals = config.externals || [];
      config.externals.push({
        'ssh2': 'commonjs ssh2',
        'dockerode': 'commonjs dockerode',
      });
    }
    return config;
  },
  // Mark packages with native dependencies as server-only
  serverExternalPackages: ['dockerode', 'ssh2'],
};

export default nextConfig;
