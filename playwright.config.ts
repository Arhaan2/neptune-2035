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
    ['json', { outputFile: process.env.NEPTUNE_BROWSER_REPORT || 'artifacts/browser-results.json' }],
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
        // Linux uses the installed Mesa GL stack through the CI Xvfb display.
        headless: process.platform !== 'linux',
        launchOptions: {
          args: process.platform === 'darwin'
            ? ['--use-angle=metal']
            // The test-only Mesa adapter is otherwise blocklisted by Chromium.
            : process.platform === 'linux' ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'] : [],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Linux uses the CI Xvfb display so Firefox initializes GTK graphics.
        headless: process.platform !== 'linux',
        // Use a software compositor and 60 Hz clock on bounded CI graphics hardware.
        launchOptions: {
          firefoxUserPrefs: { 'layout.frame_rate': 60, 'gfx.webrender.software': true },
        },
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
