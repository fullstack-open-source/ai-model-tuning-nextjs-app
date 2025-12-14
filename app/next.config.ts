import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization & better performance
  reactCompiler: true,
  
  // Turbopack optimizations (10x faster than Webpack)
  turbopack: {
    // Resolve aliases for faster module resolution
    resolveAlias: {
      '@': './src',
      '@lib': './src/lib',
      '@components': './src/components',
    },
  },
  
  // Disable TypeScript errors during build (use separate type checking)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // External packages for server components (not bundled)
  serverExternalPackages: ['@prisma/client', 'pg', '@prisma/adapter-pg'],
  
  // Image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
