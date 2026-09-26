import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { webRoot, createOutput } from './paths.mjs';
import { assertSceneStats, inspectAnimations } from './validation.mjs';
import { captureFrames } from './capture-frames.mjs';

const output = await createOutput('character-action-frames');
const session = await openBrowser({ width: 960, height: 640 });
try {
  await loadScene(session, { capture: true });
  const data = await session.page.evaluate(() => ({ stats: window.canopyTest.stats(), manifest: window.canopyTest.manifest }));
  assertSceneStats(data.stats, data.manifest);
  const animations = await inspectAnimations(session.page, data.manifest);
  await session.page.evaluate(() => {
    const api = window.canopyTest;
    api.setLighting('day'); api.setCastProjection('orthographic'); api.setView('cast'); api.setCastAngle(0);
  });
  await captureFrames({
    page: session.page, output, frames: 192, fps: 24,
    sample: ({ seconds }) => {
      const api = window.canopyTest;
      const action = seconds < 3 ? 'Idle' : seconds < 5 ? 'Walk' : 'Greeting';
      const start = seconds < 3 ? 0 : seconds < 5 ? 3 : 5;
      if (window.canopyPreviewAction !== action) {
        api.playAction(action);
        window.canopyPreviewAction = action;
      }
      api.setTime(seconds - start);
    },
  });
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.blocked, []);
  const viewerSourceSha256 = createHash('sha256').update(await readFile(resolve(webRoot, 'viewer.js'))).digest('hex');
  const report = {
    frames: 192, fps: 24, duration: 8, width: 960, height: 640, projection: 'orthographic',
    segments: [{ action: 'Idle', start: 0, duration: 3, cycles: 1 }, { action: 'Walk', start: 3, duration: 2, cycles: 2 }, { action: 'Greeting', start: 5, duration: 3, cycles: 1 }],
    interpolation: 'Exact exported clips; no crossfades or animation retiming.', viewerSourceSha256,
    artifactHashes: Object.fromEntries(Object.entries(data.stats.assets).map(([id, asset]) => [`exports/${id}.glb`, asset.sha256])),
    animations, runtimeErrors: session.errors, blockedRequests: session.blocked,
    performance: '24fps is the deterministic output sampling rate, not a runtime performance measurement.',
  };
  await writeFile(resolve(output, 'sequence.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Recorded 192 character frames at 960×640: ${output}`);
} catch (error) {
  console.error(`FAIL: Character preview incomplete.\n${error.stack}`);
  process.exitCode = 1;
} finally {
  await session.close();
}
