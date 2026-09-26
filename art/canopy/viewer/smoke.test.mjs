import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PerspectiveCamera, Vector3 } from 'three';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { startServer, webRoot } from './server.mjs';
import { createOutput, generatedRoot } from './paths.mjs';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { fixtureGLB, fixtureManifest } from './fixture.mjs';
import { assertSceneStats, inspectAnimations, assertAmbientLoop } from './validation.mjs';

test('loopback server is read-only, local, and serves local Three modules', async () => {
  const server = await startServer();
  try {
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Local scene inspection/);
    assert.equal((await fetch(`${server.url}node_modules/three/build/three.module.js`)).status, 200);
    assert.equal((await fetch(`${server.url}does-not-exist.glb`)).status, 404);
    assert.equal((await fetch(server.url, { method: 'POST' })).status, 405);
    const externalHostStatus = await new Promise((done, reject) => {
      http.get(server.url, { headers: { Host: 'external.invalid' } }, response => { response.resume(); done(response.statusCode); }).on('error', reject);
    });
    assert.equal(externalHostStatus, 403);
    assert.equal((await fetch(`${server.url}.runtime/`)).status, 403);
    assert.equal((await fetch(`${server.url}node_modules/`)).status, 404);
    for (const path of ['/PRODUCT.md', '/.git/config', '/.env', '/source/characters.py',
      '/canopy-v001/canopy-approval-v003.blend', '/canopy-v001/browser/verification.json',
      '/web/server.mjs', '/web/node_modules/playwright/package.json']) {
      assert.ok([403, 404].includes((await fetch(new URL(path, server.url))).status), path);
    }
  } finally { await server.close(); }
});

test('asset symlinks cannot expose another mount and evidence refuses reuse', async () => {
  await mkdir(generatedRoot, { recursive: true });
  const directory = await mkdtemp(resolve(generatedRoot, 'server-test-'));
  const previous = process.env.CANOPY_RUN;
  let server;
  try {
    await mkdir(resolve(directory, 'exports'));
    await symlink(resolve(webRoot, 'package.json'), resolve(directory, 'exports/environment.glb'));
    server = await startServer({ assets: directory });
    assert.equal((await fetch(new URL('/canopy-v001/exports/environment.glb', server.url))).status, 403);
    process.env.CANOPY_RUN = directory.split('/').pop();
    await createOutput('test');
    await assert.rejects(() => createOutput('test'), { code: 'EEXIST' });
    process.env.CANOPY_RUN = '../approval-v003';
    await assert.rejects(() => createOutput('test'), /simple directory/);
  } finally {
    if (previous === undefined) delete process.env.CANOPY_RUN;
    else process.env.CANOPY_RUN = previous;
    await server?.close();
    await rm(directory, { recursive: true });
  }
});

test('missing exports produce an honest error at desktop and mobile sizes', async () => {
  const session = await openBrowser();
  try {
    await session.page.route('**/canopy-v001/**', route => route.fulfill({ status: 404, body: 'Deliberately missing test fixture' }));
    await session.page.goto(session.url, { waitUntil: 'networkidle' });
    await session.page.waitForFunction(() => window.canopyTest.error);
    const state = await session.page.evaluate(() => ({ ready: window.canopyTest.ready, error: window.canopyTest.error, disabled: document.querySelector('fieldset').disabled }));
    assert.equal(state.ready, false);
    assert.equal(state.disabled, true);
    assert.match(state.error, /environment\.glb/);
    assert.match(await session.page.locator('#status').innerText(), /Not verified/);
    await session.page.screenshot({ path: resolve(webRoot, '.runtime/missing-desktop.png') });
    await session.page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await session.page.locator('#message').isVisible());
    assert.equal(await session.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await session.page.screenshot({ path: resolve(webRoot, '.runtime/missing-mobile.png') });
    assert.deepEqual(session.blocked, []);
  } finally { await session.close(); }
});

test('synthetic GLBs exercise controls, markers, full animations and ambient seam', async () => {
  const session = await openBrowser();
  try {
    await session.page.route('**/canopy-v001/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('manifest.json')) return route.fulfill({ json: fixtureManifest });
      const match = path.match(/\/([a-z-]+)\.glb$/);
      return match ? route.fulfill({ body: fixtureGLB(match[1]), contentType: 'model/gltf-binary' }) : route.fulfill({ status: 404 });
    });
    await loadScene(session);
    const stats = await session.page.evaluate(() => window.canopyTest.stats());
    assert.equal(assertSceneStats(stats, fixtureManifest).length, 5);
    assert.equal(stats.environmentTriangles, stats.triangles - stats.assets.pip.triangles - stats.assets.sol.triangles);
    assert.equal(stats.lights.length, 7);
    assert.deepEqual(stats.lights[0].position, [-6.1, 1.47, -4.8]);
    assert.deepEqual(stats.lights[6].position, [37.98, 5.78, 9.03]);
    assert.ok(stats.lights.every(light => !light.visible));
    assert.throws(() => assertSceneStats(stats, { viewer: { ...fixtureManifest.viewer, limits: { environmentTriangles: 1 } } }), /Environment triangle budget exceeded/);
    const offsetStats = structuredClone(stats);
    offsetStats.assets.pip.clips[0].startTime = 1 / 24;
    assert.throws(() => assertSceneStats(offsetStats, fixtureManifest), /first key/);
    offsetStats.assets.pip.clips[0].startTime = 0;
    offsetStats.assets.pip.clips[0].duration += 1 / 24;
    assert.throws(() => assertSceneStats(offsetStats, fixtureManifest), /duration/);
    const camera = new PerspectiveCamera(stats.camera.fov, stats.camera.aspect, .03, 500);
    camera.position.fromArray(stats.camera.position);
    camera.lookAt(new Vector3().fromArray(stats.camera.target));
    camera.updateMatrixWorld(true);
    for (const marker of fixtureManifest.viewer.markers) {
      const screen = new Vector3().fromArray(marker.position).project(camera);
      assert.ok(Math.abs(screen.x) < .9 && Math.abs(screen.y) < .9 && screen.z > -1 && screen.z < 1, `${marker.name}: overview marker outside safe framing`);
    }
    assert.ok(stats.roofNodes.includes('Fixture_Cover'));
    assert.equal(await session.page.evaluate(() => window.canopyTest.setRoof(false)), 1);
    assert.equal(await session.page.locator('#roof').isChecked(), false);
    await session.page.evaluate(() => window.canopyTest.setRoof(true));
    assert.equal((await inspectAnimations(session.page, fixtureManifest)).length, 6);
    await assertAmbientLoop(session.page);
    const profile = await session.page.evaluate(() => {
      const api = window.canopyTest;
      api.setCastProjection('orthographic'); api.setView('cast'); api.setCastAngle(Math.PI / 2);
      return api.stats().camera;
    });
    assert.equal(profile.projection, 'orthographic');
    assert.ok(Math.abs(profile.position[1] - profile.target[1]) < 1e-12);
    assert.equal(await session.page.evaluate(() => { window.canopyTest.setView('overview'); return window.canopyTest.stats().camera.projection; }), 'perspective');
    await session.page.evaluate(() => window.canopyTest.setCastProjection('perspective'));
    for (const view of ['walking', 'interior', 'cast', 'overview']) {
      await session.page.locator('#view').selectOption(view);
      assert.equal(await session.page.evaluate(() => window.canopyTest.stats().view), view);
    }
    await session.page.locator('#lighting').selectOption('night');
    assert.equal(await session.page.evaluate(() => window.canopyTest.stats().lighting), 'night');
    assert.ok(await session.page.evaluate(() => window.canopyTest.stats().lights.every(light => light.visible)));
    await session.page.locator('#action').selectOption('Walk');
    await session.page.locator('#play').click();
    assert.equal(await session.page.locator('#play').getAttribute('aria-pressed'), 'true');
    await session.page.locator('#play').click();
    await session.page.locator('#turn').click();
    assert.equal(await session.page.evaluate(() => window.canopyTest.stats().view), 'cast');
    await session.page.screenshot({ path: resolve(webRoot, '.runtime/synthetic-desktop.png') });
    await session.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await session.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await session.page.screenshot({ path: resolve(webRoot, '.runtime/synthetic-mobile.png') });
    assert.deepEqual(session.errors, []);
    assert.deepEqual(session.blocked, []);
  } finally { await session.close(); }
});
