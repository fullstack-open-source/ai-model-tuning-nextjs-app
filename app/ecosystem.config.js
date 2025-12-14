/**
 * PM2 Ecosystem Configuration
 * Process manager configuration for Next.js frontend
 * Uses server.js directly (as defined in package.json scripts)
 */

module.exports = {
  apps: [
    {
      name: 'nextjs-frontend-prod',
      script: 'server.js', // Direct script (same as: npm start -> node server.js)
      instances: process.env.PM2_INSTANCES || 'max', // Use 'max' CPU cores
      exec_mode: 'cluster', // Cluster mode for production
      env: {
        NODE_ENV: 'production',
        PORT: process.env.APP_INTERNAL_PORT || process.env.PORT || 3000
      },
      error_file: './logs/errors-frontend.log',
      out_file: './logs/success-frontend.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', '.next'],
      instance_var: 'INSTANCE_ID',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true
    },
    {
      name: 'prisma-studio',
      script: 'npx',
      args: 'prisma studio --port 5555 --browser none',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PRISMA_STUDIO_PORT: process.env.PRISMA_STUDIO_PORT || 5555
      },
      error_file: './logs/errors-prisma-studio.log',
      out_file: './logs/success-prisma-studio.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', '.next'],
      kill_timeout: 5000
    },
    {
      name: 'nextjs-frontend-staging',
      script: 'server.js', // Direct script (same as: npm start -> node server.js)
      instances: process.env.PM2_INSTANCES || 2, // 2 instances for staging
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'staging',
        PORT: process.env.APP_INTERNAL_PORT || process.env.PORT || 3000
      },
      error_file: './logs/errors-frontend.log',
      out_file: './logs/success-frontend.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', '.next'],
      instance_var: 'INSTANCE_ID',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'nextjs-frontend-dev',
      script: 'server.js', // Direct script (same as: npm run dev -> node server.js)
      instances: process.env.PM2_INSTANCES || 1, // 1 instance for development
      exec_mode: 'fork', // Use fork for dev mode
      env: {
        NODE_ENV: 'development',
        PORT: process.env.APP_INTERNAL_PORT || process.env.PORT || 3000
      },
      error_file: './logs/errors-frontend.log',
      out_file: './logs/success-frontend.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      watch: true, // Enable watch for development
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', '.git', '.next', 'tmp'],
      instance_var: 'INSTANCE_ID',
      kill_timeout: 5000
    }
  ]
};
