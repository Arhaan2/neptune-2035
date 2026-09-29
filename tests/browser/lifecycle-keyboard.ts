import { expect, type Page } from '@playwright/test';

/** For the two resource-cycle cases only. Other acceptance keeps pointer input.
 * One retried browser observation retains native-button visibility, effective
 * enabled state and actual focus, then Enter travels through browser keyboard
 * input. No DOM click, event dispatch, forced action or deadline change.
 */
export async function activateLifecycleButton(page: Page, name: string) {
  const control = page.getByRole('button', { name, exact: true });
  const browserName = page.context().browser()?.browserType().name() ?? 'webkit';
  await expect.poll(() => control.evaluateAll((elements, browser) => {
    const state = {
      count: elements.length, nativeButton: false, connected: false,
      visible: false, enabled: false, focused: false,
    };
    if (elements.length !== 1 || !(elements[0] instanceof HTMLButtonElement)) return state;
    const button = elements[0];
    state.nativeButton = true;
    state.connected = button.isConnected;
    if (!state.connected) return state;

    // Match the installed Playwright visibility rules, including display:contents
    // and its WebKit checkVisibility workaround. Opacity is not a visibility gate.
    const visible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      if (style.display === 'contents') {
        return [...element.childNodes].some(child => {
          if (child instanceof Element) return visible(child);
          if (child.nodeType !== Node.TEXT_NODE) return false;
          const range = element.ownerDocument.createRange();
          range.selectNode(child);
          const rect = range.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      }
      if (browser !== 'webkit' && typeof element.checkVisibility === 'function') {
        if (!element.checkVisibility()) return false;
      } else {
        const detailsOrSummary = element.closest('details,summary');
        if (detailsOrSummary !== element && detailsOrSummary instanceof HTMLDetailsElement && !detailsOrSummary.open) return false;
      }
      if (style.visibility !== 'visible') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    state.visible = visible(button);

    // :disabled includes disabled fieldsets with their native legend exception.
    // Nearest explicit aria-disabled true/false overrides the inherited value,
    // matching Playwright's native-button enabled assertion.
    let ariaDisabled = false;
    for (let element: Element | null = button; element;) {
      const attribute = (element.getAttribute('aria-disabled') ?? '').toLowerCase();
      if (attribute === 'true' || attribute === 'false') {
        ariaDisabled = attribute === 'true';
        break;
      }
      const root = element.getRootNode();
      element = element.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
    }
    state.enabled = !button.matches(':disabled') && !ariaDisabled;
    if (state.visible && state.enabled) {
      button.focus();
      const root = button.getRootNode() as Document | ShadowRoot;
      state.focused = root.activeElement === button && button.ownerDocument.hasFocus();
    }
    return state;
  }, browserName), {
    timeout: 12_000,
    message: `Native lifecycle button ${name} must be unique, visible, enabled and focused`,
  }).toEqual({ count: 1, nativeButton: true, connected: true, visible: true, enabled: true, focused: true });
  await page.keyboard.press('Enter');
}
