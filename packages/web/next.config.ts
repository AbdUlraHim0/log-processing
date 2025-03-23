/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === "production",
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    if (isServer && process.env.SKIP_REDIS_CONNECTION === "true") {
      config.externals = [...(config.externals || []), "ioredis", "bullmq"];
    }
    return config;
  },
};

module.exports = nextConfig;
