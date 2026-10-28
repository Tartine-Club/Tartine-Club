// 3D jam toasts in the "Petit-Déjeuner Gourmand" illustration style: toon shading + surface grain.
// Copied from Portfolio-Mael/tartine.js. Hero use: drag to turn, tap to switch to the next toast.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const FLAVORS = {
  fraise:   { jam: '#e1253a', chunk: '#b8142a', shine: '#ff8d97' },
  cerise:   { jam: '#a8102c', chunk: '#7d0a20', shine: '#ff6f86' },
  myrtille: { jam: '#5a2b8c', chunk: '#3d1866', shine: '#a98ae0' },
  abricot:  { jam: '#f39a1c', chunk: '#d97706', shine: '#ffd79a' },
};

// 3-step ramp = flat cartoon shading like the illustrations
const ramp = new THREE.DataTexture(new Uint8Array([95, 95, 95, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

// Grain stuck to the surface (object-space), dense in the shadows and almost gone in the light,
// clumped in irregular patches like dry-brush texture. `amount` = darkening of a speck in full shadow.
function grainy(material, amount = 0.09) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrainPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGrainPos;
float grainHash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float grainNoise(vec3 p) { // smooth value noise for the patches
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(grainHash(i), grainHash(i + vec3(1,0,0)), f.x), mix(grainHash(i + vec3(0,1,0)), grainHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(grainHash(i + vec3(0,0,1)), grainHash(i + vec3(1,0,1)), f.x), mix(grainHash(i + vec3(0,1,1)), grainHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#if NUM_DIR_LIGHTS > 0
  float lit = dot(normal, directionalLights[0].direction) * 0.5 + 0.5; // 0 = turned away, 1 = facing the sun
#else
  float lit = 0.5;
#endif
float shadow = 1.0 - smoothstep(0.4, 0.85, lit);
float patches = smoothstep(0.3, 0.8, grainNoise(vGrainPos * 7.0));
float density = (0.08 + 0.85 * shadow) * (0.35 + 0.65 * patches);
float speck = step(1.0 - density, grainHash(vGrainPos * 260.0));
gl_FragColor.rgb *= 1.0 - speck * ${(amount * 4.6).toFixed(3)} * (0.1 + 0.9 * shadow);`);
  };
  return material;
}
const toon = (color, grain) => grainy(new THREE.MeshToonMaterial({ color, gradientMap: ramp }), grain);

// Deterministic randomness so each variant always looks the same
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Superellipse with wobble: n = squareness (2 = oval, 4+ = rounded square)
function blob({ rx, ry, cx = 0, cy = 0, n = 4, wobble = [[0.05, 3, 1], [0.04, 5, 0], [0.03, 8, 2]], points = 180 }) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 / Math.pow(Math.abs(Math.cos(a)) ** n + Math.abs(Math.sin(a)) ** n, 1 / n);
    const w = wobble.reduce((acc, [amp, f, ph]) => acc + amp * Math.sin(f * a + ph), 1);
    pts.push(new THREE.Vector2(cx + Math.cos(a) * rx * k * w, cy + Math.sin(a) * ry * k * w));
  }
  return new THREE.Shape(pts); // dense polyline: smooth, and no kink where a spline would close
}

function classicShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.85, -1);
  s.lineTo(0.85, -1);
  s.quadraticCurveTo(1, -1, 1, -0.85);
  s.lineTo(1, 0.5);
  s.bezierCurveTo(1.22, 0.68, 1.16, 1.1, 0.64, 1.1);
  s.bezierCurveTo(0.34, 1.1, 0.2, 1.0, 0, 1.0);
  s.bezierCurveTo(-0.2, 1.0, -0.34, 1.1, -0.64, 1.1);
  s.bezierCurveTo(-1.16, 1.1, -1.22, 0.68, -1, 0.5);
  s.lineTo(-1, -0.85);
  s.quadraticCurveTo(-1, -1, -0.85, -1);
  return s;
}

// shape: bread outline · jam: where the spread sits on it
export const BREADS = {
  classique: { shape: classicShape, depth: 0.26, bevel: 0.13, crust: '#e8963a', crumb: '#f8dba3',
    jam: { rx: 0.76, ry: 0.72, cy: 0.02 } },
  campagne: { shape: () => blob({ rx: 1.3, ry: 0.92, n: 2.4, wobble: [[0.04, 2, 0.5], [0.03, 5, 1], [0.02, 9, 0]] }),
    depth: 0.3, bevel: 0.16, crust: '#b8652a', crumb: '#f1d29a', jam: { rx: 0.95, ry: 0.62, n: 2.6 } },
  brioche: { shape: () => blob({ rx: 0.95, ry: 1.0, n: 3.2, wobble: [[0.04, 2, 1.6]] }),
    depth: 0.44, bevel: 0.24, crust: '#e59a3e', crumb: '#fbe3b0', jam: { rx: 0.62, ry: 0.64, n: 3 } },
  biscotte: { shape: () => blob({ rx: 1.15, ry: 0.78, n: 5, wobble: [[0.012, 24, 0], [0.02, 3, 1]] }),
    depth: 0.1, bevel: 0.05, crust: '#cf7f33', crumb: '#f2c47a', jam: { rx: 0.92, ry: 0.6, n: 4 } },
  baguette: { shape: () => blob({ rx: 1.45, ry: 0.52, n: 2.2, wobble: [[0.03, 2, 0.4], [0.02, 6, 1]] }),
    depth: 0.28, bevel: 0.14, crust: '#d9822f', crumb: '#f6d79c', jam: { rx: 1.08, ry: 0.36, n: 2.4 } },
};

const flatShine = (color) => new THREE.MeshBasicMaterial({ color });
function shineDots(ctx, list, z) {
  list.forEach(([x, y, rx, ry, rot]) => {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), ctx.shine);
    dot.scale.set(rx, ry, 1);
    dot.position.set(x, y, z);
    dot.rotation.z = rot;
    ctx.group.add(dot);
  });
}
function spread(ctx, { scale = 1, depth = 0.03, bevel = 0.07 } = {}) {
  const j = ctx.jamArea;
  const geo = new THREE.ExtrudeGeometry(blob({ ...j, rx: j.rx * scale, ry: j.ry * scale }), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 72,
  });
  geo.translate(0, 0, ctx.top - bevel * 0.6);
  ctx.group.add(new THREE.Mesh(geo, ctx.jamMat));
  return ctx.top - bevel * 0.6 + depth + bevel; // z of the spread's top
}

// Each treatment adds its jam meshes on the bread's top face
export const JAMS = {
  // bumpy spread with puffy lumps (the original illustration)
  bosselee(ctx) {
    const z = spread(ctx);
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea, sx = rx / 0.76, sy = ry / 0.72;
    [[-0.35, 0.35, 0.3], [0.3, 0.42, 0.26], [0.45, -0.2, 0.28], [-0.4, -0.3, 0.27], [0, 0.02, 0.34], [0.05, -0.5, 0.22]]
      .forEach(([x, y, r]) => {
        const lump = new THREE.Mesh(new THREE.SphereGeometry(r * Math.min(sx, sy), 32, 16), ctx.jamMat);
        lump.scale.z = 0.28;
        lump.position.set(cx + x * sx, cy + y * sy, z - 0.02);
        ctx.group.add(lump);
      });
    shineDots(ctx, [[-0.42, 0.45, 0.17, 0.08, 0.5], [0.26, 0.55, 0.13, 0.07, -0.3], [0.62, 0.1, 0.14, 0.06, 1.2],
      [-0.66, -0.08, 0.1, 0.05, 1.4], [0.4, -0.45, 0.15, 0.07, -0.6], [-0.18, -0.58, 0.09, 0.045, 0.2], [0.02, 0.12, 0.12, 0.06, 0.4]]
      .map(([x, y, a, b, r]) => [cx + x * sx, cy + y * sy, a, b, r]), z + 0.075);
  },

  // thin glossy glaze with one long reflection streak
  lisse(ctx) {
    const z = spread(ctx, { depth: 0.02, bevel: 0.05 });
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea;
    const streak = [];
    for (let i = 0; i < 7; i++) {
      const a = 2.1 + i * 0.13;
      streak.push([cx + Math.cos(a) * rx * 0.72, cy + Math.sin(a) * ry * 0.72, 0.09 - Math.abs(i - 3) * 0.012, 0.045, a + Math.PI / 2]);
    }
    shineDots(ctx, [...streak, [cx + rx * 0.45, cy - ry * 0.5, 0.06, 0.04, 0.3], [cx + rx * 0.58, cy - ry * 0.32, 0.03, 0.03, 0]], z + 0.001);
  },

  // generous spread running over the crust in drips
  coulante(ctx) {
    const z = spread(ctx, { scale: 1.14 });
    const rand = rng(7), edge = ctx.edge;
    const front = edge.filter((p) => p.y < ctx.center.y - ctx.halfH * 0.35); // edge facing the viewer
    for (let i = 0; i < 4; i++) {
      const p = front[Math.floor(((i + 0.5) / 4) * front.length)];
      const out = new THREE.Vector2(p.x - ctx.center.x, p.y - ctx.center.y).normalize();
      const r = 0.07 + rand() * 0.035, len = 0.06 + rand() * (ctx.thickness * 0.55);
      const ex = p.x + out.x * (ctx.bevelSize + r * 0.5), ey = p.y + out.y * (ctx.bevelSize + r * 0.5);
      // flow from the spread to the rim
      const flow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12), ctx.jamMat);
      flow.scale.set(1.2, 1, 0.3);
      flow.position.set(p.x - out.x * 0.1, p.y - out.y * 0.1, ctx.top + 0.03);
      ctx.group.add(flow);
      // drip hanging down the crust, with a bulb at the end
      const drip = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), ctx.jamMat);
      drip.rotation.x = Math.PI / 2;
      drip.position.set(ex, ey, ctx.top - len / 2);
      ctx.group.add(drip);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 20, 12), ctx.jamMat);
      bulb.position.set(ex, ey, ctx.top - len - r * 0.3);
      ctx.group.add(bulb);
    }
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea;
    shineDots(ctx, [[cx - rx * 0.5, cy + ry * 0.55, 0.15, 0.07, 0.4], [cx + rx * 0.4, cy + ry * 0.4, 0.1, 0.05, -0.4],
      [cx + rx * 0.7, cy - ry * 0.2, 0.12, 0.05, 1.3], [cx - rx * 0.2, cy - ry * 0.4, 0.08, 0.04, 0.1]], z + 0.001);
  },

  // ribbon of jam swirled with the back of a spoon
  tourbillon(ctx) {
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea;
    const pts = [], turns = 2.6;
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = t * turns * Math.PI * 2, r = 0.1 + t * 0.9;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, 0));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.1, 14), ctx.jamMat);
    tube.scale.z = 0.5;
    tube.position.z = ctx.top + 0.03;
    ctx.group.add(tube);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), ctx.jamMat); // rounded ends
    [pts[0], pts[pts.length - 1]].forEach((p) => { const c = cap.clone(); c.scale.z = 0.5; c.position.set(p.x, p.y, ctx.top + 0.03); ctx.group.add(c); });
    const dots = [];
    for (let i = 10; i < 120; i += 16) dots.push([pts[i].x - 0.02, pts[i].y + 0.03, 0.05, 0.025, Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)]);
    shineDots(ctx, dots, ctx.top + 0.03 + 0.051);
  },

  // smooth jam with chunks of fruit and seeds
  morceaux(ctx) {
    const z = spread(ctx, { depth: 0.02, bevel: 0.05 });
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea, rand = rng(3);
    const chunkMat = toon(ctx.flavor.chunk, 0.08);
    const seed = flatShine('#ffd34d');
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.75, r = 0.11 + rand() * 0.07;
      const x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), chunkMat);
      chunk.scale.z = 0.55;
      chunk.rotation.z = rand() * 3;
      chunk.position.set(x, y, z);
      ctx.group.add(chunk);
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), seed);
        s.scale.y = 1.6;
        s.rotation.z = rand() * 3;
        s.position.set(x + (rand() - 0.5) * r * 0.9, y + (rand() - 0.5) * r * 0.9, z + r * 0.55 + 0.002);
        ctx.group.add(s);
      }
    }
    shineDots(ctx, [[cx - rx * 0.55, cy + ry * 0.5, 0.1, 0.05, 0.5], [cx + rx * 0.6, cy - ry * 0.45, 0.08, 0.04, -0.5]], z + 0.001);
  },

  // one fat spoonful dropped in the middle
  cuilleree(ctx) {
    const { rx, ry, cx = 0, cy = 0 } = ctx.jamArea;
    spread(ctx, { scale: 0.55, depth: 0.01, bevel: 0.04 });
    const R = Math.min(rx, ry) * 0.85, sz = 0.55;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20), ctx.jamMat);
    dome.scale.set(1.15, 1, sz);
    dome.position.set(cx, cy, ctx.top);
    ctx.group.add(dome);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(R * 0.32, 20, 12), ctx.jamMat); // spoon peak
    tip.scale.z = 1.3;
    tip.position.set(cx + R * 0.15, cy + R * 0.1, ctx.top + R * sz * 0.95);
    ctx.group.add(tip);
    // highlights sit on the dome surface
    const onDome = (u, v) => ctx.top + R * sz * Math.sqrt(Math.max(0, 1 - (u / 1.15) ** 2 - v ** 2)) + 0.004;
    [[-0.45, 0.35, 0.16, 0.07, 0.6], [-0.15, 0.55, 0.06, 0.04, 0.2], [0.5, -0.4, 0.07, 0.035, -0.6]].forEach(([u, v, a, b, r]) => {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), ctx.shine);
      dot.scale.set(a, b, 1);
      dot.position.set(cx + u * R, cy + v * R, onDome(u, v));
      dot.rotation.z = r;
      ctx.group.add(dot);
    });
  },
};

export function buildToast({ bread = 'classique', jam = 'bosselee', flavor = 'fraise' } = {}) {
  const b = BREADS[bread], f = FLAVORS[flavor];
  const group = new THREE.Group();

  // caps (group 0) = crumb, sides + rounded bevel (group 1) = crust rim
  const shape = b.shape();
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: b.depth, bevelEnabled: true, bevelThickness: b.bevel, bevelSize: b.bevel, bevelSegments: 10, curveSegments: 40,
  });
  // extrude normals are per face: with toon shading every facet shows as a step, so weld and smooth them
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  geo.translate(0, 0, -b.depth / 2);
  group.add(new THREE.Mesh(geo, [toon(b.crumb), toon(b.crust, 0.12)]));

  const edge = shape.getSpacedPoints(160);
  const box = new THREE.Box2().setFromPoints(edge);
  const center = box.getCenter(new THREE.Vector2());
  const ctx = {
    group, edge, center, flavor: f,
    halfH: (box.max.y - box.min.y) / 2,
    top: b.depth / 2 + b.bevel, thickness: b.depth + 2 * b.bevel, bevelSize: b.bevel,
    jamArea: { cx: center.x, cy: center.y, ...b.jam },
    jamMat: toon(f.jam, 0.07), shine: flatShine(f.shine),
  };
  JAMS[jam](ctx);

  group.position.set(-center.x, -center.y, 0);
  const toast = new THREE.Group();
  toast.add(group);
  return toast;
}

// Hero: every variant is built once; a tap flips the toast and swaps to the next one mid-turn
export function mountTartines(container, variants) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#fff6e8', '#c98a5a', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(-3, 4, 5);
  scene.add(sun);

  const toasts = variants.map((v) => buildToast(v));
  // one framing for all, so switching never jumps in size
  const radius = Math.max(...toasts.map((t) => new THREE.Box3().setFromObject(t).getBoundingSphere(new THREE.Sphere()).radius));
  camera.position.set(0, 0, (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.8); // tighter than the widest toast's sphere: the classic fills the stage like in the design
  const pivot = new THREE.Group();
  toasts.forEach((t, i) => { t.visible = i === 0; pivot.add(t); });
  pivot.rotation.set(-0.95, 0, 0.35); // 3/4 view like the illustration
  scene.add(pivot);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  let drag = null, vx = 0, vy = 0, flip = 0, current = 0, swapped = true;
  const next = () => {
    if (reduced) { toasts[current].visible = false; current = (current + 1) % toasts.length; toasts[current].visible = true; return; }
    flip = Math.PI * 2; swapped = false; // full turn: the new toast ends face up
  };
  const el = renderer.domElement;
  el.style.cursor = 'grab';
  el.style.touchAction = 'pan-y'; // vertical swipes still scroll the page on phones
  el.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    vx = dx * 0.012; vy = dy * 0.012;
    pivot.rotateOnWorldAxis(Y, vx);
    pivot.rotateOnWorldAxis(X, vy);
  });
  const release = () => {
    if (drag && drag.moved < 4) next();
    drag = null;
    el.style.cursor = 'grab';
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  container.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    if (!drag) {
      pivot.rotateOnWorldAxis(Y, vx);
      pivot.rotateOnWorldAxis(X, vy);
      vx *= 0.94; vy *= 0.94;
    }
    if (flip > 0.001) {
      const step = flip * 0.12;
      pivot.rotateOnWorldAxis(Y, step);
      flip -= step;
      if (!swapped && flip < Math.PI * 1.5) { // a quarter turn in, edge-on: nobody sees the swap
        toasts[current].visible = false;
        current = (current + 1) % toasts.length;
        toasts[current].visible = true;
        swapped = true;
      }
    }
    if (!reduced) toasts[current].position.y = Math.sin(t * 1.4) * 0.06; // gentle float
    renderer.render(scene, camera);
  });
}
