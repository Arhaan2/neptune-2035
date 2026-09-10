import { expect, type Page } from '@playwright/test';

export type SceneObservation = NonNullable<Window['__NEPTUNE_SCENE__']>;
type Pose = Pick<SceneObservation, 'camera' | 'target'>;
export const readScene = (page: Page) =>
  page.evaluate(() => window.__NEPTUNE_SCENE__!);

// Poll one coherent, read-only frame; a pre-action observation cannot satisfy it.
export async function waitForCameraTransition(
  read: () => Promise<SceneObservation>,
  before: SceneObservation,
  inside: boolean,
  pose?: Pose,
  timeout?: number,
) {
  let observed!: SceneObservation;
  await expect.poll(async () => {
    observed = await read();
    return {
      applied: observed.frame > before.frame &&
        observed.transitionId > before.transitionId,
      inside: observed.inside,
      transitioning: observed.transitioning,
      finite: observed.camera.length === 3 && observed.target.length === 3 &&
        [...observed.camera, ...observed.target].every(Number.isFinite),
      camera: observed.camera,
      target: observed.target,
    };
  }, { message: 'camera transition applied and pose restored', ...(timeout === undefined ? {} : { timeout }) })
    .toMatchObject({
      applied: true,
      inside,
      transitioning: false,
      finite: true,
      ...(pose ? {
        camera: pose.camera.map(v => expect.closeTo(v, 1)),
        target: pose.target.map(v => expect.closeTo(v, 1)),
      } : {}),
    });
  return observed;
}

export async function resetCamera(page: Page, pose?: Pose) {
  const before = await readScene(page);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  return waitForCameraTransition(() => readScene(page), before, false, pose);
}
