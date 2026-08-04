import { defineConfig, devices } from "@playwright/test";

const frontendDir = __dirname;
const devServerCommand =
  process.platform === "win32"
    ? `cd /d "${frontendDir}" && npm run dev -- --webpack --hostname 127.0.0.1 --port 3000`
    : `cd "${frontendDir}" && npm run dev -- --webpack --hostname 127.0.0.1 --port 3000`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: devServerCommand,
    cwd: frontendDir,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
