/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'node-zklib', 'nodemailer'],
  },
};

export default nextConfig;
