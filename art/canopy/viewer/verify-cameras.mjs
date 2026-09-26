import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { createOutput } from './paths.mjs';

const output = await createOutput('cameras');
const session = await openBrowser();
try {
  await loadScene(session);
  const report = await session.page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const response = await fetch('/canopy-v001/exports/cameras.glb');
    if (!response.ok) throw new Error(`Camera export HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const expectedBytes = window.canopyTest.manifest.exports?.['cameras.glb']?.bytes;
    if (!Number.isInteger(expectedBytes) || buffer.byteLength !== expectedBytes) {
      throw new Error(`Camera byte length ${buffer.byteLength} differs from manifest ${expectedBytes}`);
    }
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
    const expectedHash = window.canopyTest.manifest.files_sha256?.['exports/cameras.glb'];
    if (expectedHash && sha256 !== expectedHash) throw new Error('Camera export hash differs from manifest');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      const target = new URL(url, location.href);
      if (target.origin !== location.origin) throw new Error('Camera export requested a nonlocal resource');
      return target.href;
    });
    const gltf = await new GLTFLoader(manager).parseAsync(buffer, '/canopy-v001/exports/');
    gltf.scene.updateMatrixWorld(true);
    const cameras = gltf.cameras.map(camera => {
      const rotation = camera.getWorldQuaternion(new THREE.Quaternion());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      return {
        name: camera.name, position: camera.getWorldPosition(new THREE.Vector3()).toArray(),
        direction: direction.toArray(), up: up.toArray(), fov: camera.fov,
        upright: up.y > 0,
        axisError: Math.max(Math.abs(right.dot(up)), Math.abs(right.dot(direction)), Math.abs(up.dot(direction)), Math.abs(right.clone().cross(up).dot(direction) + 1)),
      };
    });
    const clip = gltf.animations[0];
    if (gltf.animations.length !== 1 || clip?.name !== 'Ambient loopAction') throw new Error('Expected exactly Ambient loopAction');
    if (Math.abs(clip.duration - 6) > 1e-6) throw new Error('Source camera clip must last six seconds');
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const action = mixer.clipAction(clip);
    const ambient = gltf.cameras.find(camera => camera.name === 'Ambient_loop');
    if (!ambient) throw new Error('Ambient_loop camera missing');
    const target = new THREE.Vector3(12, 2, 0);
    let maxTargetAngle = 0, maxMotion = 0, end = null;
    const sample = seconds => {
      mixer.stopAllAction();
      action.reset().setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play(); mixer.setTime(seconds); gltf.scene.updateMatrixWorld(true);
      return gltf.cameras.flatMap(camera => camera.matrixWorld.toArray());
    };
    const start = sample(0);
    for (let frame = 0; frame <= 144; frame++) {
      end = sample(frame / 24);
      if (!end.every(Number.isFinite)) throw new Error('Camera animation produced a non-finite matrix');
      for (let i = 0; i < start.length; i++) maxMotion = Math.max(maxMotion, Math.abs(start[i] - end[i]));
      const position = ambient.getWorldPosition(new THREE.Vector3());
      const direction = ambient.getWorldDirection(new THREE.Vector3());
      const expected = target.clone().sub(position).normalize();
      maxTargetAngle = Math.max(maxTargetAngle, Math.acos(THREE.MathUtils.clamp(direction.dot(expected), -1, 1)));
    }
    return {
      bytes: buffer.byteLength, sha256, cameras,
      clip: { name: clip.name, duration: clip.duration, tracks: clip.tracks.map(track => ({ name: track.name, keys: track.times.length, first: track.times[0], last: track.times[track.times.length - 1], valid: track.validate() })) },
      samples: 145, maxMotion, maxTargetAngleRadians: maxTargetAngle,
      endpointMatrixDelta: Math.max(...start.map((value, i) => Math.abs(value - end[i]))),
      viewerAmbientVideosUseThisExport: false,
      viewerAmbientDescription: 'Viewer-authored closed sweep around [58,48,75] looking at [12,1.5,4]; not this exported source Ambient_loop camera.',
    };
  });
  assert.equal(report.cameras.length, 6);
  assert.equal(new Set(report.cameras.map(camera => camera.name)).size, 6);
  assert.ok(report.cameras.every(camera => camera.name && camera.upright && camera.axisError < 1e-5), 'Camera axes must be named, upright, and orthonormal');
  for (const [name, position, target] of [
    ['Overview', [58, 48, 75], [12, 1.5, 4]],
    ['Ambient_loop', [44, 26, 42.9], [12, 2, 0]],
  ]) {
    const camera = report.cameras.find(item => item.name === name);
    assert.ok(camera, `${name} camera missing`);
    assert.ok(Math.hypot(...camera.position.map((v, i) => v - position[i])) < 1e-4, `${name}: wrong world position`);
    const direction = target.map((v, i) => v - position[i]);
    const length = Math.hypot(...direction);
    assert.ok(Math.hypot(...camera.direction.map((v, i) => v - direction[i] / length)) < 1e-5, `${name}: wrong optical axis`);
  }
  assert.ok(report.clip.tracks.every(track => track.valid && Math.abs(track.first) < 1e-6 && Math.abs(track.last - 6) < 1e-6), 'Camera tracks must span zero to six seconds');
  assert.ok(report.maxMotion > .01, 'Camera animation must visibly move');
  assert.ok(report.endpointMatrixDelta < 1e-5, 'Source camera loop is discontinuous');
  assert.ok(report.maxTargetAngleRadians < .01, 'Source camera loses its specified aim target');
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.blocked, []);
  Object.assign(report, { status: 'passed', runtimeErrors: session.errors, blockedRequests: session.blocked, browserVersion: session.browser.version() });
  await writeFile(resolve(output, 'camera-import-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PASS:6 cameras;145 source-camera samples; endpoint delta=${report.endpointMatrixDelta}; target angle=${report.maxTargetAngleRadians}rad`);
} catch (error) {
  console.error(`FAIL:Source camera import verification failed.\n${error.stack}`);
  process.exitCode = 1;
} finally {
  await session.close();
}
