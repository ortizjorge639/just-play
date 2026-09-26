import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const api = window.canopyTest;
const canvas = document.querySelector('#scene');
const parameters = new URLSearchParams(location.search);
document.body.dataset.capture = String(parameters.has('capture'));
const assets = ['environment', 'pip', 'sol', 'ember-small', 'hearth-deck', 'rain-postcard'];
const actors = new Set(['pip', 'sol']);
const models = new Map();
const world = new THREE.Group();
const cast = new THREE.Group();
const scene = new THREE.Scene();
scene.add(world, cast);
const cameras = {
  overview: { position: [58, 48, 75], target: [12, 1.5, 4], focalLength: 43 },
  walking: { position: [4, 1.65, 6], target: [1, 2, 1] },
  interior: { position: [17, 4.6, -2.7], target: [17, 4.2, -7] },
  cast: { position: [2, 1.15, 5.3], target: [2, 0.95, 0] },
  ambient: { position: [58, 48, 75], target: [12, 1.5, 4], focalLength: 43 },
};
const fallbackLights = [
  { position: [-6.1, 1.47, -4.8], intensity: 48, distance: 10 },
  { position: [3.9, 1.47, -6.7], intensity: 48, distance: 10 },
  { position: [-5.6, 1.47, 5.3], intensity: 48, distance: 10 },
  { position: [6.9, 1.47, .2], intensity: 48, distance: 10 },
  { position: [15.85, 4.45, -3.96], intensity: 24, distance: 7 },
  { position: [17.26, 3.86, -7.7], intensity: 14, distance: 5 },
  { position: [37.98, 5.78, 9.03], intensity: 52, distance: 10 },
];
let renderer, controls, camera, perspectiveCamera, orthographicCamera, manifest = {}, config = {};
let view = 'overview', lighting = 'day', time = 0, playing = false, previous = 0;
let castProjection = 'perspective';
let castYaw = 0, roofVisible = true;
const lamps = [];
const roofs = [];
const hemi = new THREE.HemisphereLight(0xc6e2eb, 0x5f6340, 2.4);
const key = new THREE.DirectionalLight(0xffe5b8, 3.2);
key.position.set(22, 38, 18);
scene.add(hemi, key, key.target);
const finite = values => values.every(Number.isFinite);
const vec = (value, fallback) => Array.isArray(value) && value.length === 3 && finite(value) ? value : fallback;
const warn = message => { if (!api.warnings.includes(message)) api.warnings.push(message); };
const boxData = box => ({ min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() });

function renderOnce() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
}

function updateProjection() {
  if (camera.isOrthographicCamera) {
    const height = 2.35;
    camera.left = -height * camera.aspect / 2;
    camera.right = height * camera.aspect / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    return;
  }
  const focalLength = cameras[view].focalLength;
  if (focalLength) {
    camera.setFocalLength(focalLength);
    if (camera.aspect < 1) {
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(36 / (2 * focalLength * camera.aspect)));
    }
  } else {
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(45) / 2) * Math.max(1, 1.5 / camera.aspect)));
  }
  camera.updateProjectionMatrix();
}

function updateAmbient(seconds) {
  const phase = seconds / 6 * Math.PI * 2;
  const base = cameras.ambient;
  camera.position.fromArray(base.position).add(new THREE.Vector3(.8 * Math.sin(phase), .2 * (1 - Math.cos(phase)), .5 * (Math.cos(phase) - 1)));
  controls.target.fromArray(base.target);
  controls.update();
}

function setView(name) {
  if (!Object.hasOwn(cameras, name)) throw new Error(`Unknown camera: ${name}`);
  view = name;
  camera = name === 'cast' && castProjection === 'orthographic' ? orthographicCamera : perspectiveCamera;
  controls.object = camera;
  updateProjection();
  world.visible = name !== 'cast';
  for (const [id, model] of models) {
    if (!actors.has(id)) continue;
    model.anchor.position.fromArray(name === 'cast' ? (id === 'pip' ? [1, 0, 0] : [3, 0, 0]) : model.placement);
    model.anchor.rotation.y = name === 'cast' ? castYaw : 0;
  }
  camera.position.fromArray(cameras[name].position);
  controls.target.fromArray(cameras[name].target);
  if (camera.isOrthographicCamera) camera.position.y = controls.target.y;
  controls.enablePan = name !== 'ambient';
  controls.update();
  if (name === 'ambient') updateAmbient(time);
  document.querySelector('#view').value = name;
  renderOnce();
  return { name, position: camera.position.toArray(), target: controls.target.toArray() };
}

function setCastProjection(name) {
  if (!['perspective', 'orthographic'].includes(name)) throw new Error(`Unknown cast projection: ${name}`);
  castProjection = name;
  if (view === 'cast') setView('cast');
  return name;
}

function setLighting(name) {
  if (!['day', 'night'].includes(name)) throw new Error(`Unknown lighting: ${name}`);
  lighting = name;
  const settings = config.lighting?.[name] ?? {};
  scene.background = new THREE.Color(settings.background ?? (name === 'day' ? 0xc7dfdf : 0x132534));
  hemi.color.set(settings.sky ?? (name === 'day' ? 0xc6e2eb : 0x719bbf));
  hemi.groundColor.set(settings.ground ?? (name === 'day' ? 0x5f6340 : 0x263132));
  hemi.intensity = settings.ambientIntensity ?? (name === 'day' ? 2.4 : 1);
  key.color.set(settings.keyColor ?? (name === 'day' ? 0xffe5b8 : 0x98c9ed));
  key.intensity = settings.keyIntensity ?? (name === 'day' ? 3.2 : 1.05);
  key.position.fromArray(vec(settings.keyPosition, [22, 38, 18]));
  renderer.toneMappingExposure = settings.exposure ?? 1;
  for (const lamp of lamps) lamp.visible = name === 'night';
  document.querySelector('#lighting').value = name;
  renderOnce();
  return name;
}

function chooseClip(model, requested) {
  const alias = config.animations?.[model.id]?.[requested];
  return model.clips.find(clip => clip.name === (alias ?? requested))
    ?? model.clips.find(clip => clip.name.toLowerCase().includes(requested.toLowerCase()));
}

function playAction(requested, { loop = true, assetId } = {}) {
  const selected = [];
  for (const [id, model] of models) {
    if (!actors.has(id) || (assetId && assetId !== id)) continue;
    const clip = chooseClip(model, requested);
    if (!clip) {
      if (assetId) throw new Error(`${id}: animation "${requested}" not found`);
      warn(`${id}: no ${requested} clip`);
      continue;
    }
    model.mixer.stopAllAction();
    const action = model.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.play();
    model.action = action;
    model.active = clip.name;
    selected.push({ asset: id, clip: clip.name, duration: clip.duration });
  }
  if (!selected.length) throw new Error(`No approved character has animation "${requested}"`);
  setTime(0);
  return selected;
}

function setTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Time must be a finite nonnegative number.');
  time = seconds;
  for (const model of models.values()) {
    if (!model.mixer) continue;
    if (model.action?.enabled) model.action.paused = false;
    const duration = model.action?.getClip().duration;
    const ambientOffset = model.id === 'sol' ? .85 : 0;
    const sampleTime = view === 'ambient' && duration && model.action.loop === THREE.LoopRepeat
      ? seconds * (Math.max(1, Math.round(6 / duration)) * duration / 6) + ambientOffset
      : seconds;
    model.mixer.setTime(sampleTime);
  }
  if (view === 'ambient') updateAmbient(seconds);
  renderOnce();
  return seconds;
}

function setPlaying(value) {
  playing = Boolean(value);
  document.querySelector('#play').textContent = playing ? 'Pause' : 'Play';
  document.querySelector('#play').setAttribute('aria-pressed', String(playing));
  previous = performance.now();
  return playing;
}

function setRoof(visible) {
  roofVisible = Boolean(visible);
  for (const roof of roofs) roof.visible = roofVisible;
  document.querySelector('#roof').checked = roofVisible;
  renderOnce();
  return roofs.length;
}

function setCastAngle(radians) {
  if (!Number.isFinite(radians)) throw new Error('Cast angle must be finite.');
  castYaw = radians;
  if (view === 'cast') setView('cast');
  return castYaw;
}

function snapshot(assetId) {
  const model = models.get(assetId);
  if (!model) throw new Error(`Unknown asset: ${assetId}`);
  scene.updateMatrixWorld(true);
  const nodes = [];
  model.root.traverse(node => {
    nodes.push({ name: node.name, matrix: node.matrix.toArray(), morphs: Array.from(node.morphTargetInfluences ?? []) });
  });
  return nodes;
}

function sampleClip(assetId, clipName, seconds) {
  const model = models.get(assetId);
  const clip = model?.clips.find(item => item.name === clipName);
  if (!clip) throw new Error(`Missing clip: ${assetId}/${clipName}`);
  playAction(clipName, { assetId, loop: false });
  setTime(Math.min(Math.max(seconds, 0), clip.duration));
  return snapshot(assetId);
}

function stats() {
  const geometrySet = new Set(), materials = new Set(), data = {};
  let meshes = 0, triangles = 0, environmentTriangles = 0;
  const invalidGeometry = [], invalidMaterials = [], markers = [];
  for (const [id, model] of models) {
    let count = 0, tri = 0;
    model.root.traverse(node => {
      if (node.name || node.userData.marker) markers.push({ asset: id, name: node.name, extras: node.userData, position: node.getWorldPosition(new THREE.Vector3()).toArray() });
      if (!node.isMesh) return;
      count++;
      const geometry = node.geometry;
      const position = geometry.getAttribute('position');
      const n = (geometry.index?.count ?? position?.count ?? 0) / 3;
      tri += n * (node.isInstancedMesh ? node.count : 1);
      if (!geometrySet.has(geometry)) {
        geometrySet.add(geometry);
        if (!position || !finite(Array.from(position.array))) invalidGeometry.push(`${id}/${node.name}: non-finite/missing positions`);
        if (geometry.index && Array.from(geometry.index.array).some(index => index >= position.count)) invalidGeometry.push(`${id}/${node.name}: index out of range`);
      }
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        const values = [...material.color?.toArray() ?? [], material.opacity, material.roughness ?? 1, material.metalness ?? 0];
        if (!finite(values) || values.some(value => value < 0 || value > 1)) invalidMaterials.push(`${id}/${material.name}: color/PBR values outside [0,1]`);
        if (material.emissive && (!finite(material.emissive.toArray()) || material.emissive.toArray().some(value => value < 0))) invalidMaterials.push(`${id}/${material.name}: invalid emission`);
      }
    });
    const bounds = new THREE.Box3().setFromObject(model.root, true);
    meshes += count; triangles += tri;
    if (!actors.has(id)) environmentTriangles += tri;
    data[id] = {
      meshes: count, triangles: tri, bytes: model.bytes, sha256: model.sha256,
      bounds: boxData(bounds), restBounds: model.restBounds,
      height: actors.has(id) ? model.restBounds.size[1] : null,
      clips: model.clips.map(clip => ({
        name: clip.name, duration: clip.duration, tracks: clip.tracks.length,
        startTime: Math.min(...clip.tracks.map(track => track.times[0] ?? Infinity)),
        valid: Number.isFinite(clip.duration) && clip.duration > 0 && clip.tracks.every(track => finite(Array.from(track.times)) && finite(Array.from(track.values)) && track.validate()),
      })),
    };
  }
  return {
    meshes, triangles, environmentTriangles, characterTriangles: triangles - environmentTriangles,
    materials: materials.size, geometries: geometrySet.size, assets: data,
    bounds: boxData(new THREE.Box3().setFromObject(world, true)),
    markers, warnings: [...api.warnings], invalidGeometry, invalidMaterials, view, lighting, time,
    roofNodes: roofs.map(node => node.name), camera: { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov, aspect: camera.aspect, projection: camera.isOrthographicCamera ? 'orthographic' : 'perspective' },
    lights: lamps.map(lamp => ({
      name: lamp.name, position: lamp.getWorldPosition(new THREE.Vector3()).toArray(),
      color: `#${lamp.color.getHexString()}`, intensity: lamp.intensity, distance: lamp.distance, visible: lamp.visible,
    })),
    draw: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
  };
}

function localOnlyManager() {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (url.startsWith('blob:')) return url;
    const target = new URL(url, location.href);
    if (target.origin !== location.origin || !target.pathname.startsWith('/canopy-v001/exports/')) throw new Error(`Nonlocal export resource refused: ${url}`);
    return target.href;
  });
  return manager;
}

async function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  camera = new THREE.PerspectiveCamera(45, 1, .03, 500);
  camera.filmGauge = 36;
  perspectiveCamera = camera;
  orthographicCamera = new THREE.OrthographicCamera(-2, 2, 1.175, -1.175, .03, 500);
  orthographicCamera.aspect = 1;
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.minDistance = .3;
  controls.maxDistance = 150;
  controls.addEventListener('change', renderOnce);
  new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    perspectiveCamera.aspect = orthographicCamera.aspect = width / Math.max(height, 1);
    updateProjection();
    renderOnce();
  }).observe(canvas);
  try {
    const response = await fetch('/canopy-v001/manifest.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
    config = manifest.viewer ?? {};
    config = {
      ...config,
      placements: { ...Object.fromEntries(Object.entries(manifest.coordinates?.character_preview_positions_gltf ?? {}).map(([id, position]) => [id.toLowerCase(), position])), ...config.placements },
    };
  } catch (error) {
    warn(`Manifest unavailable (${error.message}); using documented defaults. Orientation verification requires manifest markers.`);
  }
  for (const name of Object.keys(cameras)) {
    if (config.cameras?.[name]) {
      cameras[name] = {
        ...cameras[name],
        position: vec(config.cameras[name].position, cameras[name].position),
        target: vec(config.cameras[name].target, cameras[name].target),
        ...(Number.isFinite(config.cameras[name].focalLength) && config.cameras[name].focalLength > 0 ? { focalLength: config.cameras[name].focalLength } : {}),
      };
    }
  }
  const loader = new GLTFLoader(localOnlyManager());
  const loaded = await Promise.allSettled(assets.map(async id => {
    const response = await fetch(`/canopy-v001/exports/${id}.glb`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    const declaredBytes = response.headers.get('Content-Length');
    if (declaredBytes && Number(declaredBytes) !== buffer.byteLength) throw new Error('Incomplete GLB response body');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
    const expectedHash = manifest.files_sha256?.[`exports/${id}.glb`];
    if (expectedHash && sha256 !== expectedHash) throw new Error('GLB response does not match manifest SHA-256');
    const gltf = await loader.parseAsync(buffer, '/canopy-v001/exports/');
    const anchor = new THREE.Group();
    anchor.name = `viewer-placement-${id}`;
    anchor.add(gltf.scene);
    const placement = actors.has(id) ? vec(config.placements?.[id], id === 'pip' ? [0, 0, 3] : [4, 0, 2]) : [0, 0, 0];
    anchor.position.fromArray(placement);
    (actors.has(id) ? cast : world).add(anchor);
    const model = { id, root: gltf.scene, anchor, placement, bytes: buffer.byteLength, sha256, clips: gltf.animations, mixer: actors.has(id) ? new THREE.AnimationMixer(gltf.scene) : null };
    gltf.scene.traverse(node => {
      if (node.userData.roof === true || node.userData.configurable === 'roof' || /roof/i.test(node.name)) roofs.push(node);
      if (node.isLight) { lamps.push(node); return; }
      if (node.userData.light) {
        const info = typeof node.userData.light === 'object' ? node.userData.light : {};
        const lamp = new THREE.PointLight(info.color ?? 0xffbd70, info.intensity ?? 25, info.distance ?? 9, info.decay ?? 2);
        lamp.position.copy(node.getWorldPosition(new THREE.Vector3()));
        scene.add(lamp); lamps.push(lamp);
      }
    });
    scene.updateMatrixWorld(true);
    model.restBounds = boxData(new THREE.Box3().setFromObject(gltf.scene, true));
    models.set(id, model);
  }));
  const failures = loaded.flatMap((entry, i) => entry.status === 'rejected'
    ? [`${assets[i]}.glb: ${entry.reason.message.replace(/fetch for "[^"]+" responded with /, 'HTTP ')}`] : []);
  if (failures.length) throw new Error(failures.join('\n'));
  for (const info of config.lights ?? []) {
    const lamp = new THREE.PointLight(info.color ?? 0xffbd70, info.intensity ?? 25, info.distance ?? 10, info.decay ?? 2);
    lamp.position.fromArray(vec(info.position, [0, 2, 0]));
    scene.add(lamp); lamps.push(lamp);
  }
  if (!lamps.length) {
    warn('No exported or manifest lantern lights; using seven source-positioned viewer lights. Intensities are PBR approximations, not Blender energy equivalents.');
    for (const [index, info] of fallbackLights.entries()) {
      const lamp = new THREE.PointLight(0xffc980, info.intensity, info.distance, 2);
      lamp.name = `viewer-lantern-${index + 1}`;
      lamp.position.fromArray(info.position); scene.add(lamp); lamps.push(lamp);
    }
  }
  Object.assign(api, { manifest, stats, setView, setLighting, setTime, renderOnce, playAction, setPlaying, setRoof, setCastAngle, setCastProjection, snapshot, sampleClip });
  setView('overview');
  setLighting('day');
  const clipNames = [...new Set([...models.values()].filter(model => actors.has(model.id)).flatMap(model => model.clips.map(clip => clip.name)))];
  const select = document.querySelector('#action');
  for (const name of clipNames) if (![...select.options].some(option => option.value === name)) select.add(new Option(name, name));
  if (clipNames.length) {
    const first = [...models.values()].find(model => actors.has(model.id) && chooseClip(model, 'Idle'));
    playAction(first ? 'Idle' : clipNames[0]);
  } else warn('Approved character exports contain no animation clips.');
  document.querySelector('#message').hidden = true;
  document.querySelector('fieldset').disabled = false;
  document.querySelector('#status').textContent = `Loaded ${models.size} local exports · not an approval record`;
  document.querySelector('#roof').disabled = !roofs.length;
  api.ready = true;
  api.error = null;
  const guarded = fn => { try { fn(); } catch (error) { document.querySelector('#status').textContent = error.message; } };
  document.querySelector('#view').addEventListener('change', event => guarded(() => setView(event.target.value)));
  document.querySelector('#lighting').addEventListener('change', event => guarded(() => setLighting(event.target.value)));
  select.addEventListener('change', event => guarded(() => playAction(event.target.value)));
  document.querySelector('#play').addEventListener('click', () => setPlaying(!playing));
  document.querySelector('#roof').addEventListener('change', event => setRoof(event.target.checked));
  document.querySelector('#turn').addEventListener('click', () => { setCastAngle(castYaw + Math.PI / 2); setView('cast'); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); setPlaying(false); window.canopyFail('WebGL context lost. Reload the page.'); });
  const tick = now => {
    if (playing && api.ready) setTime(time + Math.max(0, Math.min((now - previous) / 1000, .1)));
    previous = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

init().catch(window.canopyFail);
