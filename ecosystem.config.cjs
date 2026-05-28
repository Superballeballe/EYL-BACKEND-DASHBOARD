// PM2 process file for the EYL Next.js dashboard.
// Start: `pm2 start ecosystem.config.cjs` from the project root.
module.exports = {
  apps: [
    {
      name: "eyl",
      cwd: __dirname,
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      kill_timeout: 5000,
    },
  ],
};
