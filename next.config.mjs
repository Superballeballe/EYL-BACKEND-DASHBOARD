/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow self-hosting as a standalone server bundle (Docker-friendly).
  output: "standalone",
  eslint: {
    // Don't fail production builds on lint; lint is run separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
