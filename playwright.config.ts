import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testIgnore: process.env.NEPTUNE_RECORD === '1' ? [] : ['**/record.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  webServer: process.env.NEPTUNE_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 30_000,
      },
  expect: { timeout: 12_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/browser-results.json' }],
  ],
  use: {
    baseURL: process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1600, height: 1050 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1050 },
        launchOptions: { args: ['--use-angle=metal'] },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Use a 60 Hz software display clock instead of host-display vsync.
        launchOptions: { firefoxUserPrefs: { 'layout.frame_rate': 60 } },
        viewport: { width: 1600, height: 1050 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // Match the other desktop projects' pixel density on bounded CI hardware.
        deviceScaleFactor: 1,
        viewport: { width: 1600, height: 1050 },
      },
    },
  ],
});
