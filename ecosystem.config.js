module.exports = {
  apps: [
    {
      name: "ncio-server",
      script: "./src/index.js",
      cwd: "F:/NCIO new version/server",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};