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
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -3000, 3000);
eclairer(scene, renderer);
const tartine = await creerTartine();
scene.add(tartine);

// Scroll choreography
const trou = document.getElementById("depart");
const ancre = document.getElementById("histoire-ancre");
const histoire = document.getElementById("histoire");
const arrivee = document.getElementById("atterrissage");
const etapes = [...histoire.querySelectorAll(".etape")];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sortie = (t) => 1 - Math.pow(1 - t, 3);
const spin = calme ? 0 : 1;
function rect(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width };
}
const melange = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.right = innerWidth; camera.bottom = -innerHeight;
  camera.updateProjectionMatrix();
}

function frame(t) {
  const y = scrollY, vh = innerHeight;
  const debut = histoire.offsetTop, fin = debut + histoire.offsetHeight - vh;
  const atterrit = Math.min(document.documentElement.scrollHeight - vh, arrivee.getBoundingClientRect().top + y - vh * 0.55);
  const chute = atterrit - vh * 0.8;
  const flotte = spin * Math.sin(t / 700) * 0.06;
  let r, rx = -0.35, ry = 0.35, rz = -0.2 + flotte;

  // 1. grows inside the title (pushing the words), then flies to the story
  const p1 = clamp(y / debut);
  document.documentElement.style.setProperty("--pousse", clamp(p1 / 0.35).toFixed(3));
  let etale = 1, croque = 0;
  if (y <= debut) {
    const k = ease(clamp((p1 - 0.35) / 0.65));
    r = melange(rect(trou), rect(ancre), k);
    ry = lerp(0.35, Math.PI, k * spin);
    etale = 0;
  // 2. scrollytelling: crumb side, turns to show the jam, gets ready to fall
  } else if (y <= fin) {
    const q = (y - debut) / (fin - debut);
    r = rect(ancre);
    // 1: bare bread turns to its face · 2: lies down, the knife spreads the jam · 3: bitten until only crumbs remain
    ry = Math.PI + ease(clamp(q / 0.3)) * Math.PI * spin;
    rx = lerp(-0.35, POSEE, ease(clamp((q - 0.3) / 0.12)));
    etale = clamp((q - 0.36) / 0.24);
    croque = clamp((q - 0.64) / 0.26); // only crumbs left from 0.9, before the fall
    const etape = q < 0.3 ? 0 : q < 0.62 ? 1 : 2;
    etapes.forEach((e, i) => e.classList.toggle("is-active", i === etape));
  // 3. drops out of the bottom of the screen
  } else if (y < chute) {
    const q = clamp((y - fin) / (vh * 0.6));
    const a = rect(ancre);
    r = { x: a.x, y: lerp(a.y + (y - fin), vh + a.s, ease(q)), s: a.s };
    rx = POSEE - q * 3 * Math.PI * spin;
    ry = 0;
    croque = 1; // the crumbs fall out of the screen
    // text leaves before the next section's colour arrives (brun on the next bg can fail contrast)
    etapes.forEach((e) => e.classList.remove("is-active"));
  // 4. falls from above onto the footer table, two flips, lands jam up
  } else {
    const q = sortie(clamp((y - chute) / (atterrit - chute)));
    const b = rect(arrivee);
    r = melange({ x: b.x, y: b.y - vh * 0.9, s: b.s * 1.4 }, b, q);
    rx = POSEE - (1 - q) * 2 * TOUR * spin;
    rz = 0.15 * q;
    ry = 0;
  }
  document.body.classList.toggle("is-posee", y >= chute && y >= atterrit - 2); // footer reacts to the landing
  // phase 4 keeps the defaults: a fresh tartine, jam spread, not bitten
  tartine.etaler(etale);
  tartine.croquer(croque);
  tartine.position.set(r.x, -r.y, 0);
  tartine.scale.setScalar(r.s / LARGEUR);
  tartine.rotation.set(rx, ry, rz);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener("resize", resize);
resize();
requestAnimationFrame(frame);
