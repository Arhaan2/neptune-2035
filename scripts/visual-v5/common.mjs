/** Shared actual-app capture helpers. All commands travel through visible UI. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';

export const argument = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const button = (page, name) => page.getByRole('button', { name, exact: true });
export const launchOptions = {
  headless: process.env.NEPTUNE_HEADED !== '1' && process.platform !== 'linux',
  args: process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'linux' ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'] : [],
};
export async function externalDirectory(destination) {
  assert(destination, 'Pass --out=/absolute/external/evidence');
  const out = path.resolve(destination), root = process.cwd();
  assert(path.isAbsolute(destination) && out !== root && !out.startsWith(root + path.sep), 'Evidence must stay outside source.');
  await fs.mkdir(out, { recursive: true });
  assert.equal((await fs.readdir(out)).length, 0, 'Use a new empty evidence directory; failed attempts are retained.');
  return out;
}
export async function artifactIdentity(context, url, out) {
  const read = async name => {
    const response = await context.request.get(new URL(name, url).href);
    assert(response.ok(), `Packaged ${name} is required: HTTP ${response.status()}`);
    const bytes = await response.body();
    await fs.writeFile(path.join(out, name), bytes);
    return { data: JSON.parse(bytes), sha256: hash(bytes) };
  };
  const release = await read('release.json'), manifest = await read('build-manifest.json');
  assert.equal(release.data.artifactSha256, manifest.sha256, 'Release must bind the served manifest.');
  assert.equal(manifest.data.algorithm, 'sha256');
  return { release: release.data, releaseSha256: release.sha256, manifestSha256: manifest.sha256,
    staticFiles: manifest.data.files.length, staticBytes: manifest.data.files.reduce((sum, item) => sum + item.bytes, 0) };
}
export async function prepare(page, url, fixture = 'transfer') {
  assert(['transfer', 'nominal', 'no-benefit-bus', 'no-benefit-source'].includes(fixture));
  await page.goto(url);
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0)).toBeGreaterThan(0);
  await button(page, 'Compare').click();
  await page.getByLabel('Decision fixture', { exact: true }).selectOption(fixture);
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed', { timeout: 120_000 });
  const pending = page.waitForEvent('download');
  await button(page, 'Export decision campaign').click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  const campaign = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert(campaign.result.status === 'completed' && campaign.result.ranking.scopeComplete);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/visuals\/v[23]\/.*\.glb(?:\?|$)/.test(entry.name)).length), 0, 'Ordinary campus/campaign preparation must not fetch authored kits.');
  await button(page, 'Start result walkthrough').click();
  await expect(page.getByTestId('operator-walkthrough')).toBeVisible();
  return campaign;
}
export async function observe(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="operator-walkthrough"]');
    const main = document.querySelector('main.twin-app');
    const scene = window.__NEPTUNE_TWIN_SCENE__;
    const source = panel?.getAttribute('data-presentation-record');
    const captionRect = panel?.querySelector('[data-testid="presentation-caption"]')?.getBoundingClientRect();
    const headingRect = panel?.querySelector('h2')?.getBoundingClientRect();
    const canvas = innerWidth <= 700 ? document.querySelector('canvas') : null;
    const canvasRect = canvas?.getBoundingClientRect();
    const mobileSceneSurfaces = canvasRect ? {
      canvas: { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height },
      surfaces: ['.twin-scale-caption', '.twin-route-legend'].map(selector => {
        const element = canvas.closest('.twin-scene')?.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const style = element ? getComputedStyle(element) : null;
        return { selector, visible: !!rect && rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility === 'visible',
          rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          canvasIntersectionArea: rect ? Math.max(0, Math.min(canvasRect.right, rect.right) - Math.max(canvasRect.x, rect.x)) *
            Math.max(0, Math.min(canvasRect.bottom, rect.bottom) - Math.max(canvasRect.y, rect.y)) : null };
      }),
    } : null;
    return {
      browserTimeMs: performance.now(), timeOriginMs: performance.timeOrigin,
      visibilityState: document.visibilityState, focused: document.hasFocus(),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      mobileSceneSurfaces,
      panel: panel ? { ...panel.dataset } : null,
      record: source ? JSON.parse(source) : null,
      displayedCaption: panel?.querySelector('[data-testid="presentation-caption"]')?.textContent
        ?? panel?.querySelector('.presentation-caption')?.textContent ?? null,
      captionRect: captionRect && headingRect ? { x: Math.min(captionRect.x, headingRect.x), y: headingRect.y,
        width: Math.max(captionRect.width, headingRect.width), height: captionRect.bottom - headingRect.y } : null,
      heading: panel?.querySelector('h2')?.textContent ?? null,
      text: panel?.textContent ?? null,
      currentTimeS: main?.getAttribute('data-time'), displayedTimeS: main?.getAttribute('data-display-time'),
      selectedId: main?.getAttribute('data-selected'), inspectionStatus: main?.getAttribute('data-inspection-status'),
      scene: scene ? {
        renderEpoch: scene.renderEpoch, selectedId: scene.selectedId, simulationTimeS: scene.simulationTimeS,
        camera: scene.camera, target: scene.target, cameraTransitioning: scene.cameraTransitioning,
        cameraControl: scene.cameraControl, canvasSize: scene.canvasSize,
        focus: scene.focus, exploded: scene.exploded, inside: scene.inside,
        visualKit: scene.visualKit, geometries: scene.geometries, textures: scene.textures, drawCalls: scene.drawCalls, triangles: scene.triangles,
      } : null,
    };
  });
}
export function assertReadable(sample) {
  assert(sample.panel && sample.record, 'Application must expose its bound presentation record.');
  assert.equal(sample.visibilityState, 'visible', 'Hidden playback is not accepted evidence.');
  assert(['current', 'resolved'].includes(sample.inspectionStatus), 'Readable shot needs canonical history.');
  assert(sample.scene && !sample.scene.cameraTransitioning, 'Readable shot needs a completed settled camera publication.');
  assert.equal(sample.scene.selectedId, sample.selectedId);
  assert.equal(sample.scene.simulationTimeS, Number(sample.displayedTimeS));
  assert(sample.scene.renderEpoch > 0);
  assert(sample.record.authoredKind ? sample.panel.readiness === 'authored' : ['authored', 'plan', 'procedural'].includes(sample.panel.readiness), 'Required authored detail must be authored; procedural campus/structural geometry is expected.');
  if (sample.viewport.width <= 700) {
    assert(sample.mobileSceneSurfaces?.canvas.width > 0 && sample.mobileSceneSurfaces?.canvas.height > 0, 'Mobile presentation needs a visible canvas.');
    for (const surface of sample.mobileSceneSurfaces.surfaces) {
      assert(surface.visible && surface.canvasIntersectionArea === 0, `${surface.selector} must remain readable without covering the mobile canvas.`);
    }
  }
}
export async function savedProjects(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('neptune-v2-scenarios') ?? '[]'));
}
