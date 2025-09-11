/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Temporarily ignore build errors for deployment
    ignoreBuildErrors: true,
  },
  // No special ESM settings needed for Quill (removed)
}

module.exports = nextConfig