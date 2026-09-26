import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openBrowser, loadScene } from './browser-runtime.mjs';
import { createOutput } from './paths.mjs';

const output = await createOutput('optional');
const session = await openBrowser({ width: 1000, height: 760 });
try {
  await loadScene(session);
  const report = await session.page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const results = {};
    for (const [file, expectedTriangles, expectedMeshes] of [
      ['hearth-enrichment.glb', 428, 6], ['collision-proxies.glb', 726, 94],
    ]) {
      const response = await fetch(`/canopy-v001/exports/${file}`);
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (sha256 !== window.canopyTest.manifest.files_sha256[`exports/${file}`]) {
        throw new Error(`${file}: hash mismatch`);
      }
      const gltf = await new GLTFLoader().parseAsync(bytes, '/canopy-v001/exports/');
      gltf.scene.updateMatrixWorld(true);
      let triangles = 0, meshes = 0, upwardBridgeRayHits = 0;
      gltf.scene.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        const geometry = object.geometry;
        const positions = geometry.getAttribute('position');
        if (![...positions.array].every(Number.isFinite)) throw new Error(`${file}: invalid positions`);
        if (object.userData.collision === 'walkable_bridge') {
          const normals = geometry.getAttribute('normal');
          if (!normals || normals.getY(0) <= .001) throw new Error(`${file}: bridge floor faces downward`);
          geometry.computeBoundingBox();
          const center = geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld);
          const ray = new THREE.Raycaster(center.add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, -1, 0));
          if (!ray.intersectObject(object, false).length) throw new Error(`${file}: bridge rejects a downward ray`);
          upwardBridgeRayHits++;
        }
        triangles += geometry.index ? geometry.index.count / 3 : positions.count / 3;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!Number.isFinite(material.roughness) || material.roughness < 0 || material.roughness > 1) {
            throw new Error(`${file}: invalid material`);
          }
        }
      });
      if (triangles !== expectedTriangles || meshes !== expectedMeshes) {
        throw new Error(`${file}: unexpected geometry ${triangles}/${meshes}`);
      }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      if (file === 'hearth-enrichment.glb' &&
          (bounds.min.x < 35.3 || bounds.max.x > 38.7 || bounds.min.y < 4 ||
           bounds.min.z < 7 || bounds.max.z > 9.5)) {
        throw new Error('Enrichment exceeds the authored hearth footprint');
      }
      results[file] = { sha256, triangles, meshes, upwardBridgeRayHits, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
      if (file === 'hearth-enrichment.glb') {
        const stage = new THREE.Scene();
        stage.background = new THREE.Color('#ccd8ca');
        stage.add(gltf.scene);
        stage.add(new THREE.HemisphereLight(0xfff2d9, 0x536955, 2.5));
        const lamp = new THREE.DirectionalLight(0xffd9a3, 3);
        lamp.position.set(38, 8, 13);
        stage.add(lamp);
        const camera = new THREE.PerspectiveCamera(40, 1000 / 760, .01, 100);
        camera.position.set(39.1, 6, 11.1);
        camera.lookAt(37.7, 4.9, 8.5);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1000, 760);
        document.body.replaceChildren(renderer.domElement);
        renderer.render(stage, camera);
      }
    }
    return { status: 'passed', files: results, collisionNavigationCertified: false };
  });
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.blocked, []);
  await session.page.screenshot({ path: resolve(output, 'optional-enrichment.png') });
  await writeFile(resolve(output, 'optional-import-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await session.close();
}
