/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Enable output file tracing to reduce bundle size
  outputFileTracingRoot: process.cwd(),
  // Enable polling for WSL file watching
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        poll: 3000, // Check for changes every 3 seconds (less aggressive)
        aggregateTimeout: 500, // Delay before rebuilding (wait for multiple changes)
        ignored: /node_modules/, // Don't watch node_modules
      }
    }
    return config
  },
}

module.exports = nextConfig