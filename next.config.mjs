/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Allow images from any source
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
