module.exports = {
  apps: [
    {
      name: 'dashboards-ulpik',
      cwd: '/var/www/html/dashboard',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3030',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
    },
  ],
};
