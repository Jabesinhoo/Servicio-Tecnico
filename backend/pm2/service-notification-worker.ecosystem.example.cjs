module.exports = {
  apps: [
    {
      name: 'tecnicos-notification-worker',
      script: 'src/workers/service-notification.worker.js',
      cwd: __dirname + '/..',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
