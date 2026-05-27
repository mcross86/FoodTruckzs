const path = require("node:path");

const rootDir = process.env.FOODTRUCKZS_RELEASE_DIR || __dirname;
const webPort = process.env.WEB_PORT || "3000";
const apiHost = process.env.API_HOST || "127.0.0.1";
const apiPort = process.env.API_PORT || "4000";

module.exports = {
  apps: [
    {
      name: "foodtruckzs-web",
      cwd: path.join(rootDir, "apps", "web"),
      script: "node_modules/next/dist/bin/next",
      args: `start --hostname 127.0.0.1 --port ${webPort}`,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: webPort,
      },
      max_memory_restart: "512M",
      merge_logs: true,
      time: true,
    },
    {
      name: "foodtruckzs-api",
      cwd: path.join(rootDir, "apps", "api"),
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        API_HOST: apiHost,
        API_PORT: apiPort,
        NODE_ENV: "production",
      },
      max_memory_restart: "512M",
      merge_logs: true,
      time: true,
    },
    {
      name: "foodtruckzs-worker",
      cwd: path.join(rootDir, "apps", "api"),
      script: "dist/workers/worker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "384M",
      merge_logs: true,
      time: true,
    },
  ],
};
