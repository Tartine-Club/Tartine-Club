import * as THREE from "three";
import { creerTartine, eclairer, LARGEUR } from "./tartine-modele.js";

const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUR = Math.PI * 2;
const POSEE = -1.05; // lying on the table, jam up

// Scene: orthographic camera in CSS pixels, so DOM anchors map 1:1 to world coordinates
const canvas = document.getElementById("tartine-3d");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 6000);
camera.position.z = 3000; // in front of the toast so raycasts start before it
eclairer(scene, renderer);
const tartine = await creerTartine();
scene.add(tartine);

// --- Jam painting: the bread texture is copied to a canvas the jars draw on
const pain = tartine.pain;
const source = pain.material.map.image;
const toile = document.createElement("canvas");
toile.width = source.width; toile.height = source.height;
const ctx = toile.getContext("2d");
const nouvelleTranche = () => { ctx.drawImage(source, 0, 0); texture.needsUpdate = true; };
const texture = new THREE.CanvasTexture(toile);
Object.assign(texture, { flipY: false, colorSpace: THREE.SRGBColorSpace, wrapS: pain.material.map.wrapS, wrapT: pain.material.map.wrapT, anisotropy: 4 });
pain.material.map = texture;
nouvelleTranche();

let pot = null; // selected jam colour
function trait(a, b) {
  const W = toile.width, H = toile.height, r = W * 0.014;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.strokeStyle = pot; ctx.lineWidth = r * 2;
  ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke();
  // glossy streak so it reads as jam, not felt pen
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = r * 0.45;
  ctx.beginPath(); ctx.moveTo(a.x * W - r * 0.35, a.y * H - r * 0.35); ctx.lineTo(b.x * W - r * 0.35, b.y * H - r * 0.35); ctx.stroke();
  texture.needsUpdate = true;
}

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function touche(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(pain, false)[0];
  return h?.uv ? h.uv.clone() : null;
}

// --- Hero interaction: tilt toward the mouse, drag to turn, paint when a jar is picked
const zone = document.getElementById("hero-ancre");
let userX = -0.3, userY = 0, glisse = null, peint = false, dernier = null;
const souris = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { souris.x = e.clientX / innerWidth - 0.5; souris.y = e.clientY / innerHeight - 0.5; });
zone.addEventListener("pointerdown", (e) => {
  zone.setPointerCapture(e.pointerId);
  const uv = pot ? touche(e) : null;
  if (uv) { peint = true; dernier = uv; trait(uv, uv); }
  else glisse = { x: e.clientX, y: e.clientY, ux: userX, uy: userY };
});
zone.addEventListener("pointermove", (e) => {
  if (peint) {
    const uv = touche(e);
    if (uv && dernier) trait(dernier, uv);
    dernier = uv; // lifting off the bread breaks the stroke instead of drawing across the gap
  } else if (glisse) {
    userY = glisse.uy + (e.clientX - glisse.x) / 140;
    userX = Math.min(0.5, Math.max(-1.4, glisse.ux + (e.clientY - glisse.y) / 140));
  }
});
const lache = () => { peint = false; glisse = null; dernier = null; };
zone.addEventListener("pointerup", lache);
zone.addEventListener("pointercancel", lache);

document.querySelectorAll("[data-confiture]").forEach((b, _, tous) => b.addEventListener("click", () => {
  const actif = b.getAttribute("aria-pressed") !== "true";
  tous.forEach((x) => x.setAttribute("aria-pressed", "false"));
  b.setAttribute("aria-pressed", String(actif));
  pot = actif ? b.dataset.confiture : null;
  if (pot) tartine.jam.material.color.set(pot); // the spread jam in the story uses the last jar picked
  zone.classList.toggle("avec-pot", !!pot);
}));
document.getElementById("nouvelle-tranche").addEventListener("click", nouvelleTranche);

// --- Story: the toast zigzags from anchor to anchor as each block crosses the middle of the screen
const ancres = ["hero-ancre", "etape-1", "etape-2", "etape-3"].map((id) => document.getElementById(id));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width }; };
const melange = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) });
const tourne = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const POSE_1 = [-0.35, Math.PI + 0.25, -0.15]; // bare crumb side
const POSE_2 = [POSEE, TOUR, 0.12];          // flipped onto its face, lying down
const POSE_3 = [POSEE, TOUR, -0.1];

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.right = innerWidth; camera.bottom = -innerHeight;
  camera.updateProjectionMatrix();
}

function frame(t) {
  const c = innerHeight / 2, R = ancres.map(rect);
  // k: 0 = hero, 1 = step 1 centred, 2 = step 2, 3 = step 3
  // past step 3, k keeps growing while the block leaves, so the last bites happen on the way out
  let k = 3 + (c - R[3].y) / (innerHeight * 0.5);
  if (R[0].y >= c) k = 0;
  else for (let i = 0; i < 3; i++) if (R[i + 1].y >= c) { k = i + (c - R[i].y) / (R[i + 1].y - R[i].y); break; }
  const i = Math.min(2, Math.floor(k));
  const r = k >= 3 ? R[3] : melange(R[i], R[i + 1], ease(k - i));

  const vit = calme ? 0 : 1;
  const hy = ((userY + Math.PI) % TOUR + TOUR) % TOUR - Math.PI; // closest turn, so leaving the hero never spins back
  const heros = [userX + souris.y * 0.35 * vit, hy + souris.x * 0.6 * vit + Math.sin(t / 900) * 0.08 * vit, -0.08];
  let rot, etale = 0, croque = 0;
  if (k < 1) rot = tourne(heros, POSE_1, ease(k));
  else if (k < 2) { rot = tourne(POSE_1, POSE_2, ease(clamp((k - 1) / 0.5))); etale = clamp((k - 1.45) / 0.55); }
  else { rot = tourne(POSE_2, POSE_3, clamp(k - 2)); etale = 1; croque = clamp((k - 2.5) / 1.1); }

  tartine.etaler(etale);
  tartine.croquer(croque);
  tartine.position.set(r.x, -r.y, 0);
  tartine.scale.setScalar(r.s / LARGEUR);
  tartine.rotation.set(...rot);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener("resize", resize);
resize();
requestAnimationFrame(frame);
