import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { assetRoot, webRoot, createOutput } from './paths.mjs';
import { assertSceneStats, inspectAnimations, assertAmbientLoop } from './validation.mjs';

const output = await createOutput('core');
const session = await openBrowser();
try {
  await loadScene(session);
  const { stats, manifest } = await session.page.evaluate(() => ({ stats: window.canopyTest.stats(), manifest: window.canopyTest.manifest }));
  const markers = assertSceneStats(stats, manifest);
  const artifactHashes = {};
  for (const id of Object.keys(stats.assets)) {
    const path = `exports/${id}.glb`;
    const hash = createHash('sha256').update(await readFile(resolve(assetRoot, path))).digest('hex');
    assert.equal(hash, stats.assets[id].sha256, `${path}: browser-loaded bytes differ from disk`);
    if (manifest.files_sha256?.[path]) assert.equal(hash, manifest.files_sha256[path], `${path}: manifest hash mismatch`);
    artifactHashes[path] = hash;
  }
  const animations = await inspectAnimations(session.page, manifest);
  const ambient = await assertAmbientLoop(session.page);
  const screenshots = [];
  for (const light of ['day', 'night']) {
    for (const view of ['overview', 'walking', 'interior', 'cast']) {
      await session.page.evaluate(({ view, light }) => {
        const api = window.canopyTest;
        api.setLighting(light); api.setView(view); api.setTime(.5); api.setRoof(true); api.renderOnce();
      }, { view, light });
      const filename = `${view}-${light}.png`;
      await session.page.locator('#scene').screenshot({ path: resolve(output, filename) });
      screenshots.push(filename);
    }
  }
  const turnarounds = [['front', 0], ['left', Math.PI / 2], ['back', Math.PI], ['right', 3 * Math.PI / 2]];
  for (const [label, angle] of turnarounds) {
    await session.page.evaluate(angle => {
      const api = window.canopyTest;
      api.setLighting('day'); api.setCastProjection('orthographic'); api.setView('cast'); api.setCastAngle(angle); api.setTime(0);
    }, angle);
    const filename = `cast-turnaround-${label}.png`;
    await session.page.locator('#scene').screenshot({ path: resolve(output, filename) });
    screenshots.push(filename);
  }
  for (const animation of animations) {
    await session.page.evaluate(({ asset, clip, maximumMotionTime }) => {
      const api = window.canopyTest;
      api.setLighting('day'); api.setCastProjection('orthographic'); api.setView('cast'); api.setCastAngle(0);
      api.playAction('Idle'); api.sampleClip(asset, clip, maximumMotionTime);
    }, animation);
    const filename = `${animation.clip.toLowerCase()}-maximum-motion.png`;
    await session.page.locator('#scene').screenshot({ path: resolve(output, filename) });
    screenshots.push(filename);
    animation.maximumMotionScreenshot = filename;
  }
  await session.page.evaluate(() => {
    const api = window.canopyTest;
    api.setView('interior'); api.setRoof(false);
  });
  await session.page.locator('#scene').screenshot({ path: resolve(output, 'interior-roof-hidden.png') });
  screenshots.push('interior-roof-hidden.png');
  assert.deepEqual(session.errors, [], `Browser errors:\n${session.errors.join('\n')}`);
  assert.deepEqual(session.blocked, [], 'Viewer attempted nonlocal network access');
  const viewerSourceSha256 = createHash('sha256').update(await readFile(resolve(webRoot, 'viewer.js'))).digest('hex');
  const report = { status: 'passed', scope: 'Local exported-artifact browser diagnostics; not production integration or artistic approval', createdAt: new Date().toISOString(), browserVersion: session.browser.version(), viewerSourceSha256, runtimeErrors: session.errors, blockedRequests: session.blocked, artifactHashes, excludedOptionalExports: ['hearth-enrichment.glb', 'collision-proxies.glb', 'cameras.glb'], stats, markers, animations, ambient, turnarounds: { projection: 'orthographic', yawDegrees: Object.fromEntries(turnarounds.map(([name, angle]) => [name, angle * 180 / Math.PI])) }, screenshots };
  await writeFile(resolve(output, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PASS: ${stats.meshes} meshes, ${stats.triangles} triangles; ${animations.length} clips sampled. Evidence: ${output}`);
} catch (error) {
  console.error(`FAIL: Browser verification did not pass.\n${error.stack}`);
  process.exitCode = 1;
} finally {
  await session.close();
}
