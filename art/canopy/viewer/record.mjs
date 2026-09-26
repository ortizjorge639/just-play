import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { webRoot, createOutput } from './paths.mjs';
import { assertSceneStats, assertAmbientLoop } from './validation.mjs';
import { captureFrames } from './capture-frames.mjs';

const light = process.argv.includes('--night') ? 'night' : 'day';
const output = await createOutput(light === 'night' ? 'ambient-night-phased-frames' : 'ambient-phased-frames');
const session = await openBrowser({ width: 960, height: 640 });
try {
  await loadScene(session, { capture: true });
  const data = await session.page.evaluate(() => ({ stats: window.canopyTest.stats(), manifest: window.canopyTest.manifest }));
  assertSceneStats(data.stats, data.manifest);
  const seam = await assertAmbientLoop(session.page);
  await session.page.evaluate(light => { window.canopyTest.setLighting(light); window.canopyTest.setRoof(true); }, light);
  await captureFrames({ page: session.page, output, frames: 144, fps: 24, sample: ({ seconds }) => window.canopyTest.setTime(seconds) });
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.blocked, []);
  const viewerSourceSha256 = createHash('sha256').update(await readFile(resolve(webRoot, 'viewer.js'))).digest('hex');
  const artifactHashes = Object.fromEntries(Object.entries(data.stats.assets).map(([id, asset]) => [`exports/${id}.glb`, asset.sha256]));
  await writeFile(resolve(output, 'sequence.json'), `${JSON.stringify({ frames: 144, fps: 24, duration: 6, width: 960, height: 640, lighting: light, cameraSource: 'Viewer-authored sweep; not exports/cameras.glb', viewerSourceSha256, artifactHashes, runtimeErrors: session.errors, blockedRequests: session.blocked, seam, duplicateEndFrame: false }, null, 2)}\n`);
  console.log(`Recorded 144 frames at 960×640, 24 fps: ${output}`);
} catch (error) {
  console.error(`FAIL: Ambient capture incomplete.\n${error.stack}`);
  process.exitCode = 1;
} finally {
  await session.close();
}
