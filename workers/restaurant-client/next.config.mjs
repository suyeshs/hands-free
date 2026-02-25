import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  generateBuildId: async () => {
    // Force new build ID to bust all caches
    return `build-${Date.now()}`;
  },
  env: {
    NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude ONNX Runtime node bindings from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Completely ignore node-specific ONNX files
    config.module.rules.push({
      test: /ort.*\.node.*\.(mjs|js|node)$/,
      loader: 'ignore-loader',
    });

    return config;
  },
};

export default nextConfig;
