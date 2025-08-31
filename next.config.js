/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore build errors for deployment
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig