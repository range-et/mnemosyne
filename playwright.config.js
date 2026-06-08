import { defineConfig, devices } from '@playwright/test';

// Vite serves the app under the `/mnemosyne/` base (see vite.config.js).
const PORT = 5176;
const BASE = `http://localhost:${PORT}/mnemosyne/`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: './tests/__output__',
  use: {
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
