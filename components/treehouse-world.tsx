'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Script from 'next/script';

export interface GameData {
  id: number;
  title: string;
  genre: 'rpg' | 'adventure' | 'platformer' | 'action' | 'sim' | 'horror' | 'rhythm';
  color: string;
  floor: 0 | 1;
}

export interface TreehouseWorldHandle {
  exitFocus: () => void;
  focusStep: (dir: -1 | 1) => void;
}

interface Props {
  games: GameData[];
  onAvatarSelect: (idx: number) => void;
  focusIdx?: number;
}

// ── constants ────────────────────────────────────────────────────────────────
const GENRE_ICON: Record<string, string> = {
  rpg: '⚔️', adventure: '🗺️', platformer: '🎮', action: '🔥',
  horror: '💀', rhythm: '🎵', sim: '🌱',
};
const GENRE_COLOR: Record<string, string> = {
  rpg: '#6B2FA0', adventure: '#1A5C3A', platformer: '#1565C0',
  action: '#8B3000', horror: '#3A0A0A', rhythm: '#880E4F', sim: '#2E7D32',
};

// ── helpers (run client-side after THREE loads) ───────────────────────────────
function buildScene(
  canvas: HTMLCanvasElement,
  games: GameData[],
  onAvatarSelect: (idx: number) => void,
) {
  const THREE = (window as any).THREE;
  if (!THREE) return null;

  // ── renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2A1810');
  scene.fog = new THREE.FogExp2('#2D4A1A', 0.018);

  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 300);
  const CAM_ORBIT = { pos: new THREE.Vector3(2, 8, 14), target: new THREE.Vector3(0, 3, 0) };
  camera.position.copy(CAM_ORBIT.pos);

  const controls = new (window as any).THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 5;
  controls.maxDistance = 22;
  controls.target.copy(CAM_ORBIT.target);
  controls.update();

  // ── lighting ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight('#8FBF6A', 0.6));
  const sun = new THREE.DirectionalLight('#FFF5DC', 1.4);
  sun.position.set(8, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;  sun.shadow.camera.bottom = -20;
  scene.add(sun);
  const fire = new THREE.PointLight('#FF6B35', 2.5, 12);
  fire.position.set(-5, 1.5, -4);
  scene.add(fire);
  const lamp = new THREE.PointLight('#FFE4A0', 1.8, 10);
  lamp.position.set(0, 6.5, 0);
  scene.add(lamp);
  scene.add(new THREE.DirectionalLight('#C8E8FF', 0.4)).position.set(10, 8, -8);

  // ── material helpers ───────────────────────────────────────────────────
  const mWood = (c = '#6B4423', r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const mStd  = (c: string, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const mLeaf = () => new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.9, metalness: 0, side: THREE.DoubleSide });

  function hexRgb(h: string) {
    return { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) };
  }
  function darken(h: string, f: number) {
    const { r, g, b } = hexRgb(h);
    return '#' + [r, g, b].map(v => Math.floor(v * f).toString(16).padStart(2,'0')).join('');
  }

  // ── architecture ──────────────────────────────────────────────────────
  const add = (m: any) => { scene.add(m); return m; };

  // floors
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,0.3,14), mWood('#7A4F2A',0.85)), { receiveShadow:true, castShadow:true })).position.set(0,0,0);
  const floor1 = add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(9,0.3,7), mWood('#6B4423',0.9)), { receiveShadow:true, castShadow:true }));
  floor1.position.set(-4.5,6,-1);

  // rug
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,0.04,32), mStd('#4A7C3F',0.95))).position.set(0.5,0.17,1);
  const rugRing = add(new THREE.Mesh(new THREE.RingGeometry(2.4,2.8,32), mStd('#7FB069',0.95)));
  rugRing.rotation.x = -Math.PI/2; rugRing.position.set(0.5,0.19,1);

  // loft railing
  for (let i=0;i<5;i++) {
    const post = add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,0.12), mWood('#5A3A1A')), {castShadow:true}));
    post.position.set(-0.5+i*1.8, 6.75, 2.3);
  }
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(7.2,0.12,0.12), mWood('#5A3A1A')), {castShadow:true})).position.set(-4.5,7.35,2.3);

  // ladder
  const lrMat = mWood('#5A3A1A',0.9);
  const lr1 = add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,7.2,0.1), lrMat), {castShadow:true}));
  lr1.position.set(-0.9,3.2,2.0); lr1.rotation.z = 0.25;
  const lr2 = add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,7.2,0.1), lrMat), {castShadow:true}));
  lr2.position.set(0.1,3.2,2.0); lr2.rotation.z = -0.25;
  for (let i=0;i<7;i++) {
    add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.09,0.09), lrMat), {castShadow:true})).position.set(-0.4, 0.7+i*0.9, 2.0);
  }

  // walls
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,10,0.3), mStd('#8B6F47',0.85)), {receiveShadow:true})).position.set(0,5,-7);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.3,10,14), mStd('#8B6F47',0.85)), {receiveShadow:true})).position.set(-9,5,0);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(9,6,0.3), mStd('#7A5F3A',0.85)), {receiveShadow:true})).position.set(-4.5,9.2,-4.5);

  // window
  add(new THREE.Mesh(new THREE.PlaneGeometry(6,5), new THREE.MeshBasicMaterial({color:'#87CEEB'}))).position.set(5,5,-7.2);
  add(new THREE.Mesh(new THREE.ConeGeometry(2,3,5), mStd('#5B7A4A',0.9))).position.set(4,3.5,-7.15);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.5,2.5,5), mStd('#6B8A5A',0.9))).position.set(6.5,3,-7.15);
  const wfM = mWood('#4A2E0A',0.9);
  [[6.2,0.2,0.3,5,7.4,-6.8],[6.2,0.2,0.3,5,4.8,-6.8],[0.2,2.8,0.3,2,-6.1,-6.8],[0.2,2.8,0.3,8,-6.1,-6.8]].forEach(([w,h,d,x,y,z]) => {
    add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wfM), {castShadow:true})).position.set(x,y,z);
  });

  // window seat
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(5.5,0.3,1.0), mWood('#6B4423',0.85)), {castShadow:true,receiveShadow:true})).position.set(5,0.45,-6.5);

  // tree trunk + canopy
  add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,14,10), mWood('#4A2E0A',0.95)), {castShadow:true,receiveShadow:true})).position.set(-7,5,3);
  const branch1 = add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.4,8,8), mWood('#5A3A1A',0.9)), {castShadow:true}));
  branch1.rotation.z = -0.5; branch1.position.set(-4.5,9,3);
  [[0,13,3,3.5],[-3,13,2,3],[-6,11,4,2.5],[-2,14,4,2],[1,12,2,3.2]].forEach(([x,y,z,r]) => {
    add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(r,8,6), mLeaf()), {castShadow:true})).position.set(x,y,z);
  });

  // ceiling beams
  const beamMat = mWood('#5A3A1A',0.85);
  for (let i=0;i<4;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,0.25,0.25), beamMat), {castShadow:true})).position.set(0,9.5,-3+i*2.2);
  for (let i=0;i<3;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.25,0.25,14), beamMat), {castShadow:true})).position.set(-4+i*5,9.5,0);

  // pendant lamp
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2,6), mStd('#2A1A0A',0.9))).position.set(0,8,0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.7,0.5,12), mStd('#4A3000',0.7))).position.set(0,6.8,0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), new THREE.MeshBasicMaterial({color:'#FFE4A0'}))).position.set(0,6.6,0);

  // fireplace
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.4,2.2,0.6), mStd('#6B6B6B',0.95)), {castShadow:true})).position.set(-5,1.2,-6.75);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,0.4), mStd('#1A1A1A',1))).position.set(-5,1.0,-6.65);
  const flame  = add(new THREE.Mesh(new THREE.ConeGeometry(0.35,0.8,6), new THREE.MeshBasicMaterial({color:'#FF6B35'})));
  flame.position.set(-5,1.2,-6.55);
  const flame2 = add(new THREE.Mesh(new THREE.ConeGeometry(0.2,0.55,5), new THREE.MeshBasicMaterial({color:'#FFD700'})));
  flame2.position.set(-5,1.35,-6.55);

  // right railing
  for (let i=0;i<7;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,1.1,0.1), mWood('#5A3A1A')), {castShadow:true})).position.set(8.8,0.8,-3+i*1.0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,7), mWood('#4A2E0A'))).position.set(8.8,1.35,0);

  // ── cartridge builder ─────────────────────────────────────────────────
  function buildLabel(title: string, genre: string, color: string) {
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 256;
    const ctx = cv.getContext('2d')!;
    const base = GENRE_COLOR[genre] || color;
    const { r, g, b } = hexRgb(base);
    ctx.fillStyle = `rgb(${Math.min(255,r+55)},${Math.min(255,g+55)},${Math.min(255,b+55)})`;
    ctx.fillRect(0,0,192,256);
    const gr = ctx.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,'rgba(255,255,255,0.15)'); gr.addColorStop(1,'rgba(0,0,0,0.3)');
    ctx.fillStyle = gr; ctx.fillRect(0,0,192,256);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.setLineDash([8,5]);
    ctx.strokeRect(6,6,180,244); ctx.setLineDash([]);
    ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.fillText(GENRE_ICON[genre]||'🎮',96,78);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 19px sans-serif';
    const words = title.split(' '); let lines: string[] = []; let line = '';
    for (const w of words) {
      const t = line ? line+' '+w : w;
      if (ctx.measureText(t).width > 158 && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    lines.forEach((l,i) => ctx.fillText(l,96,130+i*25));
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(genre.toUpperCase(),96,198);
    return cv;
  }

  function createCartridge(g: GameData) {
    const grp = new THREE.Group();
    const bM = new THREE.MeshStandardMaterial({color:g.color,roughness:0.4,metalness:0.15});
    const lM = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(buildLabel(g.title,g.genre,g.color)),roughness:0.4});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.0,0.26),[bM,bM,bM,bM,lM,bM]);
    body.castShadow = true; body.receiveShadow = true; grp.add(body);
    grp.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.27,0.15,0.22), new THREE.MeshStandardMaterial({color:darken(g.color,0.78),roughness:0.45})), {})).position.set(0,0.56,0);
    const eM = new THREE.MeshStandardMaterial({color:'#fff',roughness:0.3});
    const pM = new THREE.MeshStandardMaterial({color:'#111',roughness:0.5});
    [-0.12,0.12].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055,10,10), eM); e.position.set(x,0.15,0.14); grp.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8), pM);  p.position.set(x,0.15,0.165); grp.add(p);
    });
    const sm = new THREE.Mesh(new THREE.TorusGeometry(0.1,0.02,8,12,Math.PI), eM);
    sm.rotation.z = Math.PI; sm.position.set(0,0.04,0.135); grp.add(sm);
    const rM = new THREE.MeshStandardMaterial({color:darken(g.color,0.58),roughness:0.6});
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.66,0.13,0.20), rM)).position.set(0,-0.54,0);
    const pinM = new THREE.MeshStandardMaterial({color:'#888',roughness:0.3,metalness:0.8});
    [-0.24,-0.12,0,0.12,0.24].forEach(px => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.04), pinM); p.position.set(px,-0.50,-0.02); grp.add(p);
    });
    const lgM = new THREE.MeshStandardMaterial({color:darken(g.color,0.68),roughness:0.7});
    const shM = new THREE.MeshStandardMaterial({color:darken(g.color,0.74),roughness:0.65});
    [-0.2,0.2].forEach(x => {
      const lg = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.22,0.16), lgM); lg.position.set(x,-0.73,0); lg.castShadow=true; grp.add(lg);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.08,0.22), shM); sh.position.set(x,-0.86,0.03); sh.castShadow=true; grp.add(sh);
    });
    return grp;
  }

  // ── place cartridges ───────────────────────────────────────────────────
  const SPAWN0 = [{x:1.5,z:2.5},{x:-3.5,z:1.5},{x:2.5,z:0.5},{x:6.5,z:-1.0},{x:-1.0,z:3.8},{x:3.5,z:-2.5},{x:0.5,z:-2.0}];
  const SPAWN1 = [{x:-5.0,z:-2.5},{x:-3.0,z:-1.5}];
  const BOUNDS0 = {xMin:-7.5,xMax:7.5,zMin:-5.5,zMax:5.5};
  const BOUNDS1 = {xMin:-8.5,xMax:-0.5,zMin:-4.5,zMax:2};

  const cartridges: any[] = [];
  let ci = 0;
  games.forEach(g => {
    const c = createCartridge(g);
    const sp = g.floor===1 ? SPAWN1[ci%SPAWN1.length] : SPAWN0[ci%SPAWN0.length];
    const fy = g.floor===1 ? 6.29 : 0.15;
    c.position.set(sp.x, fy+0.86, sp.z);
    c.userData = {
      id: g.id, title: g.title, genre: g.genre,
      baseY: fy+0.86, phase: Math.random()*Math.PI*2,
      behavior: g.floor===1 ? 'loft_idle' : 'wander',
      wanderTarget: new THREE.Vector3(sp.x, fy+0.86, sp.z),
      wanderTimer: Math.random()*4+2,
      floor: g.floor,
      angle: Math.random()*Math.PI*2,
      angleTarget: Math.random()*Math.PI*2,
    };
    scene.add(c); cartridges.push(c); ci++;
  });

  // ── glow ring + focus light ────────────────────────────────────────────
  let glowRing: any = null;
  let focusLight: any = null;

  function setGlowRing(cartridge: any) {
    if (glowRing?.parent) glowRing.parent.remove(glowRing);
    if (focusLight) { scene.remove(focusLight); focusLight = null; }
    if (!cartridge) return;
    glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({color:'#FFD700', transparent:true, opacity:0})
    );
    cartridge.add(glowRing);
    focusLight = new THREE.PointLight('#FFD700', 0, 6);
    scene.add(focusLight);
    const t0 = performance.now();
    function fadeIn() {
      const p = Math.min((performance.now()-t0)/400,1);
      glowRing.material.opacity = p * 0.9;
      if (focusLight) focusLight.intensity = p * 3.5;
      if (p < 1) requestAnimationFrame(fadeIn);
    }
    fadeIn();
  }

  // ── focus / camera ─────────────────────────────────────────────────────
  let focusMode = false;
  let currentFocusIdx = 0;
  let camAnim: any = null;

  function animCam(toP: any, toT: any, dur: number) {
    const sP = camera.position.clone(); const sT = controls.target.clone();
    camAnim = { toP, toT, sP, sT, t0: performance.now(), dur };
  }

  function enterFocus(idx: number) {
    currentFocusIdx = ((idx % cartridges.length) + cartridges.length) % cartridges.length;
    const c = cartridges[currentFocusIdx];
    focusMode = true;
    controls.enabled = false;
    const wp = new THREE.Vector3(); c.getWorldPosition(wp);
    animCam(wp.clone().add(new THREE.Vector3(1.4,1.8,3.8)), wp.clone().add(new THREE.Vector3(0,0.5,0)), 550);
    setGlowRing(c);
    onAvatarSelect(currentFocusIdx);
  }

  function exitFocus() {
    focusMode = false;
    controls.enabled = true;
    setGlowRing(null);
    animCam(CAM_ORBIT.pos, CAM_ORBIT.target, 600);
  }

  function focusStep(dir: -1 | 1) {
    currentFocusIdx = ((currentFocusIdx + dir) % cartridges.length + cartridges.length) % cartridges.length;
    const c = cartridges[currentFocusIdx];
    const wp = new THREE.Vector3(); c.getWorldPosition(wp);
    animCam(wp.clone().add(new THREE.Vector3(1.4,1.8,3.8)), wp.clone().add(new THREE.Vector3(0,0.5,0)), 400);
    setGlowRing(c);
    onAvatarSelect(currentFocusIdx);
  }

  // ── raycaster ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredC: any = null;

  function getC(hits: any[]) {
    for (const h of hits) { let o = h.object; while(o) { if(o.userData?.id !== undefined) return o; o = o.parent; } }
  }
  function castAt(cx: number, cy: number) {
    mouse.x = (cx/canvas.clientWidth)*2-1; mouse.y = -(cy/canvas.clientHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(scene.children, true);
  }

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (focusMode) return;
    hoveredC = getC(castAt(e.offsetX, e.offsetY)) || null;
    canvas.style.cursor = hoveredC ? 'pointer' : 'default';
  });
  canvas.addEventListener('click', (e: MouseEvent) => {
    if (focusMode) return;
    const h = getC(castAt(e.offsetX, e.offsetY));
    if (h) { const idx = cartridges.indexOf(h); if (idx >= 0) enterFocus(idx); }
  });
  let touchStart: any = null;
  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length===1) touchStart = {x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};
  }, {passive:true});
  canvas.addEventListener('touchend', (e: TouchEvent) => {
    if (!touchStart) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.hypot(dx,dy)<12 && Date.now()-touchStart.t<260) {
      const cx = e.changedTouches[0].clientX - rect.left, cy = e.changedTouches[0].clientY - rect.top;
      if (!focusMode) { const h = getC(castAt(cx,cy)); if (h) { const idx = cartridges.indexOf(h); if (idx>=0) enterFocus(idx); } }
    }
    touchStart = null;
  }, {passive:true});

  // ── render loop ────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let animId: number;

  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    // camera tween
    if (camAnim) {
      const prog = Math.min((performance.now()-camAnim.t0)/camAnim.dur,1);
      const ease = prog<0.5 ? 4*prog*prog*prog : 1-Math.pow(-2*prog+2,3)/2;
      camera.position.lerpVectors(camAnim.sP, camAnim.toP, ease);
      controls.target.lerpVectors(camAnim.sT, camAnim.toT, ease);
      if (prog>=1) camAnim = null;
    }

    // fire flicker
    flame.scale.y  = 0.85+Math.sin(t*8)*0.15+Math.random()*0.08;
    flame2.scale.y = 0.8+Math.sin(t*11)*0.2;
    fire.intensity = 2.0+Math.sin(t*6)*0.5+Math.sin(t*3.3)*0.3;
    lamp.intensity = 1.6+Math.sin(t*0.8)*0.2;

    // focus light tracking
    if (focusLight && cartridges[currentFocusIdx]) {
      const wp = new THREE.Vector3(); cartridges[currentFocusIdx].getWorldPosition(wp);
      focusLight.position.set(wp.x, wp.y+2.5, wp.z);
    }

    // cartridge behaviors
    cartridges.forEach(c => {
      const d = c.userData;
      const t_ = t + d.phase;
      const bobAmp = 0.055;
      c.position.y = d.baseY + Math.sin(t_*1.3)*bobAmp;

      if (d.behavior==='wander') {
        d.wanderTimer -= dt;
        if (d.wanderTimer < 0) {
          d.wanderTimer = 3+Math.random()*5;
          const b = d.floor===1 ? BOUNDS1 : BOUNDS0;
          d.wanderTarget.set(b.xMin+Math.random()*(b.xMax-b.xMin), d.baseY+0.86, b.zMin+Math.random()*(b.zMax-b.zMin));
          d.angleTarget = Math.atan2(d.wanderTarget.x-c.position.x, d.wanderTarget.z-c.position.z);
        }
        const dx2 = d.wanderTarget.x-c.position.x, dz2 = d.wanderTarget.z-c.position.z;
        const dist = Math.sqrt(dx2*dx2+dz2*dz2);
        if (dist>0.3) { const spd=0.6*dt; c.position.x+=dx2/dist*spd; c.position.z+=dz2/dist*spd; }
        d.angle += (d.angleTarget-d.angle)*0.08;
        c.rotation.y = d.angle;
        c.scale.x = 1+Math.sin(t_*6)*0.04;
      } else if (d.behavior==='loft_idle') {
        c.rotation.y += 0.003;
      }

      const targetS = c===hoveredC ? 1.12 : 1.0;
      c.scale.y += (targetS-c.scale.y)*0.12;
      if (d.behavior!=='wander') { c.scale.x+=(targetS-c.scale.x)*0.12; c.scale.z+=(targetS-c.scale.z)*0.12; }
    });

    renderer.render(scene, camera);
  }
  animate();

  // ── resize ─────────────────────────────────────────────────────────────
  function onResize() {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    dispose: () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
    exitFocus,
    focusStep,
  };
}

// ── component ─────────────────────────────────────────────────────────────────
const TreehouseWorld = forwardRef<TreehouseWorldHandle, Props>(function TreehouseWorld(
  { games, onAvatarSelect },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef  = useRef<ReturnType<typeof buildScene>>(null);
  const threeReady = useRef(false);

  function tryInit() {
    if (!(window as any).THREE || !(window as any).THREE.OrbitControls) return;
    if (threeReady.current) return;
    if (!canvasRef.current) return;
    threeReady.current = true;
    (sceneRef as any).current = buildScene(canvasRef.current, games, onAvatarSelect);
  }

  useEffect(() => {
    // Poll until THREE + OrbitControls are loaded (CDN scripts)
    const interval = setInterval(() => {
      if ((window as any).THREE?.OrbitControls) { clearInterval(interval); tryInit(); }
    }, 100);
    return () => {
      clearInterval(interval);
      sceneRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    exitFocus: () => sceneRef.current?.exitFocus(),
    focusStep: (dir) => sceneRef.current?.focusStep(dir),
  }));

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          // OrbitControls loads after Three
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"
        strategy="afterInteractive"
        onLoad={tryInit}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </>
  );
});

export default TreehouseWorld;
