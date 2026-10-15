import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
export default defineConfig(base, {
  testDir: '../../tests/browser',
  retries: 0,
  projects: [
    {
      name: 'installed-chrome',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        headless: false,
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
    },
  ],
});
