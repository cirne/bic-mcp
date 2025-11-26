/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server components and API routes
  experimental: {
    serverActions: { enabled: true },
  },
};

export default nextConfig;

