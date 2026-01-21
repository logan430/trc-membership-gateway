// PM2 ecosystem configuration for TRC Membership Gateway
// Use: pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [{
    name: 'trc-gateway',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Graceful shutdown settings
    kill_timeout: 15000,        // Wait 15s before SIGKILL (longer than app's 10s timeout)
    wait_ready: false,          // Don't wait for process.send('ready')
    listen_timeout: 10000,      // Timeout waiting for listen
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Resource limits
    max_memory_restart: '500M',
  }]
};
