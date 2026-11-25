/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'node-zklib', 'nodemailer'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
