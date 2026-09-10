import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page, viewportWidth: number) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.viewportWidth).toBe(viewportWidth);
  expect(dimensions.clientWidth).toBeGreaterThan(0);
  expect(dimensions.clientWidth).toBeLessThanOrEqual(viewportWidth);
  // A classic vertical scrollbar consumes layout width without horizontal overflow.
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
}
