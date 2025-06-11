/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during production builds if causing issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Move serverComponentsExternalPackages to the correct location
  serverExternalPackages: ['@supabase/supabase-js'],
  // Ensure API routes work properly
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
}

module.exports = nextConfig