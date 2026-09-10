import { test, expect, type Page, type TestInfo } from '@playwright/test';
const observing = process.env.NEPTUNE_CAMPUS_OBSERVE === '1';
const logs = new WeakMap<Page, string[]>();
export function installStepDiagnostics() {
  test.beforeEach(async ({ page }) => {
    if (!observing) return;
    test.setTimeout(120_000); // Diagnostic observation only, never normal acceptance.
    const events: string[] = []; logs.set(page, events);
    const add = (text: string) => { if (events.length < 1500) events.push(text.slice(0, 2000)); };
    page.on('console', message => { if (message.text().startsWith('[neptune-step]') || message.type() === 'error') add(message.text()); });
    page.on('pageerror', error => add('pageerror: ' + error.message));
    page.on('requestfailed', request => add('requestfailed: ' + new URL(request.url()).pathname + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 400) add('HTTP ' + response.status() + ' ' + new URL(response.url()).pathname); });
    await page.addInitScript(() => {
      let previous = '', remaining = 100;
      new MutationObserver(() => {
        const main = document.querySelector('main.twin-app');
        if (!main) return;
        const value = JSON.stringify({ time: main.getAttribute('data-time'), ready: main.getAttribute('data-ready'), stepDisabled: [...document.querySelectorAll('button')].find(b => b.textContent === 'Step 10s')?.disabled });
        if (value !== previous && remaining-- > 0) { previous = value; console.debug('[neptune-step] ' + JSON.stringify({ stage: 'dom', at: performance.timeOrigin + performance.now(), value })); }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-time', 'data-ready', 'disabled'] });
    });
  });
  test.afterEach(async ({ page }, info) => {
    if (!observing) return;
    await info.attach('step-lifecycle', { body: (logs.get(page) ?? []).join('\n'), contentType: 'text/plain' });
  });
}
export function diagnosticURL(url: string) {
  return observing ? url + (url.includes('?') ? '&' : '?') + 'phase1Diagnostics=1' : url;
}
export async function campusStep(page: Page, info: TestInfo) {
  const main = page.locator('main.twin-app'), button = page.getByRole('button', { name: 'Step 10s', exact: true });
  await expect(button).toBeEnabled();
  const before = Number(await main.getAttribute('data-time'));
  const start = Date.now();
  try {
    await button.click();
    await expect(main).toHaveAttribute('data-time', String(before + 10), observing ? { timeout: 40_000 } : {});
    await expect(button).toBeEnabled();
    await expect(main).toHaveAttribute('data-ready', 'true');
  } finally {
    await info.attach('campus-latency', { body: JSON.stringify({ elapsedMs: Date.now() - start, diagnostic: observing, originalAssertionBudgetMs: 12_000, time: await main.getAttribute('data-time'), ready: await main.getAttribute('data-ready'), stepEnabled: await button.isEnabled() }), contentType: 'application/json' });
  }
}
