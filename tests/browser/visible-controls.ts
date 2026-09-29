import { expect, type Locator, type Page } from '@playwright/test';

/** Navigate the V4 surfaces through their visible controls before a retained
 * action. The target keeps its original locator/action and deadline. No hidden
 * clicks, DOM event dispatch, handler invocation, or assertion interception.
 */
export async function visibleControl(page: Page, target: Locator): Promise<Locator> {
  if (await target.isVisible()) {
    const expand = page.getByRole('button', { name: 'Expand inspector', exact: true });
    if (await expand.isVisible() && await target.evaluate(element => Boolean(element.closest('[data-panel]')))) await expand.click();
    return target;
  }
  const exit = page.getByRole('button', { name: 'Exit presentation focus', exact: true });
  if (await exit.isVisible()) await exit.click();
  const location = await target.evaluate(element => ({
    workspace: element.closest('[data-workspace-panel]')?.getAttribute('data-workspace-panel'),
    panel: element.closest('[data-panel]')?.getAttribute('data-panel'),
  }));
  if (location.workspace) await page.getByRole('button', { name: location.workspace, exact: true }).click();
  const names: Record<string, string> = { assets: 'Assets', inspector: 'Inspector', inspection: 'Inspector', design: 'Design', data: 'Data & replay', evidence: 'Constraints & sources' };
  if (location.panel) {
    const name = names[location.panel] ?? location.panel;
    const control = page.getByRole('button', { name, exact: true });
    if (await control.getAttribute('aria-pressed') !== 'true' && await control.getAttribute('aria-expanded') !== 'true') await control.click();
    const expand = page.getByRole('button', { name: 'Expand inspector', exact: true });
    if (await expand.isVisible()) await expand.click();
  }
  // Open outer summaries before inner ones, using the actual semantic tree.
  const closed = await target.locator('xpath=ancestor::details[not(@open)]').all();
  for (const details of closed) {
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  }
  // Native file inputs intentionally use a visible label as the chooser. Keep
  // that real entry point visible before Playwright's native file selection.
  if (await target.evaluate(element => element instanceof HTMLInputElement && element.type === 'file')) {
    const label = target.locator('xpath=ancestor::label[1]');
    await label.scrollIntoViewIfNeeded();
    await expect(label).toBeVisible();
    await expect(label).toBeInViewport();
    return target;
  }
  await expect(target).toBeVisible();
  return target;
}

export async function withVisibleControl<T>(page: Page, target: Locator, action: (control: Locator) => Promise<T>): Promise<T> {
  const control = await visibleControl(page, target);
  const projectArtifact = /(?:Export artifact|Import project)/.test(control.toString());
  const value = await action(control);
  if (projectArtifact) {
    const menu = page.locator('details[data-ui-overlay][open]').filter({ has: page.locator('summary').filter({ hasText: /^Project actions$/ }) });
    if (await menu.count()) await menu.locator(':scope > summary').click();
  }
  return value;
}

export async function openPanel(page: Page, name: string) {
  const control = page.getByRole('button', { name, exact: true });
  if (await control.getAttribute('aria-pressed') !== 'true' && await control.getAttribute('aria-expanded') !== 'true') await control.click();
  const expand = page.getByRole('button', { name: 'Expand inspector', exact: true });
  if (await expand.isVisible()) await expand.click();
}

export async function projectActions(page: Page) {
  const summary = page.locator('summary').filter({ hasText: /^Project actions$/ });
  const details = summary.locator('..');
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await summary.click();
}
