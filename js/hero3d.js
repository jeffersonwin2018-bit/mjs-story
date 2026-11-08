/* =============================================================================
   MJ's Story · Héroe 3D inmersivo (Three.js)
   - Modelo GLB del guante de cristales generado con Higgsfield (imagen → 3D, Tripo H3.1)
   - Pista de baile "Billie Jean": baldosas que se encienden bajo el cursor y laten solas
   - Interacción: arrastrar = girar el guante · clic/Enter sobre él = ¡Hee-Hee! + destello
   - Cámara con parallax del cursor y travelling al hacer scroll · bloom cinematográfico
   - Accesible: respeta prefers-reduced-motion y cae a imagen fija si no hay WebGL
============================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const hero = document.getElementById('inicio');
const canvas = document.getElementById('stage3d');
const loaderEl = document.getElementById('h3dLoader');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback() { hero.classList.add('h3d--fallback'); loaderEl?.remove(); }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) { fallback(); throw e; }

const DPR = Math.min(devicePixelRatio, 1.75);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060a);
scene.fog = new THREE.FogExp2(0x07060a, 0.085);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const CAM = new THREE.Vector3(0, 1.35, 7.2);
camera.position.copy(CAM);

/* ---------- Luces: cenital dorada (spot) que sigue al cursor + contra neón ---------- */
scene.add(new THREE.AmbientLight(0x2a2030, 0.6));
const spot = new THREE.SpotLight(0xffd79a, 38, 20, Math.PI / 9, 0.6, 1.6);
spot.position.set(0, 7, 2.5);
scene.add(spot, spot.target);
const rim = new THREE.PointLight(0xff2e63, 14, 9, 1.6);
rim.position.set(-2.6, 1.6, -1.8);
const rim2 = new THREE.PointLight(0x6fa8ff, 8, 9, 1.6);
rim2.position.set(2.8, 1.2, -1.2);
scene.add(rim, rim2);

/* ---------- Pista de baile Billie Jean (InstancedMesh) ---------- */
const COLS = 15, ROWS = 11, TILE = 0.62, GAP = 0.05;
const tileGeo = new THREE.BoxGeometry(TILE, 0.06, TILE);
// Capa base: baldosas de vidrio oscuro que reflejan el entorno
const tileMat = new THREE.MeshStandardMaterial({ color: 0x0d0b12, roughness: 0.22, metalness: 0.65 });
const floor = new THREE.InstancedMesh(tileGeo, tileMat, COLS * ROWS);
// Capa de luz: un panel emisivo por baldosa (aditivo, sin tone mapping → alimenta el bloom)
const glowGeo = new THREE.PlaneGeometry(TILE * 0.92, TILE * 0.92); glowGeo.rotateX(-Math.PI / 2);
const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const glowTiles = new THREE.InstancedMesh(glowGeo, glowMat, COLS * ROWS);
const PALETTE = [0xf4d58d, 0xffffff, 0xff2e63, 0xd4af37, 0xfff0c8].map((c) => new THREE.Color(c));
const tiles = [];
const m4 = new THREE.Matrix4(), col = new THREE.Color();
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const i = r * COLS + c;
  const x = (c - (COLS - 1) / 2) * (TILE + GAP), z = (r - (ROWS - 1) / 2) * (TILE + GAP) - 1.2;
  m4.makeTranslation(x, -0.03, z); floor.setMatrixAt(i, m4);
  m4.makeTranslation(x, 0.002, z); glowTiles.setMatrixAt(i, m4);
  tiles.push({ x, z, glow: 0, hue: PALETTE[(c * 7 + r * 3) % PALETTE.length] });
  glowTiles.setColorAt(i, col.setRGB(0, 0, 0));
}
scene.add(floor, glowTiles);
// Plano invisible para proyectar el cursor sobre la pista
const floorHit = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ visible: false }));
floorHit.rotation.x = -Math.PI / 2; scene.add(floorHit);

/* ---------- Polvo dorado flotante ---------- */
const DUST = 900, dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 12; dustPos[i * 3 + 1] = Math.random() * 6; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
  dustSeed[i] = Math.random() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const sprite = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,240,200,1)'); grd.addColorStop(0.35, 'rgba(244,213,141,.55)'); grd.addColorStop(1, 'rgba(244,213,141,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.06, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf4d58d }));
scene.add(dust);

/* ---------- Destello al tocar el guante ---------- */
const BURST = 160, burstPos = new Float32Array(BURST * 3), burstVel = new Float32Array(BURST * 3);
const burstGeo = new THREE.BufferGeometry(); burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burstMat = new THREE.PointsMaterial({ size: 0.11, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, opacity: 0 });
scene.add(new THREE.Points(burstGeo, burstMat));
let burstT = 1;

/* ---------- Guante 3D ---------- */
const pivot = new THREE.Group();   // giro por arrastre
const bob = new THREE.Group();     // flotación
pivot.add(bob); scene.add(pivot);
pivot.position.set(1.75, 1.3, 0);
let glove = null;
const BASE_YAW = -Math.PI / 2;   // orientación inicial: la palma mira a la cámara

const loader = new GLTFLoader();
loader.load('assets/3d/crystal-glove.glb', (gltf) => {
  glove = gltf.scene;
  const box = new THREE.Box3().setFromObject(glove), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const s = 1.95 / size.y;
  glove.scale.setScalar(s);
  glove.position.copy(center).multiplyScalar(-s);
  glove.traverse((o) => {
    if (o.isMesh) {
      o.material.envMapIntensity = 1.05;
      o.material.roughness = 0.55;   // los cristales devuelven brillos sin quemarse
    }
  });
  glove.rotation.y = BASE_YAW;
  bob.add(glove);
  hero.classList.add('h3d--ready');
  loaderEl?.classList.add('is-done');
  setTimeout(() => loaderEl?.remove(), 900);
  intro();
}, (p) => {
  if (p.total && loaderEl) loaderEl.querySelector('b').textContent = String(Math.round((p.loaded / p.total) * 100)).padStart(3, '0');
}, () => fallback());

/* ---------- Postproceso: bloom ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- Tamaño ---------- */
function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h;
  // En móvil el guante se centra y la cámara retrocede
  const narrow = w < 768;
  pivot.position.x = narrow ? 0 : 1.75;
  pivot.position.y = narrow ? 2.4 : 1.3;
  pivot.scale.setScalar(narrow ? 0.72 : 1);
  camera.fov = narrow ? 44 : 34;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(hero); resize();

/* ---------- Interacción ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9), cursorFloor = new THREE.Vector3(99, 0, 99);
const look = { x: 0, y: 0, tx: 0, ty: 0 };
let spin = 0, spinVel = 0, tiltX = 0, dragging = false, lastX = 0, lastY = 0, moved = 0, hoverGlove = false;

function setNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  look.tx = ndc.x; look.ty = ndc.y;
}
function hitGlove() { if (!glove) return false; ray.setFromCamera(ndc, camera); return ray.intersectObject(glove, true).length > 0; }

canvas.addEventListener('pointermove', (e) => {
  setNdc(e);
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    spinVel = dx * 0.006; spin += spinVel; tiltX = Math.max(-0.5, Math.min(0.5, tiltX + dy * 0.004));
  } else {
    hoverGlove = hitGlove();
    canvas.style.cursor = hoverGlove ? 'pointer' : 'grab';
  }
});
canvas.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; setNdc(e); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', (e) => {
  dragging = false; canvas.style.cursor = 'grab';
  if (moved < 6) { setNdc(e); if (hitGlove()) heeHee(); }
});
canvas.addEventListener('pointerleave', () => { look.tx = 0; look.ty = 0; ndc.set(9, 9); hoverGlove = false; });

// Teclado: el lienzo es enfocable; flechas giran, Enter/Espacio = Hee-Hee
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { spinVel = -0.08; e.preventDefault(); }
  else if (e.key === 'ArrowRight') { spinVel = 0.08; e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' ') { heeHee(); e.preventDefault(); }
});
document.getElementById('h3dSpin')?.addEventListener('click', () => { spinVel = 0.35; });

let pulse = 0;
function heeHee() {
  // Reutiliza el botón Hee-Hee del sitio (sonido + chispas + respeto del silencio global)
  document.getElementById('heeheeBtn')?.click();
  spinVel = 0.32; pulse = 1; burstT = 0;
  for (let i = 0; i < BURST; i++) {
    burstPos[i * 3] = pivot.position.x; burstPos[i * 3 + 1] = pivot.position.y + 0.3; burstPos[i * 3 + 2] = pivot.position.z;
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), sp = 0.03 + Math.random() * 0.06;
    burstVel[i * 3] = Math.sin(b) * Math.cos(a) * sp; burstVel[i * 3 + 1] = Math.cos(b) * sp; burstVel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * sp;
  }
  // Onda de luz en la pista
  ripple = { x: pivot.position.x, z: 0, t: 0 };
}
let ripple = null;

/* ---------- Scroll: travelling de cámara ---------- */
let scrollK = 0;
addEventListener('scroll', () => { scrollK = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1))); }, { passive: true });

/* ---------- Entrada cinematográfica ---------- */
let introT = reduce ? 1 : 0;
function intro() { introT = reduce ? 1 : 0; }

/* ---------- Bucle ---------- */
const clock = new THREE.Clock();
let visible = true, running = true;
new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);
document.addEventListener('visibilitychange', () => { running = !document.hidden; });

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
function frame() {
  requestAnimationFrame(frame);
  if (!visible || !running) return;
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  if (introT < 1) introT = Math.min(1, introT + dt / 2.6);
  const ie = easeOut(introT);

  // Cámara: parallax + scroll + entrada
  look.x += (look.tx - look.x) * 0.05; look.y += (look.ty - look.y) * 0.05;
  camera.position.set(CAM.x + look.x * 0.55, CAM.y + look.y * 0.3 + scrollK * 1.6, CAM.z + (1 - ie) * 5 - scrollK * 1.8);
  camera.lookAt(pivot.position.x * 0.45, 1.2 + scrollK * 0.4, -0.4);

  // Guante: giro con inercia, flotación, pulso al tocar
  if (!dragging) { spinVel *= 0.95; spin += spinVel + (reduce ? 0 : 0.0035); tiltX *= 0.96; }
  pivot.rotation.set(tiltX, spin + (1 - ie) * -2.2, 0);
  bob.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.08 + (1 - ie) * -1.2;
  bob.rotation.z = reduce ? 0 : Math.sin(t * 0.7) * 0.05;
  pulse *= 0.93;
  const sc = 1 + pulse * 0.08 + (hoverGlove ? 0.03 : 0);
  bob.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.15);

  // Spot sigue al cursor sobre el escenario
  spot.target.position.set(pivot.position.x + look.x * 1.4, 0, look.y * -1.2);
  spot.intensity = 38 + pulse * 90;
  rim.intensity = 12 + Math.sin(t * 2.1) * 4 + pulse * 30;

  // Pista: el cursor ilumina, un latido recorre la pista, la onda del Hee-Hee se expande
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(floorHit)[0];
  if (hit) cursorFloor.copy(hit.point); else cursorFloor.set(99, 0, 99);
  if (ripple) { ripple.t += dt * 6; if (ripple.t > 14) ripple = null; }
  const beat = reduce ? 0 : Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.95)), 12);   // ~117 BPM (Billie Jean)
  for (let i = 0; i < tiles.length; i++) {
    const tl = tiles[i];
    const d = Math.hypot(tl.x - cursorFloor.x, tl.z - cursorFloor.z);
    let target = Math.max(0, 1 - d / 1.2) * 1.6;
    if (!reduce && ((i * 13 + Math.floor(t * 1.95)) % 23 === 0)) target = Math.max(target, 0.9 * beat + 0.15);
    if (ripple) { const rd = Math.abs(Math.hypot(tl.x - ripple.x, tl.z - ripple.z) - ripple.t); target = Math.max(target, Math.max(0, 1 - rd) * 1.4); }
    tl.glow += (target - tl.glow) * (target > tl.glow ? 0.35 : 0.06);
    const g = 0.035 + tl.glow * 0.9 * ie;
    col.copy(tl.hue).multiplyScalar(g); glowTiles.setColorAt(i, col);
  }
  glowTiles.instanceColor.needsUpdate = true;

  // Polvo dorado
  if (!reduce) {
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) {
      p[i * 3 + 1] += 0.0025 + Math.sin(t + dustSeed[i]) * 0.0008;
      p[i * 3] += Math.cos(t * 0.3 + dustSeed[i]) * 0.0012;
      if (p[i * 3 + 1] > 6) p[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  // Destello
  if (burstT < 1) {
    burstT += dt / 1.4;
    for (let i = 0; i < BURST * 3; i++) burstPos[i] += burstVel[i];
    for (let i = 0; i < BURST; i++) burstVel[i * 3 + 1] -= 0.0007;
    burstGeo.attributes.position.needsUpdate = true;
    burstMat.opacity = 1 - burstT;
  } else burstMat.opacity = 0;

  bloom.strength = 0.5 + pulse * 0.6;
  composer.render();
}
frame();
