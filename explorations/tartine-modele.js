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

function illustre(m) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, grain);
    s.fragmentShader = s.fragmentShader
      .replace("void main() {", `uniform float uGrain, uTaille, uChaud, uTons, uRatio;
float bruit(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {`)
      .replace("#include <dithering_fragment>", `
  float h = bruit(floor(gl_FragCoord.xy / (uTaille * uRatio)));
  float l = dot(gl_FragColor.rgb, vec3(.299, .587, .114));
  if (uTons > .5) { // posterize the light, the grain breaks up the edges between tones
    float q = (floor(clamp(l + (h - .5) * uGrain * .5, 0., 1.) * uTons) + .6) / uTons;
    gl_FragColor.rgb *= q / max(l, .001);
    l = q;
  }
  gl_FragColor.rgb *= mix(vec3(1.), vec3(1.12, .82, .68), uChaud * (1. - l));
  // multiplicative: the grain darkens/lightens the colour itself, no grey specks
  gl_FragColor.rgb *= 1. + (h - .5) * uGrain * (.3 + .7 * (1. - l)) * .6;
  #include <dithering_fragment>`);
  };
}

// The toast from ~/Projets/Blender/tartine_confiture.blend (Bread, Jam, LogoJam), exported as GLB
export async function creerTartine({ confiture = false } = {}) {
  const gltf = await new GLTFLoader().loadAsync(new URL("assets/tartine.glb", document.baseURI).href);
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      o.material.transmission = 0; // the .blend's see-through jam costs a second render pass every frame; clearcoat keeps the shine
      illustre(o.material);
    }
    if (o.name === "Jam") o.visible = confiture; // hidden in the .blend too
  });
  gltf.scene.rotation.x = Math.PI / 2; // Blender lies flat (Z up); turn the jam face toward the camera (+Z)
  const tartine = new THREE.Group();
  tartine.add(gltf.scene);
  return tartine;
}

// Soft studio light plus a room reflection for the glossy jam
export function eclairer(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x9a5a3a, 1.2));
  const soleil = new THREE.DirectionalLight(0xfff6ea, 2);
  soleil.position.set(-1, 2, 3);
  scene.add(soleil);
}
