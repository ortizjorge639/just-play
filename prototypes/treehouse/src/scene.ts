import {
  AmbientLight, BoxGeometry, BufferGeometry, CanvasTexture, CapsuleGeometry, CircleGeometry,
  ConeGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, OrthographicCamera, PlaneGeometry, Raycaster, Scene, SphereGeometry,
  TorusGeometry, Vector2, Vector3, WebGPURenderer, ACESFilmicToneMapping,
} from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Game, View } from "./data";

declare global {
  interface Window {
    __TREEHOUSE_BASELINE__?: boolean;
    treehouseMetrics?: {
      backend: string; draws: number; triangles: number; frames: number;
      frameIntervals: number[]; renderTimes: number[]; staticMeshes: number;
      staticBatches: number; pixelRatio: number; readyMs: number; residents: number;
    };
  }
}

export interface World {
  update(games: Game[], arrival: string | null): void;
  setView(view: View): void;
  select(id: string | null): void;
  rotate(direction: number): void;
  zoom(direction: number): void;
  home(): void;
  setNight(night: boolean): void;
  setMotion(enabled: boolean): void;
  dispose(): void;
}

type Resident = { root: Group; head: Group; arm: Group; id: string; phase: number; birth: number; base: Vector3 };

export async function createWorld(
  canvas: HTMLCanvasElement,
  initialGames: Game[],
  onSelect: (id: string) => void,
  onReady: (backend: string) => void,
  onFailure: (message: string) => void,
  motionEnabled: boolean,
): Promise<World> {
  const start = performance.now();
  const baseline = !!window.__TREEHOUSE_BASELINE__;
  const forceWebGL = new URLSearchParams(location.search).has("webgl");
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL });
  try {
    await renderer.init();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, baseline ? 2 : 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  const camera = new OrthographicCamera(-10, 10, 8, -8, .1, 100);
  const target = new Vector3(0, 3.3, 0);
  const island = new Group();
  scene.add(island);
  const architecture = new Group();
  island.add(architecture);
  const ambient = new HemisphereLight("#fff7d9", "#628c7a", 2.2);
  const fill = new AmbientLight("#fff1ce", .45);
  const sun = new DirectionalLight("#fff0c8", 2.4);
  sun.position.set(-5, 12, 8);
  sun.castShadow = true;
  sun.shadow.autoUpdate = baseline;
  sun.shadow.needsUpdate = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 12, bottom: -8, near: .5, far: 40 });
  sun.shadow.bias = -.002;
  sun.shadow.normalBias = .06;
  scene.add(ambient, fill, sun);

  const geometries = new Map<string, BufferGeometry>();
  const materials = new Map<string, MeshStandardMaterial>();
  const basicMaterials: MeshBasicMaterial[] = [];
  const geometry = (name: string) => {
    if (!geometries.has(name)) {
      const shapes: Record<string, () => BufferGeometry> = {
        box: () => new BoxGeometry(1, 1, 1),
        round: () => new RoundedBoxGeometry(1, 1, 1, 2, .12),
        ball: () => new SphereGeometry(1, 16, 12),
        pole: () => new CylinderGeometry(1, 1, 1, 12),
        cone: () => new ConeGeometry(1, 1, 12),
        ring: () => new TorusGeometry(1, .12, 6, 24),
        capsule: () => new CapsuleGeometry(.5, .5, 3, 8),
      };
      geometries.set(name, shapes[name]());
    }
    return geometries.get(name)!;
  };
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new MeshStandardMaterial({ color, roughness: .86, metalness: 0 }));
    return materials.get(color)!;
  };
  function mesh(parent: Object3D, shape: string, color: string, pos: number[], scale: number[], rotation?: number[]) {
    const object = new Mesh(geometry(shape), material(color));
    object.position.set(pos[0], pos[1], pos[2]);
    object.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function beam(parent: Object3D, from: Vector3, to: Vector3, radius: number, color: string) {
    const object = mesh(parent, "pole", color, [0, 0, 0], [radius, from.distanceTo(to), radius]);
    object.position.copy(from).add(to).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
    return object;
  }
  const wood = "#ac7950", honey = "#d9b47b", lightWood = "#edcf99", darkWood = "#795a42";
  const greens = ["#80a871", "#91b97e", "#a4c18a", "#739867", "#b2ca91"];
  // Repeated foliage, joinery, stones and roof tiles share unit geometries.
  mesh(architecture, "pole", "#b6a075", [0, -.7, 0], [5.2, 1.2, 4.2]);
  mesh(architecture, "pole", "#899f68", [0, -.11, 0], [5.3, .3, 4.3]);
  mesh(architecture, "pole", "#b2c98b", [0, .06, 0], [5.2, .16, 4.2]);
  mesh(architecture, "ball", "#bdd69a", [-2.5, .05, -.8], [2.1, .45, 1.8]);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d");
  if (!ctx) { renderer.dispose(); throw new Error("A 2D canvas is required to create the ground shadow."); }
  const gradient = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
  gradient.addColorStop(0, "#385a4366"); gradient.addColorStop(.55, "#385a4333"); gradient.addColorStop(1, "#385a4300");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const shadowMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  basicMaterials.push(shadowMaterial);
  const shadowGeometry = new CircleGeometry(1, 40);
  geometries.set("shadow", shadowGeometry);
  const groundShadowGeometry = new PlaneGeometry(15, 12);
  geometries.set("ground-shadow", groundShadowGeometry);
  const shadow = new Mesh(groundShadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(.1, -1.34, .1);
  architecture.add(shadow);
  // An offset trunk leaves the clubhouse interior visible from the default view.
  mesh(architecture, "pole", wood, [-.8, 3.1, -1.15], [.62, 6.5, .62], [0, 0, -.05]);
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    beam(architecture, new Vector3(-.8, .8, -1.15), new Vector3(-.8 + Math.cos(angle) * 1.5, .15, -1.15 + Math.sin(angle)), .22, wood);
  }
  beam(architecture, new Vector3(-.8, 4.6, -1.1), new Vector3(-3, 6.1, -1), .29, wood);
  beam(architecture, new Vector3(-.8, 5.1, -1.1), new Vector3(2, 6.8, -1.4), .32, wood);
  const crowns = [
    [-2.7, 6.6, -1, 1.9, 1.25, 1.5], [-.9, 7.45, -1.3, 2.1, 1.35, 1.65],
    [1.3, 7.55, -1.4, 2.05, 1.2, 1.65], [2.7, 6.85, -1.8, 1.8, 1.2, 1.5],
    [-3.5, 5.8, -1.8, 1.4, 1.1, 1.35], [.6, 8.2, -2.1, 1.7, .9, 1.35],
  ];
  crowns.forEach((c, i) => {
    mesh(architecture, "ball", greens[i % greens.length], c.slice(0, 3), c.slice(3));
    for (let j = 0; j < 5; j++) {
      const a = j * 2.4 + i;
      mesh(architecture, "ball", greens[(i + j) % greens.length], [c[0] + Math.cos(a) * c[3] * .65, c[1] + Math.sin(a) * .45, c[2] + Math.sin(j * 1.6) * .9], [.7, .7, .7]);
    }
  });
  // Open-front cedar cabin, shingled roof and wraparound deck.
  for (let i = 0; i < 14; i++) {
    mesh(architecture, "round", i % 3 ? honey : lightWood, [-2.15 + i * .34, 2.25, .8], [.32, .17, 3.3]);
  }
  mesh(architecture, "round", darkWood, [.1, 2.05, .8], [4.9, .25, 3.55]);
  for (const x of [-2.1, 2.25]) for (const z of [-.55, 2.1]) {
    mesh(architecture, "pole", wood, [x, 1.06, z], [.11, 2.1, .11]);
    mesh(architecture, "round", honey, [x, 3.55, z], [.18, 2.7, .18]);
  }
  for (let i = 0; i < 8; i++) {
    mesh(architecture, "round", i % 2 ? lightWood : honey, [.1, 2.5 + i * .28, -.64], [4.6, .25, .17]);
    mesh(architecture, "round", i % 2 ? honey : lightWood, [-2.17, 2.5 + i * .28, .7], [.17, .25, 2.85]);
  }
  // Small luminous windows and a round attic window.
  const windowMat = material("#ffdb88");
  windowMat.emissive.set("#ffbf58");
  windowMat.emissiveIntensity = .55;
  for (const x of [-1.25, 1.25]) {
    mesh(architecture, "round", darkWood, [x, 3.8, -.49], [1, 1.22, .13]);
    mesh(architecture, "round", "#ffdb88", [x, 3.8, -.40], [.82, 1.03, .07]);
    mesh(architecture, "box", honey, [x, 3.8, -.32], [.06, 1.05, .05]);
    mesh(architecture, "box", honey, [x, 3.8, -.32], [.9, .06, .05]);
  }
  const roof = new Group();
  roof.position.set(.1, 5.35, .7);
  architecture.add(roof);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 10; col++) {
        mesh(roof, "round", (col + row) % 3 === 0 ? "#d79168" : "#c6805e",
          [-2.5 + col * .56, -.12 - row * .24, side * (.1 + row * .43)],
          [.59, .16, .59], [side * .52, 0, 0]);
      }
    }
  }
  mesh(roof, "round", "#dfaa76", [0, .03, 0], [5.6, .23, .24]);
  // Front gable supports and a hanging leaf sign, not a flat cover texture.
  beam(architecture, new Vector3(-2.5, 4.15, 2.7), new Vector3(.1, 5.4, 2.7), .09, lightWood);
  beam(architecture, new Vector3(.1, 5.4, 2.7), new Vector3(2.65, 4.15, 2.7), .09, lightWood);
  beam(architecture, new Vector3(-2.5, 4.15, 2.7), new Vector3(2.65, 4.15, 2.7), .08, honey);
  const sign = mesh(architecture, "round", "#e9cfa0", [.1, 4.24, 2.86], [.75, .58, .13], [0, 0, -.08]);
  mesh(sign, "ball", "#709475", [0, .05, .6], [.19, .31, .05], [0, 0, -.45]);
  // Railings leave a welcoming opening aligned to the stairs.
  for (const x of [-2.1, -1.55, 1.05, 1.6, 2.2]) {
    mesh(architecture, "pole", honey, [x, 2.7, 2.35], [.055, .8, .055]);
    mesh(architecture, "ball", lightWood, [x, 3.13, 2.35], [.085, .085, .085]);
  }
  mesh(architecture, "round", lightWood, [-1.8, 3.04, 2.35], [.8, .1, .13]);
  mesh(architecture, "round", lightWood, [1.63, 3.04, 2.35], [1.3, .1, .13]);
  for (let i = 0; i < 8; i++) {
    mesh(architecture, "round", i % 2 ? honey : lightWood, [-.65, .3 + i * .25, 4.06 - i * .23], [1.18, .17, .4]);
  }
  for (const x of [-1.3, .02]) {
    beam(architecture, new Vector3(x, .58, 4.1), new Vector3(x, 2.52, 2.3), .055, honey);
  }
  // Interior: a couch, cushions, woven rug, books and a tea table.
  mesh(architecture, "round", "#719e88", [.25, 2.66, -.08], [1.65, .5, .65]);
  mesh(architecture, "round", "#82ac94", [.25, 2.98, -.37], [1.65, .65, .22]);
  for (const x of [-.57, 1.07]) mesh(architecture, "round", "#82ac94", [x, 2.8, -.05], [.25, .65, .72]);
  mesh(architecture, "round", "#f0d796", [-.13, 2.94, .09], [.4, .35, .14], [0, 0, -.16]);
  mesh(architecture, "pole", "#d69c76", [.15, 2.36, 1.05], [1.18, .025, .85]);
  mesh(architecture, "pole", lightWood, [.2, 2.77, 1.13], [.42, .1, .34]);
  mesh(architecture, "pole", wood, [.2, 2.54, 1.13], [.065, .45, .065]);
  mesh(architecture, "pole", "#f5e8c5", [.16, 2.9, 1.15], [.085, .14, .085]);
  mesh(architecture, "ring", "#f5e8c5", [.26, 2.9, 1.15], [.048, .048, .048]);
  mesh(architecture, "round", wood, [-1.62, 2.85, -.05], [.4, 1.1, .65]);
  for (let i = 0; i < 4; i++) mesh(architecture, "round", ["#8baf96", "#dcab70", "#a88e9c", "#7696a6"][i], [-1.62, 3.02, .04 + i * .1], [.3, .4 - i * .03, .07]);
  // Garden toys, pond, stepping stones and flowers.
  mesh(architecture, "pole", "#e4d3a8", [2.8, .15, 1.8], [1.12, .07, .84]);
  mesh(architecture, "pole", "#8cbec0", [2.8, .19, 1.8], [.95, .045, .68]);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    mesh(architecture, "ball", "#bcc3aa", [2.8 + Math.cos(a), .2, 1.8 + Math.sin(a) * .7], [.23, .13, .2]);
  }
  mesh(architecture, "ball", "#8fa96e", [2.8, .22, 1.65], [.18, .025, .15]);
  for (let i = 0; i < 8; i++) {
    mesh(architecture, "ball", i % 2 ? "#dbcea8" : "#c9bc98", [-1.6 + Math.sin(i) * .2, .17, 3.1 - i * .65], [.25, .065, .19]);
  }
  for (let i = 0; i < 28; i++) {
    const a = i * 2.399;
    const r = 3.45 + (i % 4) * .32;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * .76;
    if (z > 2.5 && Math.abs(x) < 1.2) continue;
    const color = ["#f5ddb0", "#e7b09b", "#e9c675"][i % 3];
    mesh(architecture, "pole", "#739464", [x, .29, z], [.025, .28, .025]);
    for (let p = 0; p < 5; p++) {
      const angle = p / 5 * Math.PI * 2;
      mesh(architecture, "ball", color, [x + Math.cos(angle) * .085, .43, z + Math.sin(angle) * .085], [.075, .05, .075]);
    }
    mesh(architecture, "ball", "#be9862", [x, .46, z], [.042, .033, .042]);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    const x = Math.cos(a) * 4.35, z = Math.sin(a) * 3.2;
    if (z > .8) continue;
    for (let j = 0; j < 3; j++) mesh(architecture, "ball", greens[(j + i) % 5], [x + (j - 1) * .28, .4, z], [.45, .43 + j * .03, .42]);
  }
  // A tiny picnic to the left and lanterns at the stairs.
  mesh(architecture, "round", "#e9bb92", [-3.1, .17, 1.05], [1.35, .035, 1.1], [0, .3, 0]);
  for (let i = 0; i < 5; i++) mesh(architecture, "box", "#f4dfb6", [-3.64 + i * .26, .19, 1.05], [.035, .02, 1.05], [0, .3, 0]);
  mesh(architecture, "round", honey, [-3.4, .42, .6], [.55, .45, .4]);
  mesh(architecture, "ring", wood, [-3.4, .68, .6], [.19, .18, .15]);
  for (const x of [-1.6, .3]) {
    mesh(architecture, "pole", darkWood, [x, .56, 3.4], [.045, .95, .045]);
    mesh(architecture, "round", "#ffdb88", [x, 1.07, 3.4], [.25, .32, .25]);
    mesh(architecture, "cone", wood, [x, 1.3, 3.4], [.24, .19, .24]);
  }
  // Hanging bunting is geometry, keeping the entire artifact asset-free.
  for (let i = 0; i < 8; i++) {
    const x = -2 + i * .6;
    const y = 4.05 - Math.sin(i / 7 * Math.PI) * .38;
    mesh(architecture, "cone", ["#e6b477", "#94b59a", "#deb0a1"][i % 3], [x, y, 2.64], [.115, .28, .018], [0, 0, Math.PI]);
    if (i < 7) beam(architecture, new Vector3(x, y + .15, 2.64), new Vector3(x + .6, 4.2 - Math.sin((i + 1) / 7 * Math.PI) * .38, 2.64), .012, darkWood);
  }

  let staticCount = 0, staticBatches = 0;
  function batchStatic() {
    architecture.updateMatrixWorld(true);
    const buckets = new Map<string, Mesh<BufferGeometry, MeshStandardMaterial>[]>();
    architecture.traverse(object => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      staticCount++;
      const key = `${object.geometry.uuid}:${object.material.uuid}`;
      const bucket = buckets.get(key) || [];
      bucket.push(object);
      buckets.set(key, bucket);
    });
    if (baseline) { staticBatches = staticCount; return; }
    const inverse = new Matrix4().copy(architecture.matrixWorld).invert();
    const matrix = new Matrix4();
    for (const items of buckets.values()) {
      const batch = new InstancedMesh(items[0].geometry, items[0].material, items.length);
      batch.castShadow = true;
      batch.receiveShadow = true;
      items.forEach((item, i) => {
        batch.setMatrixAt(i, matrix.multiplyMatrices(inverse, item.matrixWorld));
        item.removeFromParent();
      });
      architecture.add(batch);
      staticBatches++;
    }
  }
  batchStatic();

  const residents = new Map<string, Resident>();
  let completedGames: Game[] = [];
  let selected: string | null = null;
  let arrivalId: string | null = null;
  const slots = [[-2.9, .18, 2.45], [1.72, 2.38, 1.48], [-1.52, 2.38, 1.52], [2.25, .19, 3.0], [.65, .18, 3.45], [3.72, .2, .7],
    [-3.75, .18, 1.15], [-2.5, .18, 3.3], [1.25, .18, 2.35], [3.4, .18, 2.5], [.65, 2.38, 1.78], [-.45, 2.38, 1.58]];
  const contactMat = new MeshBasicMaterial({ color: "#5c6645", transparent: true, opacity: .17, depthWrite: false });
  basicMaterials.push(contactMat);
  function makeResident(game: Game, index: number): Resident {
    const root = new Group();
    const [x, y, z] = slots[index % slots.length];
    root.position.set(x, y, z);
    root.scale.setScalar(.85);
    root.rotation.y = .22;
    island.add(root);
    mesh(root, "ball", game.accent, [0, .42, 0], [.32, .36, .24]);
    mesh(root, "ball", "#f5e5c4", [0, .48, .212], [.16, .18, .045]);
    for (const side of [-1, 1]) {
      mesh(root, "ball", game.color, [side * .17, .12, .08], [.12, .13, .17]);
      mesh(root, "ball", game.color, [side * .32, .48, 0], [.12, .21, .13], [0, 0, side * .2]);
    }
    const arm = new Group();
    arm.position.set(-.33, .58, 0);
    mesh(arm, "ball", game.color, [0, -.07, 0], [.12, .2, .13]);
    root.add(arm);
    const head = new Group();
    head.position.y = .88;
    root.add(head);
    mesh(head, "ball", game.color, [0, 0, 0], [.42, .37, .34]);
    const earShape = game.kind === "fox" || game.kind === "cat" ? "cone" : "ball";
    if (game.kind !== "bird") for (const side of [-1, 1]) {
      const isBunny = game.kind === "bunny";
      mesh(head, earShape, game.color, [side * .25, isBunny ? .46 : .3, -.035], [isBunny ? .105 : .15, isBunny ? .33 : .19, .12], [0, 0, -side * .18]);
      if (game.kind !== "frog") mesh(head, earShape, "#edc4b3", [side * .25, isBunny ? .46 : .3, .042], [isBunny ? .06 : .085, isBunny ? .24 : .1, .055], [0, 0, -side * .18]);
    }
    if (game.kind === "bird") {
      mesh(head, "cone", "#e5ad55", [0, -.02, .34], [.12, .21, .1], [Math.PI / 2, 0, 0]);
      mesh(head, "ball", game.accent, [0, .33, -.08], [.095, .2, .13], [0, 0, -.3]);
    } else {
      mesh(head, "ball", "#f5e5c4", [0, -.08, .27], [.23, .14, .11]);
      mesh(head, "ball", "#4b5140", [0, -.025, .382], [.045, .032, .027]);
    }
    for (const side of [-1, 1]) {
      const eye = mesh(head, "ball", "#353e32", [side * .145, .052, .308], [.035, .05, .028]);
      eye.name = "eye";
      mesh(head, "ball", "#fff3d8", [side * .15 - .009, .067, .333], [.011, .012, .009]);
      mesh(head, "ball", "#dfa295", [side * .245, -.069, .281], [.054, .029, .017]);
    }
    if (game.kind === "fox") mesh(root, "ball", game.color, [.25, .34, -.27], [.17, .24, .27], [.5, 0, -.5]);
    // A leaf-shaped keepsake makes the residents original and cohesive.
    mesh(head, "ball", "#719369", [.11, .35, .07], [.1, .055, .2], [0, 0, -.5]);
    root.traverse(object => {
      if (object instanceof Mesh) { object.castShadow = false; object.receiveShadow = true; }
      object.userData.gameId = game.id;
    });
    const contact = new Mesh(shadowGeometry, contactMat);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = -.005;
    contact.scale.set(.4, .3, 1);
    root.add(contact);
    return { root, head, arm, id: game.id, phase: index * 1.9, birth: -10, base: root.position.clone() };
  }

  const pollen = new Group();
  island.add(pollen);
  const pollenMat = new MeshBasicMaterial({ color: "#fff2b5", transparent: true, opacity: .8 });
  basicMaterials.push(pollenMat);
  const motes = new InstancedMesh(geometry("ball"), pollenMat, 18);
  motes.frustumCulled = false;
  pollen.add(motes);
  const dummy = new Object3D();
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let width = 1, height = 1, angle = .55, desiredAngle = .55, zoom = 1, desiredZoom = 1;
  let view: View = "treehouse", night = false, enabledMotion = motionEnabled;
  let disposed = false, intersecting = true, dirty = true, last = 0, clock = 0, dragDistance = 0;
  let dragging = false, startX = 0, startAngle = 0;
  const backend = forceWebGL || !("isWebGPUBackend" in renderer.backend) ? "WebGL2 fallback" : "WebGPU";
  const metrics = {
    backend, draws: 0, triangles: 0, frames: 0, frameIntervals: [] as number[],
    renderTimes: [] as number[], staticMeshes: staticCount, staticBatches,
    pixelRatio: renderer.getPixelRatio(), readyMs: 0, residents: 0,
  };
  window.treehouseMetrics = metrics;
  function resize() {
    width = canvas.clientWidth; height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const extent = width < 640 ? 7.3 : 7.1;
    const aspect = width / height;
    camera.left = -extent * aspect; camera.right = extent * aspect;
    camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(entries => {
    intersecting = entries[0].isIntersecting;
    last = 0; dirty = true;
  });
  intersection.observe(canvas);
  function visibility() { last = 0; dirty = true; }
  document.addEventListener("visibilitychange", visibility);
  function down(event: PointerEvent) {
    dragging = true; startX = event.clientX; startAngle = desiredAngle; dragDistance = 0;
    canvas.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!dragging) return;
    dragDistance = Math.max(dragDistance, Math.abs(event.clientX - startX));
    desiredAngle = Math.max(-.65, Math.min(1.1, startAngle - (event.clientX - startX) * .006));
    dirty = true;
  }
  function up(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (dragDistance > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = [...residents.values()].map(r => r.root);
    const hit = raycaster.intersectObjects(targets, true)[0];
    if (hit) onSelect(hit.object.userData.gameId);
  }
  function cancel() { dragging = false; }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);

  const world: World = {
    update(games, arrival) {
      completedGames = games.filter(g => g.status === "completed");
      const completed = completedGames.slice(0, slots.length);
      // A bounded diorama stays readable; selecting any roster member brings them in.
      const guest = completedGames.find(g => g.id === (arrival || selected));
      if (guest && !completed.some(g => g.id === guest.id)) completed[completed.length - 1] = guest;
      for (const [id, resident] of residents) {
        if (!completed.some(g => g.id === id)) { resident.root.removeFromParent(); residents.delete(id); }
      }
      completed.forEach((game, i) => {
        if (!residents.has(game.id)) {
          const resident = makeResident(game, i);
          if (arrival === game.id) { resident.birth = clock; arrivalId = game.id; }
          residents.set(game.id, resident);
        }
      });
      metrics.residents = residents.size;
      dirty = true;
    },
    setView(nextView) { view = nextView; dirty = true; },
    select(id) { selected = id; world.update(completedGames, null); dirty = true; },
    rotate(direction) { desiredAngle = Math.max(-.65, Math.min(1.1, desiredAngle + direction * .25)); dirty = true; },
    zoom(direction) { desiredZoom = Math.max(.8, Math.min(1.45, desiredZoom + direction * .15)); dirty = true; },
    home() { desiredAngle = .55; desiredZoom = 1; dirty = true; },
    setNight(value) {
      night = value;
      ambient.color.set(value ? "#a5c7c8" : "#fff7d9");
      ambient.intensity = value ? 1.5 : 2.2;
      sun.color.set(value ? "#c0d6df" : "#fff0c8");
      sun.intensity = value ? 1.45 : 2.4;
      windowMat.emissiveIntensity = value ? 1.5 : .55;
      dirty = true;
    },
    setMotion(value) { enabledMotion = value; dirty = true; },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", cancel);
      scene.traverse(object => { if (object instanceof InstancedMesh) object.dispose(); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      basicMaterials.forEach(m => m.dispose()); shadowTexture.dispose();
      renderer.dispose();
      if (window.treehouseMetrics === metrics) delete window.treehouseMetrics;
    },
  };
  renderer.onDeviceLost = info => {
    if (disposed) return;
    renderer.setAnimationLoop(null);
    console.error("Treehouse graphics device was lost", info);
    onFailure("The graphics connection was interrupted. Your library is safe; reload to reopen the treehouse.");
  };
  world.update(initialGames, null);
  resize();
  try {
    await renderer.compileAsync(scene, camera);
  } catch (error) {
    world.dispose();
    throw error;
  }
  metrics.readyMs = performance.now() - start;
  onReady(backend);
  renderer.setAnimationLoop((time: number) => {
    if (disposed || (!baseline && (document.hidden || !intersecting || view !== "treehouse"))) { last = 0; return; }
    const movingCamera = Math.abs(angle - desiredAngle) > .001 || Math.abs(zoom - desiredZoom) > .001;
    if (!enabledMotion && !dirty && !movingCamera) return;
    if (!baseline && last && time - last < 1000 / 31) return;
    const dt = last ? Math.min((time - last) / 1000, .08) : 1 / 30;
    if (last) {
      metrics.frameIntervals.push(time - last);
      if (metrics.frameIntervals.length > 240) metrics.frameIntervals.shift();
    }
    last = time; clock += dt;
    angle += (desiredAngle - angle) * (enabledMotion ? .15 : 1);
    zoom += (desiredZoom - zoom) * (enabledMotion ? .15 : 1);
    camera.position.set(Math.sin(angle) * 17, 11, Math.cos(angle) * 17);
    camera.zoom = zoom;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    for (const resident of residents.values()) {
      const t = enabledMotion ? clock : 0;
      const wave = selected === resident.id;
      resident.head.rotation.z = Math.sin(t * 1.1 + resident.phase) * .035;
      resident.arm.rotation.z = wave ? -.65 + Math.sin(t * 5) * .2 : .12;
      resident.root.position.y = resident.base.y + (enabledMotion ? Math.sin(t * 1.8 + resident.phase) * .012 : 0);
      resident.head.children.forEach(child => {
        if (child.name === "eye") child.scale.y = .05 * (Math.sin(t * .75 + resident.phase) > .996 ? .12 : 1);
      });
      const age = clock - resident.birth;
      const scale = !enabledMotion || age >= 1.1 ? 1 : Math.max(.001, 1 - Math.exp(-age * 6) * Math.cos(age * 8));
      resident.root.scale.setScalar(.85 * scale);
    }
    const arriving = arrivalId ? residents.get(arrivalId) : undefined;
    const age = arriving ? clock - arriving.birth : 10;
    for (let i = 0; i < 18; i++) {
      const isArrival = arriving && age < 1.6 && enabledMotion;
      const a = i * 2.399 + clock * .08;
      const r = isArrival ? age * 1.35 : 3.5 + Math.sin(i * 5) * .8;
      dummy.position.set(
        (isArrival ? arriving.base.x : 0) + Math.cos(a) * r,
        isArrival ? arriving.base.y + age * 1.8 - age * age * .6 + .4 : .8 + ((i * .41 + clock * .045) % 4.5),
        (isArrival ? arriving.base.z : 0) + Math.sin(a) * r * .65,
      );
      dummy.scale.setScalar(!enabledMotion ? 0 : isArrival ? .032 * Math.max(0, 1 - age / 1.6) : night ? .023 : .014);
      dummy.updateMatrix(); motes.setMatrixAt(i, dummy.matrix);
    }
    motes.instanceMatrix.needsUpdate = true;
    const renderStart = performance.now();
    try {
      renderer.render(scene, camera);
    } catch (error) {
      renderer.setAnimationLoop(null);
      console.error("Treehouse renderer stopped", error);
      onFailure("The 3D view stopped. Your library is safe; reload to try again.");
      return;
    }
    metrics.renderTimes.push(performance.now() - renderStart);
    if (metrics.renderTimes.length > 240) metrics.renderTimes.shift();
    metrics.frames++; metrics.draws = renderer.info.render.drawCalls; metrics.triangles = renderer.info.render.triangles;
    dirty = false;
  });
  return world;
}
