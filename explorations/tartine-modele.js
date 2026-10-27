import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const LARGEUR = 1.14; // width of the Blender "Bread" mesh

// Illustration look, shared by every material of the model
export const grain = {
  uGrain: { value: 0.8 },  // grain strength
  uTaille: { value: 1.5 }, // grain size in CSS px
  uChaud: { value: 0.6 },  // shadows turn warm instead of grey
  uTons: { value: 0 },     // 0 = smooth gradient, 2-5 = flat tones with grainy edges
  uRatio: { value: Math.min(devicePixelRatio, 2) },
};

// Bites, in Blender coordinates of the slice: (x, y, radius); radius 0 = not bitten yet
const BOUCHEES = [[0.55, 0.38, 0.24], [-0.52, 0.46, 0.26], [0.47, -0.45, 0.32], [-0.36, -0.3, 0.44]];
const bouchees = { value: BOUCHEES.map(() => new THREE.Vector3()) };

function illustre(m, croquable = false) {
  m.customProgramCacheKey = () => (croquable ? "croquable" : "illustre"); // same source text, different shader
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, grain, { uBouchees: bouchees });
    if (croquable) {
      s.vertexShader = s.vertexShader.replace("void main() {", "varying vec3 vLocal;\nvoid main() {\n  vLocal = position;");
    }
    s.fragmentShader = s.fragmentShader
      .replace("void main() {", `uniform float uGrain, uTaille, uChaud, uTons, uRatio;
${croquable ? "uniform vec3 uBouchees[4];\nvarying vec3 vLocal;" : ""}
float bruit(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float bord = 1.;
  ${croquable ? `
  vec2 pb = vec2(vLocal.x, -vLocal.z); // glTF is Y-up: back to Blender x/y
  for (int i = 0; i < 4; i++) {
    vec2 d = pb - uBouchees[i].xy;
    float r = uBouchees[i].z * (1. + .07 * sin(atan(d.y, d.x) * 11.)); // teeth marks
    float l = length(d);
    if (l < r) discard;
    if (uBouchees[i].z > 0.) bord = min(bord, (l - r) / .025);
  }` : ""}`)
      .replace("#include <dithering_fragment>", `
  float h = bruit(floor(gl_FragCoord.xy / (uTaille * uRatio)));
  float l = dot(gl_FragColor.rgb, vec3(.299, .587, .114));
  if (uTons > .5) { // posterize the light, the grain breaks up the edges between tones
    float q = (floor(clamp(l + (h - .5) * uGrain * .5, 0., 1.) * uTons) + .6) / uTons;
    gl_FragColor.rgb *= q / max(l, .001);
    l = q;
  }
  gl_FragColor.rgb *= mix(vec3(1.), vec3(1.12, .82, .68), uChaud * (1. - l));
  gl_FragColor.rgb *= mix(.62, 1., clamp(bord, 0., 1.)); // darker rim along the bite
  // multiplicative: the grain darkens/lightens the colour itself, no grey specks
  gl_FragColor.rgb *= 1. + (h - .5) * uGrain * (.3 + .7 * (1. - l)) * .6;
  #include <dithering_fragment>`);
  };
}

const matIllustre = (o) => { const m = new THREE.MeshStandardMaterial(o); illustre(m); return m; };

function couteau() {
  const g = new THREE.Group();
  const lame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.012), matIllustre({ color: 0xd9dde0, metalness: 0.6, roughness: 0.3 }));
  const manche = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.045), matIllustre({ color: 0xdc472e, roughness: 0.6 }));
  lame.position.x = -0.13; manche.position.x = 0.21;
  g.add(lame, manche);
  return g;
}

function miettes() {
  const g = new THREE.Group(), geo = new THREE.IcosahedronGeometry(1, 0);
  const mats = [matIllustre({ color: 0xc97a35, roughness: 0.9 }), matIllustre({ color: 0xf2d08a, roughness: 0.9 })];
  // around each bite, then the last batch where the slice used to be
  const zones = [...BOUCHEES, [0, 0.05, 0.42]];
  zones.forEach(([x, y, r], k) => {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo, mats[i % 2]);
      const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.7;
      m.position.set(Math.max(-0.5, Math.min(0.5, x * 0.8 + Math.cos(a) * d)), Math.max(-0.5, Math.min(0.55, y * 0.8 + Math.sin(a) * d)), 0.07 + Math.random() * 0.03);
      m.scale.setScalar(0.012 + Math.random() * 0.024);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      m.userData.bouchee = k;
      g.add(m);
    }
  });
  return g;
}

// The toast from ~/Projets/Blender/tartine_confiture.blend (Bread + Jam; the "Tartine" logo stays hidden)
export async function creerTartine() {
  const gltf = await new GLTFLoader().loadAsync(new URL("assets/tartine.glb", document.baseURI).href);
  const coupe = new THREE.Plane(); // world-space clip plane that reveals the jam
  let haut = -1; // reveal line, Blender y
  let pain, jam;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material.transmission = 0; // the .blend's see-through jam costs a second render pass every frame; clearcoat keeps the shine
    illustre(o.material, o.name !== "LogoJam");
    if (o.name === "LogoJam") o.visible = false;
    if (o.name === "Bread") pain = o;
    if (o.name === "Jam") { jam = o; o.material.clippingPlanes = [coupe]; }
  });
  gltf.scene.rotation.x = Math.PI / 2; // Blender lies flat (Z up); turn the jam face toward the camera (+Z)
  const tartine = new THREE.Group();
  const lame = couteau(), restes = miettes();
  tartine.add(gltf.scene, lame, restes);
  // keep the part of the jam above the reveal line (local y > haut)
  jam.onBeforeRender = () => coupe.set(new THREE.Vector3(0, 1, 0), -haut).applyMatrix4(tartine.matrixWorld);

  // 0 = bare bread, 1 = jam spread to the bottom; the knife strokes along the reveal line, then leaves
  tartine.etaler = (p) => {
    haut = 0.52 - p * 0.94;
    lame.visible = p > 0 && p < 1;
    lame.scale.setScalar(Math.min(1, p * 8, (1 - p) * 8));
    lame.position.set(Math.sin(p * Math.PI * 6) * 0.14, haut, 0.12);
    lame.rotation.set(0, -0.35, 0.12 * Math.sin(p * Math.PI * 6));
  };
  // 0 = whole, 1 = only crumbs left; four bites in between
  tartine.croquer = (p) => {
    const n = Math.min(5, Math.floor(p * 5 + 1e-6));
    BOUCHEES.forEach((b, i) => bouchees.value[i].set(b[0], b[1], i < n ? b[2] : 0));
    pain.visible = jam.visible = n < 5;
    restes.children.forEach((m) => (m.visible = m.userData.bouchee < n));
  };
  tartine.etaler(1);
  tartine.croquer(0);
  return tartine;
}

// Soft studio light plus a room reflection for the glossy jam
export function eclairer(scene, renderer) {
  renderer.localClippingEnabled = true; // jam reveal
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x9a5a3a, 1.2));
  const soleil = new THREE.DirectionalLight(0xfff6ea, 2);
  soleil.position.set(-1, 2, 3);
  scene.add(soleil);
}
