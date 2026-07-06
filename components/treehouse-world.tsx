'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Script from 'next/script';

export interface GameData {
  id: number;
  title: string;
  genre: 'rpg' | 'adventure' | 'platformer' | 'action' | 'sim' | 'horror' | 'rhythm';
  color: string;
  floor: 0 | 1;
  coverUrl?: string;
  completedAt?: string;
  totalMinutes?: number;
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

// ── module-level config ──────────────────────────────────────────────────────
const GENRE_ICON: Record<string, string> = {
  rpg: '⚔️', adventure: '🗺️', platformer: '🎮', action: '🔥',
  horror: '💀', rhythm: '🎵', sim: '🌱',
};
const GENRE_COLOR: Record<string, string> = {
  rpg: '#6B2FA0', adventure: '#1A5C3A', platformer: '#1565C0',
  action: '#8B3000', horror: '#3A0A0A', rhythm: '#880E4F', sim: '#2E7D32',
};
const REACTIONS: Record<string, string> = {
  rpg: 'Legendary! ⚔️', adventure: 'Explored! 🗺️', platformer: 'Mastered! 🎮',
  action: 'Blazed! 🔥', horror: 'Survived! 💀', rhythm: 'In tune! 🎵', sim: 'Thriving! 🌱',
};
const BUDDY_VOICE: Record<string, string[]> = {
  'Elden Ring':      ['died 847 times. loved it 💀','malenia took 3 weeks 😤','maidenless no more 🏆','lore goes 40 layers deep'],
  'Hollow Knight':   ['mantis lords broke me','this map goes FOREVER','silksong when 👀','pale king backstory 😭'],
  'Celeste':         ['b-sides hit different 🏔️','every death was a lesson','made me cry ngl','madeline my beloved'],
  'Hades':           ['one more run 🔥','dialogue never repeats','got out on run 48','zagreus you crazy kid'],
  'Disco Elysium':   ['harry du bois is me 🥃','failed the check. worth it','rewired my brain 📖','the ideology check 😭'],
  'Undertale':       ['genocide route gave me guilt','sans got me good 💀','papyrus NYEH HEH HEH','flowey was right'],
  'Into the Breach': ['perfect run finally 🎯','the grid is everything','time loop got me','turn 1 i always mess up'],
  'Stardew Valley':  ['never leaving pelican town 🌱','pierre needs to chill','year 3 still farming','harvey is the goat'],
  'Cuphead':         ['king dice is EVIL 😤','that animation tho 🎨','finally cleared world 3','root beer boss = 4hrs'],
};
const EMOTE_POOL = ['🎮','❤️','⭐','💥','✨','👾','🏆','😄','🎯','💬'];

// ── buildScene ───────────────────────────────────────────────────────────────
function buildScene(
  canvas: HTMLCanvasElement,
  games: GameData[],
  onAvatarSelect: (idx: number) => void,
): { dispose(): void; exitFocus(): void; focusStep(dir: -1 | 1): void } {
  const THREE = (window as any).THREE;
  if (!THREE) return { dispose() {}, exitFocus() {}, focusStep() {} };

  const domElements: HTMLElement[] = [];

  /* PART1 */

  // ── renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0E1A08');
  scene.fog = new THREE.FogExp2('#1A2E10', 0.022);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  const CAM = {
    orbit: { pos: new THREE.Vector3(2,6,11),  target: new THREE.Vector3(0,2,0) },
    side:  { pos: new THREE.Vector3(0,3,13),  target: new THREE.Vector3(0,2.5,0) },
    loft:  { pos: new THREE.Vector3(-2,11,8), target: new THREE.Vector3(0,7,0) },
  };
  camera.position.copy(CAM.orbit.pos);

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 5; controls.maxDistance = 22;
  controls.target.copy(CAM.orbit.target); controls.update();

  // ── grade/bloom pipeline ──────────────────────────────────────────────────
  const sharedUniforms = { uTime: { value: 0 } };

  function createGradePass() {
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.50, 0.75);
    composer.addPass(bloom);
    const gradeVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`;
    const gradeFrag = `
      uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        c = c * vec3(1.06,1.02,0.97) + vec3(0.012,0.010,0.018)*(1.0-c);
        float luma = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(luma), c, 1.14);
        c = pow(max(c,0.0), vec3(0.95));
        vec2 uv2 = vUv*2.0-1.0;
        float vig = 1.0-smoothstep(0.52,1.45,length(uv2*vec2(0.82,1.0)));
        c *= 0.78+0.22*vig;
        float grain = fract(sin(dot(vUv*1024.0,vec2(12.9898,78.233))+uTime*0.07)*43758.5453);
        c += (grain-0.5)*0.010;
        gl_FragColor = vec4(clamp(c,0.0,1.0),1.0);
      }`;
    const gradePass = new THREE.ShaderPass({ uniforms:{ tDiffuse:{value:null}, uTime:{value:0} }, vertexShader:gradeVert, fragmentShader:gradeFrag });
    gradePass.renderToScreen = true;
    composer.addPass(gradePass);
    return {
      bloom,
      render(t: number) { gradePass.uniforms.uTime.value = t; composer.render(); },
      resize(w: number, h: number) { composer.setSize(w,h); bloom.setSize(w,h); },
    };
  }
  const gradePass = createGradePass();

  // ── shader helpers ────────────────────────────────────────────────────────
  function addRimGlow(mat: any, color='vec3(0.5,0.62,0.9)', strength=0.18) {
    mat.onBeforeCompile = (shader: any) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float rim = pow(1.0-saturate(dot(normalize(vNormal),normalize(-vViewPosition))),3.0);
         totalEmissiveRadiance += ${color} * ${strength.toFixed(2)} * rim;`
      );
    };
    mat.needsUpdate = true;
  }
  function addWindSway(mat: any, strength=0.08) {
    mat.onBeforeCompile = (shader: any) => {
      shader.uniforms.uTime = sharedUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float wPhase = modelMatrix[3][0]*0.15+modelMatrix[3][2]*0.17;
         float wAmt = (sin(uTime*1.7+wPhase)+0.5*sin(uTime*3.1+wPhase*1.3))
           * ${strength.toFixed(2)} * smoothstep(0.0,1.0,transformed.y*0.6+0.5);
         transformed.x += wAmt; transformed.z += wAmt*0.4;`
      );
    };
    mat.needsUpdate = true;
  }

  // ── lighting ──────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight('#8FBF6A', 0.6));
  const sun = new THREE.DirectionalLight('#FFF5DC', 1.4);
  sun.position.set(8,16,8); sun.castShadow = true;
  sun.shadow.mapSize.set(4096,4096);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;  sun.shadow.camera.bottom = -20;
  scene.add(sun);
  const fire = new THREE.PointLight('#FF6B35', 2.5, 12);
  fire.position.set(-5,1.5,-4); scene.add(fire);
  const lamp = new THREE.PointLight('#FFE4A0', 1.8, 10);
  lamp.position.set(0,6.5,0); scene.add(lamp);
  const sky = new THREE.DirectionalLight('#C8E8FF', 0.4);
  sky.position.set(10,8,-8); scene.add(sky);

  // ── material helpers ──────────────────────────────────────────────────────
  function hexRgb(h: string) {
    return { r:parseInt(h.slice(1,3),16), g:parseInt(h.slice(3,5),16), b:parseInt(h.slice(5,7),16) };
  }
  function darken(h: string, f: number) {
    const {r,g,b} = hexRgb(h);
    return '#'+[r,g,b].map(v=>Math.floor(v*f).toString(16).padStart(2,'0')).join('');
  }
  function makeWoodTex(w=256, h=256, baseCol='#7A4F2A') {
    const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
    const ctx = cv.getContext('2d')!;
    const {r,g,b} = hexRgb(baseCol);
    ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,0,w,h);
    const plankH = Math.floor(h/8);
    for (let y=0;y<h;y+=plankH) {
      ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(0,y,w,2);
      for (let x=0;x<w;x+=2+Math.floor(Math.random()*5)) {
        const alpha=(0.03+Math.random()*0.18)*0.7;
        const gr=ctx.createLinearGradient(x,y,x+1,y+plankH);
        gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(0.3+Math.random()*0.4,`rgba(0,0,0,${alpha})`); gr.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gr; ctx.fillRect(x,y,2,plankH);
      }
      ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(0,y+2,w,4);
    }
    const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,4); return t;
  }
  function makePlasterTex(w=256, h=256, baseCol='#8B6F47') {
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const ctx=cv.getContext('2d')!;
    const {r,g,b}=hexRgb(baseCol);
    ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,0,w,h);
    for (let i=0;i<6000;i++) {
      const x=Math.random()*w, y=Math.random()*h, a=Math.random()*0.07;
      ctx.fillStyle=Math.random()<0.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a})`; ctx.fillRect(x,y,2,2);
    }
    ctx.strokeStyle='rgba(50,30,10,0.22)'; ctx.lineWidth=3;
    for (let y=60;y<h;y+=60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,3); return t;
  }
  const _woodTex    = makeWoodTex();
  const _plasterTex = makePlasterTex();
  const mWood = (c='#7A4F2A', r=0.8) => new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,map:_woodTex});
  const mPlaster = (c='#8B6F47', r=0.85) => new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0,map:_plasterTex});
  const mStd = (c: string, r=0.7) => new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0});
  const mLeaf = () => { const m=new THREE.MeshStandardMaterial({color:'#2E7D32',roughness:0.9,metalness:0,side:THREE.DoubleSide}); addWindSway(m,0.10); return m; };


  /* PART2 */

  // ── scene geometry ────────────────────────────────────────────────────────
  const add = (m: any) => { scene.add(m); return m; };
  // floors
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,0.3,14), mWood('#7A4F2A',0.85)),{receiveShadow:true,castShadow:true})).position.set(0,0,0);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(9,0.3,7), mWood('#6B4423',0.9)),{receiveShadow:true,castShadow:true})).position.set(-4.5,6,-1);
  // rug
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,0.04,32), mStd('#4A7C3F',0.95))).position.set(0.5,0.17,1);
  const rugRing = add(new THREE.Mesh(new THREE.RingGeometry(2.4,2.8,32), mStd('#7FB069',0.95)));
  rugRing.rotation.x=-Math.PI/2; rugRing.position.set(0.5,0.19,1);
  // loft railing
  for (let i=0;i<5;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,0.12),mWood('#5A3A1A')),{castShadow:true})).position.set(-0.5+i*1.8,6.75,2.3);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(7.2,0.12,0.12),mWood('#5A3A1A')),{castShadow:true})).position.set(-4.5,7.35,2.3);
  // ladder
  const lrMat=mWood('#5A3A1A',0.9);
  const lr1=add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,7.2,0.1),lrMat),{castShadow:true}));
  lr1.position.set(-0.9,3.2,2.0); lr1.rotation.z=0.25;
  const lr2=add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,7.2,0.1),lrMat),{castShadow:true}));
  lr2.position.set(0.1,3.2,2.0); lr2.rotation.z=-0.25;
  for (let i=0;i<7;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.09,0.09),lrMat),{castShadow:true})).position.set(-0.4,0.7+i*0.9,2.0);
  // walls
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,10,0.3),mPlaster('#8B6F47',0.85)),{receiveShadow:true})).position.set(0,5,-7);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.3,10,14),mPlaster('#8B6F47',0.85)),{receiveShadow:true})).position.set(-9,5,0);
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(9,6,0.3),mPlaster('#7A5F3A',0.85)),{receiveShadow:true})).position.set(-4.5,9.2,-4.5);
  // sky window
  function getSkyColors() {
    const h=new Date().getHours()+new Date().getMinutes()/60;
    if(h>=5&&h<7)  return['#1A0A2E','#FF6B35','#FF9B50','#2A1A14',0.3,0.7];
    if(h>=7&&h<9)  return['#3A7BD5','#FFB347','#FFD580','#4A6A5A',0.7,1.4];
    if(h>=9&&h<17) return['#5BB8E8','#87CEEB','#FFF5DC','#4A7A5A',0.8,1.6];
    if(h>=17&&h<19) return['#C0392B','#E67E22','#FFB347','#6A3A2A',0.5,1.0];
    if(h>=19&&h<21) return['#1A1A3E','#4A2A5A','#8B4A6A','#1A1218',0.3,0.4];
    return                ['#050510','#0A0A1A','#1A1A2E','#0A0A14',0.15,0.2];
  }
  const skyCols=getSkyColors();
  const skyCv=document.createElement('canvas'); skyCv.width=128; skyCv.height=256;
  const skyCtx=skyCv.getContext('2d')!;
  const skyGr=skyCtx.createLinearGradient(0,0,0,256);
  skyGr.addColorStop(0,skyCols[0] as string); skyGr.addColorStop(1,skyCols[1] as string);
  skyCtx.fillStyle=skyGr; skyCtx.fillRect(0,0,128,256);
  const isSun=new Date().getHours()>=6&&new Date().getHours()<20;
  const discY=isSun?180:80;
  skyCtx.beginPath(); skyCtx.arc(64,discY,isSun?22:14,0,Math.PI*2);
  skyCtx.fillStyle=isSun?skyCols[2] as string:'#C8D8FF'; skyCtx.fill();
  if(new Date().getHours()>=20||new Date().getHours()<6) {
    for(let i=0;i<120;i++) { skyCtx.fillStyle=`rgba(255,255,255,${0.3+Math.random()*0.7})`; skyCtx.fillRect(Math.random()*128,Math.random()*180,1,1); }
  }
  add(new THREE.Mesh(new THREE.PlaneGeometry(6,5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(skyCv)}))).position.set(5,5,-7.2);
  scene.background=new THREE.Color(skyCols[0] as string);
  scene.fog=new THREE.FogExp2(skyCols[3] as string,0.020);
  scene.children.filter((o:any)=>o.isAmbientLight).forEach((l:any)=>{l.intensity=skyCols[4];});
  add(new THREE.Mesh(new THREE.ConeGeometry(2,3,5),mStd('#5B7A4A',0.9))).position.set(4,3.5,-7.15);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.5,2.5,5),mStd('#6B8A5A',0.9))).position.set(6.5,3,-7.15);
  const wfM=mWood('#4A2E0A',0.9);
  [[6.2,0.2,0.3,5,7.4,-6.8],[6.2,0.2,0.3,5,4.8,-6.8],[0.2,2.8,0.3,2,-6.1,-6.8],[0.2,2.8,0.3,8,-6.1,-6.8]].forEach(([w,h,d,x,y,z])=>{
    add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wfM),{castShadow:true})).position.set(x,y,z);
  });
  // tree trunk + canopy
  add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,14,10),mWood('#4A2E0A',0.95)),{castShadow:true,receiveShadow:true})).position.set(-7,5,3);
  const branch1=add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.4,8,8),mWood('#5A3A1A',0.9)),{castShadow:true}));
  branch1.rotation.z=-0.5; branch1.position.set(-4.5,9,3);
  [[0,13,3,3.5],[-3,13,2,3],[-6,11,4,2.5],[-2,14,4,2],[1,12,2,3.2]].forEach(([x,y,z,r])=>{
    add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(r,8,6),mLeaf()),{castShadow:true})).position.set(x,y,z);
  });
  // ceiling beams
  const beamMat=mWood('#5A3A1A',0.85);
  for(let i=0;i<4;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18,0.25,0.25),beamMat),{castShadow:true})).position.set(0,9.5,-3+i*2.2);
  for(let i=0;i<3;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.25,0.25,14),beamMat),{castShadow:true})).position.set(-4+i*5,9.5,0);
  // pendant lamp
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2,6),mStd('#2A1A0A',0.9))).position.set(0,8,0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.7,0.5,12),mStd('#4A3000',0.7))).position.set(0,6.8,0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8),new THREE.MeshBasicMaterial({color:'#FFFFFF'}))).position.set(0,6.6,0);
  // fireplace
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.4,2.2,0.6),mStd('#6B6B6B',0.95)),{castShadow:true})).position.set(-5,1.2,-6.75);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,0.4),mStd('#1A1A1A',1))).position.set(-5,1.0,-6.65);
  const flame=add(new THREE.Mesh(new THREE.ConeGeometry(0.35,0.8,6),new THREE.MeshBasicMaterial({color:'#FF6B35'})));
  flame.position.set(-5,1.2,-6.55);
  const flame2=add(new THREE.Mesh(new THREE.ConeGeometry(0.2,0.55,5),new THREE.MeshBasicMaterial({color:'#FFE050'})));
  flame2.position.set(-5,1.35,-6.55);
  const fireCore=add(new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8),new THREE.MeshBasicMaterial({color:'#FFFFFF'})));
  fireCore.position.set(-5,1.3,-6.55);
  [[-3.5,0.2,-6.2,0.4,0.35,1.4],[-3.5,0.55,-6.2,0.4,0.3,1.4]].forEach(([x,y,z,rh,rt,l])=>{
    const log=add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(rt,rh,l,8),mWood('#3A2510',0.9)),{castShadow:true}));
    log.rotation.z=Math.PI/2; log.position.set(x,y,z);
  });
  // window seat + cushion
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(5.5,0.3,1.0),mWood('#6B4423',0.85)),{castShadow:true,receiveShadow:true})).position.set(5,0.45,-6.5);
  add(new THREE.Mesh(new THREE.BoxGeometry(5.3,0.15,0.9),mStd('#5C3D6B',0.9))).position.set(5,0.62,-6.5);
  // table + chairs
  add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.1,16),mWood('#8B5E3C',0.75)),{castShadow:true,receiveShadow:true})).position.set(1.0,0.82,2.0);
  add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.8,8),mWood('#6B4423',0.85)),{castShadow:true})).position.set(1.0,0.42,2.0);
  [[1.0,2.0+1.5,0],[1.0,2.0-1.5,Math.PI],[1.0+1.5,2.0,Math.PI/2],[1.0-1.5,2.0,-Math.PI/2]].forEach(([cx,cz,ry])=>{
    add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.55,0.08,0.55),mWood('#7A4F2A',0.85)),{castShadow:true})).position.set(cx,0.55,cz);
    const back=add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.55,0.5,0.07),mWood('#6B4423',0.85)),{castShadow:true}));
    back.position.set(cx,0.84,cz+(ry===0?0.24:ry===Math.PI?-0.24:0)+(ry===Math.PI/2?0.24:ry===-Math.PI/2?-0.24:0));
    back.rotation.y=ry;
    [-0.2,0.2].forEach(ox=>[-0.2,0.2].forEach(oz=>{
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06,0.55,0.06),mWood('#5A3A1A',0.9))).position.set(cx+ox,0.28,cz+oz);
    }));
  });
  // bookshelf
  add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,0.35),mWood('#5A3A1A',0.85)),{castShadow:true,receiveShadow:true})).position.set(-7.5,0.9,-5.5);
  [0.3,0.75,1.2].forEach(sy=>{
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.06,0.3),mWood('#6B4423',0.8))).position.set(-7.5,sy,-5.5);
    let bx=-7.88;
    ['#8B1A1A','#1A5C8B','#2E7D32','#8B6B1A','#6B1A8B','#1A8B6B'].forEach(bc=>{
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1+Math.random()*0.08,0.28,0.22),mStd(bc,0.9))).position.set(bx,sy+0.17,-5.5); bx+=0.14+Math.random()*0.04;
    });
  });
  // right-side railing
  for(let i=0;i<7;i++) add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.1,1.1,0.1),mWood('#5A3A1A')),{castShadow:true})).position.set(8.8,0.8,-3+i*1.0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,7),mWood('#4A2E0A'))).position.set(8.8,1.35,0);

  // ── embers ────────────────────────────────────────────────────────────────
  const EMBER_COUNT=28;
  const emberGeo=new THREE.BufferGeometry();
  const emberPos=new Float32Array(EMBER_COUNT*3);
  const emberData:any[]=[];
  for(let i=0;i<EMBER_COUNT;i++){
    emberData.push({life:Math.random(),maxLife:1.0+Math.random()*1.5,vx:(Math.random()-0.5)*0.4,vy:0.6+Math.random()*0.8,vz:(Math.random()-0.5)*0.3,ox:-5,oz:-6.55});
    emberPos[i*3]=emberData[i].ox; emberPos[i*3+1]=1.2; emberPos[i*3+2]=emberData[i].oz;
  }
  emberGeo.setAttribute('position',new THREE.BufferAttribute(emberPos,3));
  const emberMat=new THREE.PointsMaterial({color:'#FF8C00',size:0.08,transparent:true,opacity:0.9,sizeAttenuation:true});
  const embers=new THREE.Points(emberGeo,emberMat);
  scene.add(embers);
  function tickEmbers(dt:number){
    const pos=embers.geometry.attributes.position.array as Float32Array;
    for(let i=0;i<EMBER_COUNT;i++){
      const d=emberData[i]; d.life+=dt;
      if(d.life>d.maxLife){ d.life=0; d.maxLife=1.0+Math.random()*1.5; d.vx=(Math.random()-0.5)*0.4; d.vy=0.6+Math.random()*0.9; d.vz=(Math.random()-0.5)*0.3; pos[i*3]=d.ox+(Math.random()-0.5)*0.3; pos[i*3+1]=1.2; pos[i*3+2]=d.oz+(Math.random()-0.5)*0.2; }
      else { const t=d.life/d.maxLife; pos[i*3]+=d.vx*dt*0.5; pos[i*3+1]+=d.vy*dt; pos[i*3+2]+=d.vz*dt*0.3; emberMat.opacity=0.9-t*0.7; }
    }
    embers.geometry.attributes.position.needsUpdate=true;
  }

  // ── dust motes ────────────────────────────────────────────────────────────
  const MOTE_COUNT=60;
  const moteGeo=new THREE.BufferGeometry();
  const motePos=new Float32Array(MOTE_COUNT*3);
  const moteData:any[]=[];
  for(let i=0;i<MOTE_COUNT;i++){
    const x=-7+Math.random()*16, y=0.5+Math.random()*7, z=-6+Math.random()*12;
    motePos[i*3]=x; motePos[i*3+1]=y; motePos[i*3+2]=z;
    moteData.push({ox:x,oy:y,oz:z,vx:(Math.random()-0.5)*0.04,vy:0.005+Math.random()*0.02,vz:(Math.random()-0.5)*0.03,phase:Math.random()*Math.PI*2});
  }
  moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
  const motes=new THREE.Points(moteGeo,new THREE.PointsMaterial({color:'#FFE8C0',size:0.04,transparent:true,opacity:0.35,sizeAttenuation:true}));
  scene.add(motes);
  function tickMotes(t:number){
    const pos=motes.geometry.attributes.position.array as Float32Array;
    for(let i=0;i<MOTE_COUNT;i++){
      const d=moteData[i];
      pos[i*3]+=d.vx+Math.sin(t*0.3+d.phase)*0.002;
      pos[i*3+1]+=d.vy*0.5;
      pos[i*3+2]+=d.vz+Math.cos(t*0.2+d.phase)*0.002;
      if(pos[i*3+1]>8.5){pos[i*3]=d.ox+(Math.random()-0.5)*4;pos[i*3+1]=0.3;pos[i*3+2]=d.oz+(Math.random()-0.5)*4;}
      if(pos[i*3]>8)pos[i*3]=-7; if(pos[i*3]<-8)pos[i*3]=7;
      if(pos[i*3+2]>5)pos[i*3+2]=-5; if(pos[i*3+2]<-7)pos[i*3+2]=4;
    }
    motes.geometry.attributes.position.needsUpdate=true;
  }


  /* PART3 */

  // ── avatar face/shirt canvas helpers ─────────────────────────────────────
  function buildFace(state: string, color: string) {
    const cv=document.createElement('canvas'); cv.width=64; cv.height=64;
    const ctx=cv.getContext('2d')!;
    const {r,g,b}=hexRgb(color||'#7B2FBE');
    ctx.fillStyle=`rgb(${Math.min(255,r+80)},${Math.min(255,g+60)},${Math.min(255,b+40)})`; ctx.fillRect(0,0,64,64);
    ctx.fillStyle='#1A0A00';
    if(state==='happy'){
      ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
      ctx.fillText('^',19,32); ctx.fillText('^',45,32);
      ctx.beginPath(); ctx.arc(32,44,9,0,Math.PI); ctx.lineWidth=3; ctx.strokeStyle='#1A0A00'; ctx.stroke();
    } else if(state==='excited'){
      ctx.font='15px sans-serif'; ctx.textAlign='center';
      ctx.fillText('★',19,32); ctx.fillText('★',45,32);
      ctx.beginPath(); ctx.ellipse(32,46,7,8,0,0,Math.PI*2); ctx.fill();
    } else if(state==='sleepy'){
      ctx.fillRect(11,25,16,4); ctx.fillRect(37,25,16,4); ctx.fillRect(26,44,12,3);
      ctx.font='10px sans-serif'; ctx.textAlign='left'; ctx.globalAlpha=0.45;
      ctx.fillText('z',49,18); ctx.globalAlpha=1;
    } else if(state==='talking'){
      ctx.beginPath(); ctx.arc(20,28,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(44,28,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(32,46,5,8,0,0,Math.PI*2); ctx.lineWidth=2.5; ctx.strokeStyle='#1A0A00'; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(20,28,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(44,28,5,0,Math.PI*2); ctx.fill();
      ctx.fillRect(24,44,16,3);
    }
    return cv;
  }
  function setFace(c: any, state: string) {
    const p=c.userData._parts; if(!p||!p.faceStates||!p.headFaceMat)return;
    if(p._curFace===state)return; p._curFace=state;
    p.headFaceMat.map=p.faceStates[state]||p.faceStates.default; p.headFaceMat.needsUpdate=true;
  }
  function createCartridgeVoxelAvatar(g: GameData) {
    const root=new THREE.Group();
    const base=GENRE_COLOR[g.genre]||g.color;
    const dark=darken(base,0.55); const ridge=darken(base,0.65);
    const mBase=new THREE.MeshStandardMaterial({color:base,roughness:0.45,metalness:0.1});
    addRimGlow(mBase,'vec3(1.0,0.85,0.3)',0.14);
    const mDark=new THREE.MeshStandardMaterial({color:dark,roughness:0.6});
    const mRidge=new THREE.MeshStandardMaterial({color:ridge,roughness:0.65});
    const mPin=new THREE.MeshStandardMaterial({color:'#AAAAAA',roughness:0.3,metalness:0.8});
    const mShoe=new THREE.MeshStandardMaterial({color:'#1A1A1A',roughness:0.9});
    // label
    const labelCv=document.createElement('canvas'); labelCv.width=128; labelCv.height=192;
    const lctx=labelCv.getContext('2d')!;
    const {r,g:gb,b}=hexRgb(base);
    lctx.fillStyle=`rgb(${Math.min(255,r+60)},${Math.min(255,gb+50)},${Math.min(255,b+40)})`; lctx.fillRect(0,0,128,192);
    const lgr=lctx.createLinearGradient(0,0,0,192);
    lgr.addColorStop(0,'rgba(255,255,255,0.18)'); lgr.addColorStop(1,'rgba(0,0,0,0.28)');
    lctx.fillStyle=lgr; lctx.fillRect(0,0,128,192);
    lctx.strokeStyle='rgba(255,255,255,0.55)'; lctx.lineWidth=3; lctx.setLineDash([6,4]);
    lctx.strokeRect(5,5,118,182); lctx.setLineDash([]);
    lctx.font='44px serif'; lctx.textAlign='center'; lctx.fillText(GENRE_ICON[g.genre]||'🎮',64,88);
    lctx.fillStyle='rgba(255,255,255,0.85)'; lctx.font='bold 13px sans-serif';
    const words=g.title.split(' '); let line=''; const lines:string[]=[];
    for(const w of words){const tt=line?line+' '+w:w; if(lctx.measureText(tt).width>108&&line){lines.push(line);line=w;}else line=tt;}
    if(line)lines.push(line);
    lines.forEach((l,i)=>lctx.fillText(l,64,118+i*17));
    const mLabel=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(labelCv),roughness:0.4});
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.72,1.02,0.26),[mBase,mBase,mBase,mBase,mLabel,mBase]);
    body.castShadow=true; root.add(body);
    root.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.13,0.23),mDark),{})).position.set(0,0.58,0);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.68,0.12,0.21),mRidge)).position.set(0,-0.57,0);
    [-0.22,-0.11,0,0.11,0.22].forEach(px=>{ const pin=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.09,0.04),mPin); pin.position.set(px,-0.53,-0.01); root.add(pin); });
    // head
    const faceStates:Record<string,any>={};
    ['default','happy','excited','sleepy','talking'].forEach(s=>{ faceStates[s]=new THREE.CanvasTexture(buildFace(s,g.color)); });
    const headFaceMat=new THREE.MeshStandardMaterial({map:faceStates.default,roughness:0.5});
    addRimGlow(headFaceMat,'vec3(0.9,0.75,0.4)',0.22);
    const mSkin=new THREE.MeshStandardMaterial({color:'#F5DEB3',roughness:0.6});
    addRimGlow(mSkin,'vec3(0.9,0.75,0.4)',0.15);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.46,0.46),[mSkin,mSkin,mSkin,mSkin,headFaceMat,mSkin]);
    head.position.set(0,0.72,0); head.castShadow=true; root.add(head);
    const armL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.30,0.20),mSkin); armL.position.set(-0.46,0.08,0); armL.castShadow=true; root.add(armL);
    const armR=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.30,0.20),mSkin); armR.position.set(0.46,0.08,0); armR.castShadow=true; root.add(armR);
    const legL=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.28,0.24),mDark); legL.position.set(-0.19,-0.65,0); legL.castShadow=true; root.add(legL);
    const legR=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.28,0.24),mDark); legR.position.set(0.19,-0.65,0); legR.castShadow=true; root.add(legR);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.10,0.30),mShoe)).position.set(-0.19,-0.81,0.04);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.10,0.30),mShoe)).position.set(0.19,-0.81,0.04);
    (root as any)._armL=armL; (root as any)._armR=armR; (root as any)._legL=legL; (root as any)._legR=legR;
    (root as any)._voxParts={head,faceStates,headFaceMat,_curFace:'default'};
    root.userData._parts=(root as any)._voxParts;
    return root;
  }

  // ── emote particles ───────────────────────────────────────────────────────
  function spawnEmote(c: any, emoji: string) {
    const wp=new THREE.Vector3(); c.getWorldPosition(wp);
    const p=wp.clone().project(camera);
    const div=document.createElement('div');
    div.textContent=emoji;
    div.style.cssText=`position:fixed;z-index:70;font-size:22px;pointer-events:none;left:${(p.x*0.5+0.5)*window.innerWidth}px;top:${(-p.y*0.5+0.5)*window.innerHeight-20}px;transition:transform 1.2s ease-out,opacity 1.2s ease-out;transform:translateY(0px);opacity:1;`;
    document.body.appendChild(div); domElements.push(div);
    requestAnimationFrame(()=>{ div.style.transform='translateY(-55px)'; div.style.opacity='0'; });
    setTimeout(()=>{ div.remove(); const idx=domElements.indexOf(div); if(idx>-1)domElements.splice(idx,1); },1300);
  }
  function tickEmotes(dt: number) {
    cartridges.forEach((c: any)=>{
      const d=c.userData;
      if(!d._emoteTimer) d._emoteTimer=3+Math.random()*6;
      d._emoteTimer-=dt;
      if(d._emoteTimer<0){ d._emoteTimer=4+Math.random()*8; spawnEmote(c,EMOTE_POOL[Math.floor(Math.random()*EMOTE_POOL.length)]); }
    });
  }

  // ── proximity / talk bubbles ──────────────────────────────────────────────
  const TALK_DIST=1.8;
  const talkBubbles=new Map<any,HTMLElement>();
  function getOrCreateBubble(c: any) {
    if(talkBubbles.has(c)) return talkBubbles.get(c)!;
    const div=document.createElement('div');
    div.style.cssText=`position:fixed;z-index:65;pointer-events:none;display:none;transform:translate(-50%,-120%);background:#FFF8E7;border:1.5px solid #8D6E63;border-radius:12px;padding:5px 10px;font:700 11px 'Nunito',sans-serif;color:#3D2B1F;box-shadow:0 4px 12px rgba(0,0,0,0.25);white-space:normal;text-align:center;line-height:1.3;max-width:150px;`;
    document.body.appendChild(div); domElements.push(div);
    talkBubbles.set(c,div); return div;
  }
  function showTalkBubble(c: any, text: string) {
    const el=getOrCreateBubble(c);
    el.innerHTML=`${text}<div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:#8D6E63;"></div>`;
    el.style.display='block'; el.style.opacity='0'; el.style.transition='opacity 0.25s';
    requestAnimationFrame(()=>el.style.opacity='1');
  }
  function hideTalkBubble(c: any) {
    const el=talkBubbles.get(c); if(!el)return;
    el.style.opacity='0'; setTimeout(()=>{el.style.display='none';},260);
  }
  function updateTalkBubblePositions() {
    talkBubbles.forEach((el,c)=>{
      if(el.style.display==='none') return;
      const wp=new THREE.Vector3(); c.getWorldPosition(wp); wp.y+=1.4;
      const p=wp.clone().project(camera);
      if(p.z>1){el.style.display='none';return;}
      el.style.left=(p.x*0.5+0.5)*window.innerWidth+'px';
      el.style.top=(-p.y*0.5+0.5)*window.innerHeight+'px';
    });
  }
  function getBuddyLine(title: string) {
    const lines=BUDDY_VOICE[title]; if(lines) return lines[Math.floor(Math.random()*lines.length)];
    return ['GG 🏆','my GOTY','still thinking about it','10/10'][Math.floor(Math.random()*4)];
  }
  function checkProximity() {
    for(let i=0;i<cartridges.length;i++){
      for(let j=i+1;j<cartridges.length;j++){
        const a=cartridges[i], b=cartridges[j];
        if(a.userData.floor!==b.userData.floor) continue;
        const dx=a.position.x-b.position.x, dz=a.position.z-b.position.z;
        if(Math.sqrt(dx*dx+dz*dz)<TALK_DIST){
          if(!a.userData._talking){
            a.userData._talking=true; b.userData._talking=true;
            a.userData._talkTimer=3+Math.random()*3; b.userData._talkTimer=3+Math.random()*3;
            setFace(a,'talking'); setFace(b,'talking');
            a.userData.angleTarget=Math.atan2(b.position.x-a.position.x,b.position.z-a.position.z);
            b.userData.angleTarget=Math.atan2(a.position.x-b.position.x,a.position.z-b.position.z);
            a.userData._fsm='idle'; b.userData._fsm='idle';
            showTalkBubble(a,getBuddyLine(a.userData.title)); showTalkBubble(b,getBuddyLine(b.userData.title));
          }
        }
      }
      const d=cartridges[i].userData;
      if(d._talking){
        d._talkTimer=(d._talkTimer||0)-0.016;
        if(d._talkTimer<0){
          d._talking=false; hideTalkBubble(cartridges[i]);
          if(!d.facingCamera) setFace(cartridges[i],'happy');
          setTimeout(()=>{ if(!cartridges[i].userData.facingCamera) setFace(cartridges[i],'default'); },1500);
          d._fsm='idle'; d._fsmTimer=0.5;
        }
      }
    }
  }

  // ── genre personality ─────────────────────────────────────────────────────
  const GENRE_HOME: Record<string,any[]|null> = {
    rpg:[{x:-4.5,z:-5.5}], sim:[{x:3.8,z:-6.0},{x:5.5,z:-6.0}], action:null, platformer:null,
    adventure:[{x:1.2,z:2.8}], horror:[{x:-3.5,z:1.5}], rhythm:[{x:0.5,z:1.0}],
  };
  const GENRE_BOB: Record<string,number> = {action:0.09,platformer:0.12,rpg:0.02,sim:0.015,adventure:0.04,horror:0.025,rhythm:0.07};
  const GENRE_SPEED: Record<string,number> = {action:1.8,platformer:2.0,rpg:0.5,sim:0.4,adventure:1.0,horror:0.6,rhythm:0.9};
  const SIT_SPOTS=[{x:1.2,y:0.42,z:2.8},{x:-0.4,y:0.42,z:2.8},{x:2.6,y:0.42,z:1.2},{x:3.8,y:0.42,z:-6.3},{x:5.5,y:0.42,z:-6.3},{x:-3.8,y:0.42,z:-5.8}];
  const LOFT_SPOTS=[{x:-5.5,y:6.42,z:-1.2},{x:-3.0,y:6.42,z:-0.5}];
  const FLOOR0_BOUNDS={xMin:-7.5,xMax:7.5,zMin:-5.5,zMax:5.5};
  const FLOOR1_BOUNDS={xMin:-8.5,xMax:-0.5,zMin:-4.5,zMax:2};
  const BEHAVIORS_F0=['sit','sit','wander','wander','sit','wander','wander'];
  const BEHAVIORS_F1=['sit','wander'];
  let f0si=0, f1si=0;

  const cartridges: any[]=[];
  games.forEach(g=>{
    const c=createCartridgeVoxelAvatar(g);
    if(g.floor===1){
      const sp=LOFT_SPOTS[f1si%LOFT_SPOTS.length];
      const fy=6.29+1.20;
      c.position.set(sp.x,fy,sp.z);
      c.userData={id:g.id,title:g.title,genre:g.genre,color:g.color,baseY:fy,phase:Math.random()*Math.PI*2,behavior:'loft_idle',sitSpot:sp,wanderTarget:new THREE.Vector3(sp.x,fy,sp.z),wanderTimer:Math.random()*4+2,floor:g.floor,angle:Math.random()*Math.PI*2,angleTarget:Math.random()*Math.PI*2,_fsm:'idle',_fsmTimer:0.3+Math.random()*1.5,_parts:null,totalMinutes:g.totalMinutes,completedAt:g.completedAt};
      f1si++;
    } else {
      const beh=BEHAVIORS_F0[f0si%BEHAVIORS_F0.length];
      const sp=beh==='sit'?SIT_SPOTS[f0si%SIT_SPOTS.length]:null;
      const spawnX=sp?sp.x:[-2.5,2.5,0,4,-3,1.5,3.5][f0si%7];
      const spawnZ=sp?sp.z:[2.0,0.5,3,1,-1,3.5,2.0][f0si%7];
      const fy=0.15+1.20;
      c.position.set(spawnX,fy,spawnZ);
      c.userData={id:g.id,title:g.title,genre:g.genre,color:g.color,baseY:fy,phase:Math.random()*Math.PI*2,behavior:beh,sitSpot:sp,wanderTarget:new THREE.Vector3(spawnX,fy,spawnZ),wanderTimer:Math.random()*4+2,floor:g.floor,angle:Math.random()*Math.PI*2,angleTarget:Math.random()*Math.PI*2,_fsm:beh==='sit'?'sitting':'idle',_fsmTimer:beh==='sit'?5+Math.random()*8:0.3+Math.random()*1.5,_parts:null,_genreHome:GENRE_HOME[g.genre]?GENRE_HOME[g.genre]![Math.floor(Math.random()*GENRE_HOME[g.genre]!.length)]:null,totalMinutes:g.totalMinutes,completedAt:g.completedAt};
      f0si++;
    }
    c.userData._parts=(c as any)._voxParts||null;
    c.scale.setScalar(1.1);
    scene.add(c); cartridges.push(c);
  });

  let glowRing: any = null;
  let focusLight: any = null;
  function setGlowRing(cartridge: any) {
    if(glowRing?.parent) glowRing.parent.remove(glowRing);
    if(focusLight){scene.remove(focusLight);focusLight=null;}
    if(!cartridge)return;
    glowRing=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.06,8,32),new THREE.MeshBasicMaterial({color:'#FFD700',transparent:true,opacity:0}));
    cartridge.add(glowRing);
    focusLight=new THREE.PointLight('#FFD700',0,6); scene.add(focusLight);
    const t0=performance.now();
    function fadeIn(){const p=Math.min((performance.now()-t0)/400,1); glowRing.material.opacity=p*0.9; if(focusLight)focusLight.intensity=p*3.5; if(p<1)requestAnimationFrame(fadeIn);}
    fadeIn();
  }

  // ── focus state machine ───────────────────────────────────────────────────
  let focusMode=false;
  let currentFocusIdx=0;
  let camAnim: any=null;
  function animCam(toP: any, toT: any, dur: number){
    const sP=camera.position.clone(), sT=controls.target.clone();
    camAnim={toP,toT,sP,sT,t0:performance.now(),dur};
  }
  function enterFocus(idx: number){
    currentFocusIdx=((idx%cartridges.length)+cartridges.length)%cartridges.length;
    const c=cartridges[currentFocusIdx];
    focusMode=true; controls.enabled=false;
    const wp=new THREE.Vector3(); c.getWorldPosition(wp);
    const camTarget=wp.clone().add(new THREE.Vector3(0,0.5,0));
    const camPos=wp.clone().add(new THREE.Vector3(1.4,1.8,3.8));
    animCam(camPos,camTarget,550);
    c.userData.facingCamera=true;
    c.userData.faceTargetAngle=Math.atan2(camPos.x-wp.x,camPos.z-wp.z);
    setGlowRing(c);
    onAvatarSelect(currentFocusIdx);
  }
  function exitFocus(){
    focusMode=false; controls.enabled=true;
    cartridges.forEach((c: any)=>{c.userData.facingCamera=false; c.userData.faceTargetAngle=null;});
    setGlowRing(null);
    animCam(CAM.orbit.pos,CAM.orbit.target,600);
  }
  function focusStep(dir: -1|1){
    const prev=cartridges.find((x: any)=>x.userData.facingCamera);
    if(prev){prev.userData.facingCamera=false; prev.userData.faceTargetAngle=null;}
    currentFocusIdx=((currentFocusIdx+dir)%cartridges.length+cartridges.length)%cartridges.length;
    const c=cartridges[currentFocusIdx];
    const wp=new THREE.Vector3(); c.getWorldPosition(wp);
    const camPos=wp.clone().add(new THREE.Vector3(1.4,1.8,3.8));
    animCam(camPos,wp.clone().add(new THREE.Vector3(0,0.5,0)),400);
    c.userData.facingCamera=true; c.userData.faceTargetAngle=Math.atan2(camPos.x-wp.x,camPos.z-wp.z);
    setGlowRing(c); onAvatarSelect(currentFocusIdx);
  }

  // ── raycaster ─────────────────────────────────────────────────────────────
  const raycaster=new THREE.Raycaster();
  const mouse=new THREE.Vector2();
  let hoveredC: any=null;
  function getC(hits: any[]){for(const h of hits){let o=h.object;while(o){if(o.userData?.id!==undefined)return o;o=o.parent;}}}
  function castAt(cx: number, cy: number){
    const rect=canvas.getBoundingClientRect();
    mouse.x=((cx-rect.left)/rect.width)*2-1; mouse.y=-((cy-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera); return raycaster.intersectObjects(scene.children,true);
  }
  canvas.addEventListener('mousemove',(e: MouseEvent)=>{
    if(focusMode)return;
    hoveredC=getC(castAt(e.clientX,e.clientY))||null;
    canvas.style.cursor=hoveredC?'pointer':'default';
  });
  canvas.addEventListener('click',(e: MouseEvent)=>{
    if(focusMode)return;
    const h=getC(castAt(e.clientX,e.clientY));
    if(h){const idx=cartridges.indexOf(h);if(idx>=0)enterFocus(idx);}
  });
  let touchStart: any=null;
  canvas.addEventListener('touchstart',(e: TouchEvent)=>{
    if(e.touches.length===1) touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};
  },{passive:true});
  canvas.addEventListener('touchend',(e: TouchEvent)=>{
    if(!touchStart)return;
    const dx=e.changedTouches[0].clientX-touchStart.x, dy=e.changedTouches[0].clientY-touchStart.y;
    if(Math.hypot(dx,dy)<12&&Date.now()-touchStart.t<260){
      if(!focusMode){const h=getC(castAt(e.changedTouches[0].clientX,e.changedTouches[0].clientY));if(h){const idx=cartridges.indexOf(h);if(idx>=0)enterFocus(idx);}}
    }
    touchStart=null;
  },{passive:true});

  // ── drag & drop ───────────────────────────────────────────────────────────
  let dragC: any=null;
  const dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const dragPt=new THREE.Vector3();
  function startDrag(c: any){dragC=c;c.userData._dragging=true;c.userData._fsm='idle';c.userData._talking=false;hideTalkBubble(c);setFace(c,'excited');controls.enabled=false;canvas.style.cursor='grabbing';}
  function moveDrag(cx: number,cy: number){
    if(!dragC)return;
    const rect=canvas.getBoundingClientRect();
    mouse.x=((cx-rect.left)/rect.width)*2-1; mouse.y=-((cy-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    dragPlane.constant=-dragC.userData.baseY;
    if(raycaster.ray.intersectPlane(dragPlane,dragPt)){dragC.position.x=dragPt.x;dragC.position.z=dragPt.z;}
  }
  function endDrag(){
    if(!dragC)return;
    dragC.userData._dragging=false; dragC.userData._fsm='idle'; dragC.userData._fsmTimer=0.5;
    setFace(dragC,'happy'); setTimeout(()=>{if(!dragC.userData.facingCamera)setFace(dragC,'default');},1500);
    dragC=null; controls.enabled=!focusMode; canvas.style.cursor='default';
  }
  let mouseDown=false, mouseDragStarted=false, mouseDownC: any=null;
  canvas.addEventListener('mousedown',(e: MouseEvent)=>{if(focusMode)return;const h=getC(castAt(e.clientX,e.clientY));if(h){mouseDownC=h;mouseDown=true;}});
  canvas.addEventListener('mousemove',(e: MouseEvent)=>{if(!mouseDown||!mouseDownC)return;if(!mouseDragStarted){mouseDragStarted=true;startDrag(mouseDownC);}moveDrag(e.clientX,e.clientY);});
  canvas.addEventListener('mouseup',()=>{if(mouseDragStarted)endDrag();mouseDown=false;mouseDragStarted=false;mouseDownC=null;});
  let touchDragTimer: any=null, touchDragC: any=null;
  canvas.addEventListener('touchstart',(e2: TouchEvent)=>{
    if(focusMode||e2.touches.length!==1)return;
    const tx=e2.touches[0].clientX, ty=e2.touches[0].clientY;
    const h=getC(castAt(tx,ty));
    if(h) touchDragTimer=setTimeout(()=>{touchDragC=h;startDrag(h);},320);
  },{passive:true});
  canvas.addEventListener('touchmove',(e2: TouchEvent)=>{if(!touchDragC||e2.touches.length!==1)return;e2.preventDefault();moveDrag(e2.touches[0].clientX,e2.touches[0].clientY);},{passive:false});
  canvas.addEventListener('touchend',()=>{clearTimeout(touchDragTimer);if(touchDragC){endDrag();touchDragC=null;}},{passive:true});

  // ── limb animation ────────────────────────────────────────────────────────
  function animateLimbs(c: any, t: number){
    const d=c.userData; const armL=(c as any)._armL; const armR=(c as any)._armR; const legL=(c as any)._legL; const legR=(c as any)._legR;
    if(!armL||!armR||!legL||!legR)return;
    const walking=(d._fsm==='walking'||d._fsm==='walking_to_sit')&&!d.facingCamera;
    if(walking){const sw=Math.sin(t*4+d.phase)*0.45;armL.rotation.x=sw;armR.rotation.x=-sw;legL.rotation.x=-sw;legR.rotation.x=sw;if(d._parts?.head)d._parts.head.rotation.z=Math.sin(t*4+d.phase)*0.06;}
    else if(d._fsm==='sitting'){legL.rotation.x=Math.PI/2.2;legR.rotation.x=Math.PI/2.2;armL.rotation.x=-0.1;armR.rotation.x=-0.1;if(d._parts?.head)d._parts.head.rotation.z=Math.sin(t*0.7+d.phase)*0.04;}
    else{armL.rotation.x=Math.sin(t*1.1+d.phase)*0.1;armR.rotation.x=Math.sin(t*1.1+d.phase+Math.PI)*0.1;legL.rotation.x=0;legR.rotation.x=0;if(d._parts?.head){d._parts.head.rotation.z=Math.sin(t*0.6+d.phase)*0.05;d._parts.head.rotation.y=Math.sin(t*0.4+d.phase)*0.12;}}
  }

  // ── render loop ───────────────────────────────────────────────────────────
  const clock=new THREE.Clock();
  let animId=0;
  function animate(){
    animId=requestAnimationFrame(animate);
    controls.update();
    const t=clock.getElapsedTime();
    const dt=Math.min(clock.getDelta()||0.016,0.05);
    // camera tween
    if(camAnim){
      const prog=Math.min((performance.now()-camAnim.t0)/camAnim.dur,1);
      const ease=prog<0.5?4*prog*prog*prog:1-Math.pow(-2*prog+2,3)/2;
      camera.position.lerpVectors(camAnim.sP,camAnim.toP,ease);
      controls.target.lerpVectors(camAnim.sT,camAnim.toT,ease);
      if(prog>=1)camAnim=null;
    }
    sharedUniforms.uTime.value=t;
    // fire flicker
    flame.scale.y=0.85+Math.sin(t*8)*0.15+Math.random()*0.08;
    flame2.scale.y=0.8+Math.sin(t*11)*0.2;
    fireCore.scale.setScalar(0.7+Math.sin(t*9)*0.3+Math.random()*0.15);
    fire.intensity=2.0+Math.sin(t*6)*0.5+Math.sin(t*3.3)*0.3;
    lamp.intensity=1.6+Math.sin(t*0.8)*0.2;
    // focus light tracking
    if(focusLight&&cartridges[currentFocusIdx]){const wp2=new THREE.Vector3();cartridges[currentFocusIdx].getWorldPosition(wp2);focusLight.position.set(wp2.x,wp2.y+2.5,wp2.z);}
    // cartridge FSM + animation
    cartridges.forEach((c: any)=>{
      const d=c.userData;
      const bobAmp=d._fsm==='sitting'?0.012:(GENRE_BOB[d.genre]||0.04);
      c.position.y=d.baseY+Math.sin((t+d.phase)*1.3)*bobAmp;
      if(!d.facingCamera&&!d._talking){
        d._fsmTimer=(d._fsmTimer||3)-dt;
        if(d._fsmTimer<0){
          d._fsmTimer=4+Math.random()*6;
          const goHome=d._genreHome&&Math.random()<0.45;
          const goSit=!goHome&&Math.random()<0.25&&SIT_SPOTS.length;
          if(d.behavior==='loft_idle'){ d._fsm='loft_idle'; }
          else if(goHome){ d._fsm='walking'; d.wanderTarget.set(d._genreHome.x,d.baseY,d._genreHome.z); d.angleTarget=Math.atan2(d._genreHome.x-c.position.x,d._genreHome.z-c.position.z); d._genreHome=null; }
          else if(goSit){ d._fsm='walking_to_sit'; d.sitTarget=SIT_SPOTS[Math.floor(Math.random()*SIT_SPOTS.length)]; d.wanderTarget.set(d.sitTarget.x,d.baseY,d.sitTarget.z); d.angleTarget=Math.atan2(d.sitTarget.x-c.position.x,d.sitTarget.z-c.position.z); }
          else{ d._fsm='walking'; const b=d.floor===1?FLOOR1_BOUNDS:FLOOR0_BOUNDS; d.wanderTarget.set(b.xMin+Math.random()*(b.xMax-b.xMin),d.baseY,b.zMin+Math.random()*(b.zMax-b.zMin)); d.angleTarget=Math.atan2(d.wanderTarget.x-c.position.x,d.wanderTarget.z-c.position.z); }
          setFace(c,d._fsm==='sitting'?'sleepy':'happy');
          setTimeout(()=>{if(!c.userData.facingCamera&&!c.userData._talking)setFace(c,'default');},1800);
        }
      }
      if((d._fsm==='walking'||d._fsm==='walking_to_sit')&&!d.facingCamera){
        const dx2=d.wanderTarget.x-c.position.x, dz2=d.wanderTarget.z-c.position.z;
        const dist=Math.sqrt(dx2*dx2+dz2*dz2);
        if(dist>0.2){ const spd=0.65*(GENRE_SPEED[d.genre]||1.0)*dt; c.position.x+=dx2/dist*spd; c.position.z+=dz2/dist*spd; }
        else if(d._fsm==='walking_to_sit'){ d._fsm='sitting'; d._fsmTimer=5+Math.random()*8; setFace(c,'sleepy'); }
        else{ d._fsm='idle'; d._fsmTimer=2+Math.random()*4; setFace(c,'happy'); setTimeout(()=>{if(!c.userData.facingCamera)setFace(c,'default');},1500); }
        d.angle+=(d.angleTarget-d.angle)*0.08; c.rotation.y=d.angle;
      } else if(d._fsm==='loft_idle'&&!d.facingCamera){ c.rotation.y+=0.003; }
      if(d.facingCamera&&d.faceTargetAngle!=null){
        let diff=d.faceTargetAngle-c.rotation.y;
        while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
        c.rotation.y+=diff*0.1; setFace(c,'excited');
      }
      const targetS=c===hoveredC?1.1*1.12:1.1;
      c.scale.y+=(targetS-c.scale.y)*0.12; c.scale.x+=(1.1-c.scale.x)*0.12; c.scale.z+=(1.1-c.scale.z)*0.12;
      animateLimbs(c,t);
    });
    if(Math.round(t*60)%10===0) checkProximity();
    tickEmotes(dt); tickEmbers(dt); tickMotes(t);
    updateTalkBubblePositions();
    gradePass.render(t);
  }
  animate();

  function onResize(){
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
    gradePass.resize(window.innerWidth,window.innerHeight);
  }
  window.addEventListener('resize',onResize);

  function dispose(){
    cancelAnimationFrame(animId);
    window.removeEventListener('resize',onResize);
    talkBubbles.forEach(el=>el.remove());
    domElements.forEach(el=>el.remove());
    renderer.dispose();
  }

  return { dispose, exitFocus, focusStep };
}

// ── component ─────────────────────────────────────────────────────────────────
const TreehouseWorld = forwardRef<TreehouseWorldHandle, Props>(
  function TreehouseWorld({ games, onAvatarSelect }, ref) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const sceneRef   = useRef<ReturnType<typeof buildScene> | null>(null);
    const threeReady = useRef(false);

    function tryInit() {
      if (threeReady.current || !canvasRef.current) return;
      const THREE = (window as any).THREE;
      if (!THREE?.OrbitControls || !THREE?.EffectComposer) return;
      threeReady.current = true;
      sceneRef.current = buildScene(canvasRef.current, games, onAvatarSelect);
    }

    useEffect(() => {
      const interval = setInterval(() => {
        if ((window as any).THREE?.OrbitControls && (window as any).THREE?.EffectComposer) {
          clearInterval(interval); tryInit();
        }
      }, 100);
      return () => { clearInterval(interval); sceneRef.current?.dispose(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      exitFocus: () => sceneRef.current?.exitFocus(),
      focusStep: (dir) => sceneRef.current?.focusStep(dir),
    }));

    return (
      <>
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js" strategy="afterInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js" strategy="afterInteractive" onLoad={tryInit} />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      </>
    );
  }
);

export default TreehouseWorld;
