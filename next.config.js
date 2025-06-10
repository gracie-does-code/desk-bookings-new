/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure we're not trying to export statically
  trailingSlash: false,
  
  // Force dynamic rendering for API routes
  experimental: {
    // Ensure API routes are treated as serverless functions
    serverComponentsExternalPackages: [],
  },
  
  // Explicitly disable static export
  output: undefined,
  
  // Ensure proper handling of dynamic routes
  async rewrites() {
    return []
  }
}

module.exports = nextConfig