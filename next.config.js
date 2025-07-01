/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Enable output file tracing to reduce bundle size
  outputFileTracingRoot: process.cwd(),
}
 
module.exports = nextConfig 