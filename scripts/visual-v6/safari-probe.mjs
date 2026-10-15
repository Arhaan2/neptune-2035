/** Actual Safari capability/visibility probe; never changes Safari preferences.
 * Start /usr/bin/safaridriver --port 4446 first. A hidden/zero-frame document is
 * retained as unavailable evidence, not measured or forced to render.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { argument, externalDirectory } from '../visual-v5/common.mjs';
const url = argument('url'),
  endpoint = argument('endpoint') ?? 'http://127.0.0.1:4446';
if (!url) throw Error('Pass --url, --out and optional --endpoint.');
const out = await externalDirectory(argument('out'));
const receipt = {
  kind: 'actual-native-Safari-access',
  startedAt: new Date().toISOString(),
  url,
  endpoint,
  samples: [],
  status: 'DEVICE VALIDATION PENDING',
};
let session;
async function command(method, route, body) {
  const response = await fetch(endpoint + route, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (data.value?.error)
    throw Error(`${data.value.error}: ${data.value.message}`);
  return data.value;
}
const evaluate = (script) =>
  command('POST', `/session/${session}/execute/sync`, { script, args: [] });
try {
  const created = await command('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'safari',
        'safari:automaticInspection': false,
        'safari:automaticProfiling': false,
      },
    },
  });
  session = created.sessionId;
  receipt.capabilities = created.capabilities;
  await command('POST', `/session/${session}/window/rect`, {
    width: 1440,
    height: 1000,
  });
  await command('POST', `/session/${session}/url`, { url });
  for (let i = 0; i < 3; i++) {
    receipt.samples.push(
      await evaluate(
        "return {atMs:performance.now(),visibility:document.visibilityState,focused:document.hasFocus(),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,ready:document.querySelector('main')?.dataset.ready??null,scene:window.__NEPTUNE_TWIN_SCENE__??null,resources:performance.getEntriesByType('resource').map(x=>({name:x.name,duration:x.duration,transferSize:x.transferSize??null,encodedBodySize:x.encodedBodySize??null}))};",
      ),
    );
    // A declared 500ms observational interval checks advancing completed frames;
    // it does not create readiness or fake document visibility.
    if (i < 2) await new Promise((r) => setTimeout(r, 500));
  }
  const image = await command('GET', `/session/${session}/screenshot`);
  await fs.writeFile(
    path.join(out, 'safari-native.png'),
    Buffer.from(image, 'base64'),
  );
  const first = receipt.samples[0],
    last = receipt.samples.at(-1);
  if (
    receipt.samples.every((s) => s.visibility === 'visible') &&
    last.scene?.renderEpoch > Math.max(0, first.scene?.renderEpoch ?? 0)
  ) {
    const target = await command('POST', `/session/${session}/element`, {
      using: 'xpath',
      value: "//button[normalize-space(.)='Cooling close-up']",
    });
    await command(
      'POST',
      `/session/${session}/element/${target['element-6066-11e4-a52e-4f735466cecf']}/click`,
      {},
    );
    const deadline = Date.now() + 12000;
    let sample;
    do {
      sample = await evaluate(
        'return {visibility:document.visibilityState,scene:window.__NEPTUNE_TWIN_SCENE__};',
      );
      if (
        sample.scene?.visualKit.status === 'ready' &&
        !sample.scene.cameraTransitioning
      )
        break;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    receipt.afterInput = sample;
    await fs.writeFile(
      path.join(out, 'safari-after-input.png'),
      Buffer.from(
        await command('GET', `/session/${session}/screenshot`),
        'base64',
      ),
    );
    if (
      sample.visibility === 'visible' &&
      sample.scene?.visualKit.status === 'ready' &&
      !sample.scene.cameraTransitioning
    )
      receipt.status =
        'ACCESS OBSERVED — IMAGE REVIEW AND FULL DEVICE PROTOCOL STILL REQUIRED';
  } else
    receipt.blocker =
      'Native document was hidden or completed scene frames did not advance. No performance result is admissible. Use an authorized visible session; do not synthesize visibility or retry this unchanged route.';
} catch (error) {
  receipt.blocker = error.message;
} finally {
  if (session)
    await command('DELETE', `/session/${session}`).catch((error) => {
      receipt.cleanupError = error.message;
    });
  receipt.completedAt = new Date().toISOString();
  await fs.writeFile(
    path.join(out, 'safari-access.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ status: receipt.status, blocker: receipt.blocker, out }),
  );
  if (receipt.blocker) process.exitCode = 1;
}
