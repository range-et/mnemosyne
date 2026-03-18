import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import {
  booleans, expansions, extrusions, geometries,
  hulls, measurements, primitives, text, transforms,
} from "@jscad/modeling";
import { serialize } from "@jscad/stl-serializer";

const { cuboid }             = primitives;
const { hull }               = hulls;
const { subtract, union }    = booleans;
const { expand }             = expansions;
const { extrudeLinear }      = extrusions;
const { path2 }              = geometries;
const { measureBoundingBox } = measurements;
const { vectorText }         = text;
const { translate }          = transforms;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas         = document.getElementById("qr3d-canvas");
const invertCb       = document.getElementById("td-invert");
const heightInput    = document.getElementById("td-height");
const heightVal      = document.getElementById("td-height-val");
const draftInput     = document.getElementById("td-draft");
const draftVal       = document.getElementById("td-draft-val");
const baseInput      = document.getElementById("td-base");
const baseVal        = document.getElementById("td-base-val");
const textSizeInput  = document.getElementById("td-text-size");
const textSizeVal    = document.getElementById("td-text-size-val");
const textRaiseInput = document.getElementById("td-text-raise");
const textRaiseVal   = document.getElementById("td-text-raise-val");
const lipEnableCb    = document.getElementById("td-lip-enable");
const lipWidthInput  = document.getElementById("td-lip-width");
const lipWidthVal    = document.getElementById("td-lip-width-val");
const exportBtn      = document.getElementById("td-export");
const notice         = document.getElementById("td-notice");
const noticeIcon     = document.getElementById("td-notice-icon");
const noticeMsg      = document.getElementById("td-notice-msg");

// ── Three.js scene ────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.06;
orbitControls.minDistance   = 5;
orbitControls.maxDistance   = 2000;

// Sky/ground hemisphere gives physically plausible ambient without flat wash
const hemiLight  = new THREE.HemisphereLight(0xfff4e0, 0x334455, 0.55);
// Strong key light from upper-right-front
const keyLight   = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(60, 100, 60);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.bias = -0.0002;
const sh = 80;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far  = 400;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -sh;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = sh;
// Soft fill from the left
const fillLight  = new THREE.DirectionalLight(0xfff0e8, 0.5);
fillLight.position.set(-50, 40, 20);
// Rim light from behind to separate the model from the background
const rimLight   = new THREE.DirectionalLight(0xccddff, 0.35);
rimLight.position.set(0, -20, -60);
scene.add(hemiLight, keyLight, fillLight, rimLight);

const mat = new THREE.MeshStandardMaterial({
  roughness: 0.5, metalness: 0.06, envMapIntensity: 0.85,
});
const matLip = new THREE.MeshStandardMaterial({
  roughness: 0.72, metalness: 0.02, envMapIntensity: 0.5,
});

let composer = null;
let ssaoPass   = null;

function ensureComposer(w, h) {
  if (!composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    ssaoPass = new SSAOPass(scene, camera, w, h, 24);
    ssaoPass.output       = SSAOPass.OUTPUT.Default;
    ssaoPass.kernelRadius = 10;
    ssaoPass.minDistance  = 0.0008;
    ssaoPass.maxDistance  = 0.14;
    composer.addPass(ssaoPass);
    composer.addPass(new OutputPass());
  }
  const pr = Math.min(window.devicePixelRatio, 2);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  ssaoPass.setSize(w, h);
}

function lipPreviewColor() {
  const c = new THREE.Color(readCSSVar("--strata-text-primary", "#e0e0e0"));
  const L   = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (L > 0.42) return c;
  c.setScalar(0.11);
  return c;
}

// ── State ─────────────────────────────────────────────────────────────────────
let qrMatrix    = null;
let labelText   = "";
let borderCells = 4;
let jscadParts  = [];
let modelGroup  = null;
let rebuildTimer = null;
let lastMatrixN = -1;  // sentinel — used to gate camera reframe

// ── JSCAD geometry builders ───────────────────────────────────────────────────

// JSCAD uses Z-up. We build in that space and convert to Three.js Y-up on the
// way out. Coordinate mapping: (x, y, z)_jscad → (x, z, −y)_three.

/**
 * Tapered frustum for one QR module.
 * Top face (Z = h) is FIXED at ms × ms — this is the printed surface.
 * Bottom face (Z = 0) = ms + 2·taper, where taper = h·tan(draftDeg).
 * Positive draft → flared base (standard mould-release).
 * Negative draft → undercut / inverted pyramid.
 */
function buildModuleJscad(cx, cy, ms, h, taper) {
  const bottomMs = Math.max(0.001, ms + 2 * taper);
  return hull(
    translate([cx, cy, h], cuboid({ size: [ms,       ms,       0.001] })), // top = ms (fixed)
    translate([cx, cy, 0], cuboid({ size: [bottomMs, bottomMs, 0.001] })), // bottom = widened/narrowed
  );
}

/**
 * Raised label text sitting on top of the base plate (Z = 0 → raise).
 * Centred at (0, labelCenterY) in JSCAD XY — reads L-R when viewed from above.
 */
function buildLabelTextJscad(input, size, raise, labelCenterY) {
  const segs = vectorText({ height: size, input });
  if (!segs.length) return null;

  const paths    = segs.filter(s => s.length >= 2).map(s => path2.fromPoints({ closed: false }, s));
  if (!paths.length) return null;

  const expanded = paths.map(p => expand({ delta: size * 0.07, corners: "round", segments: 4 }, p));
  const extruded = expanded.map(p => extrudeLinear({ height: raise }, p));
  if (!extruded.length) return null;

  const solid = extruded.length === 1 ? extruded[0] : union(extruded);
  const bb    = measureBoundingBox(solid);
  const cx    = (bb[0][0] + bb[1][0]) / 2;
  const cy    = (bb[0][1] + bb[1][1]) / 2;

  return translate([-cx, labelCenterY - cy, 0], solid);
}

/**
 * Square ring along the inner edge of the quiet zone (just outside the n×n grid).
 * Extrudes upward — recessed channel beside it is meant for paint fill.
 */
function buildInnerLipJscad(n, lipW, lipH) {
  if (lipW <= 0.05 || lipH <= 0.05) return null;
  const outer = translate([0, 0, lipH / 2], cuboid({ size: [n + 2 * lipW, n + 2 * lipW, lipH] }));
  const inner = translate(
    [0, 0, lipH / 2],
    cuboid({ size: [Math.max(n - 0.02, 0.5), Math.max(n - 0.02, 0.5), lipH + 1] }),
  );
  try {
    return subtract(outer, inner);
  } catch {
    return null;
  }
}

// ── JSCAD → Three.js BufferGeometry ──────────────────────────────────────────

function collectPositions(geom, out) {
  for (const poly of geom.polygons) {
    const vs = poly.vertices;
    // Fan-triangulate; CCW winding preserved by (x,y,z)→(x,z,−y) rotation
    for (let i = 1; i < vs.length - 1; i++) {
      out.push(vs[0][0],   vs[0][2],   -vs[0][1]);
      out.push(vs[i][0],   vs[i][2],   -vs[i][1]);
      out.push(vs[i+1][0], vs[i+1][2], -vs[i+1][1]);
    }
  }
}

function toBufferGeometry(geoms) {
  const arr = Array.isArray(geoms) ? geoms : [geoms];
  const pos = [];
  for (const g of arr) collectPositions(g, pos);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

// ── Scene utilities ───────────────────────────────────────────────────────────

function disposeGroup(group) {
  group.traverse(obj => { if (obj.isMesh) obj.geometry.dispose(); });
  scene.remove(group);
}

function readCSSVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function syncRendererBackground() {
  const bg = new THREE.Color(readCSSVar("--strata-bg", "#121212"));
  renderer.setClearColor(bg);
  scene.background = bg;
}

// ── Scene builder ─────────────────────────────────────────────────────────────

function rebuild() {
  if (modelGroup) { disposeGroup(modelGroup); modelGroup = null; }
  jscadParts = [];
  if (!qrMatrix) return;

  mat.color.set(readCSSVar("--strata-text-primary", "#e0e0e0"));
  syncRendererBackground();

  const invert        = invertCb.checked;
  const h             = parseFloat(heightInput.value);
  const draftDeg      = parseFloat(draftInput.value);
  const baseThickness = parseFloat(baseInput.value);
  const textSizeMm    = parseFloat(textSizeInput.value);
  const labelRaiseMm  = parseFloat(textRaiseInput.value);
  const lipW          = lipEnableCb?.checked ? parseFloat(lipWidthInput?.value ?? 0.35) : 0;
  const lipH          = h; // lip is always as tall as the module extrusions

  const n      = qrMatrix.length;
  const ms     = 1;
  const offset = (n * ms) / 2;
  const bw     = borderCells * ms;                          // border width (mm)
  const lh     = labelText ? textSizeMm * 2.0 : 0;         // label area height (mm)
  const taper  = h * Math.tan((draftDeg * Math.PI) / 180); // can be negative

  modelGroup = new THREE.Group();

  // ── Base plate ───────────────────────────────────────────────────────────
  // Extends bw on all sides; label area adds lh on the Y− side (Three.js Z+)
  const plateWX  = n * ms + 2 * bw;
  const plateWY  = n * ms + 2 * bw + lh;
  const plateCY  = -lh / 2;  // shift centre toward label side

  const baseJscad = translate(
    [0, plateCY, -baseThickness / 2],
    cuboid({ size: [plateWX, plateWY, baseThickness] }),
  );
  jscadParts.push(baseJscad);
  const baseMesh = new THREE.Mesh(toBufferGeometry(baseJscad), mat);
  baseMesh.castShadow = baseMesh.receiveShadow = true;
  modelGroup.add(baseMesh);

  // ── Inner lip (paint channel rim, outside n×n, does not cover modules) ──
  if (lipW > 0 && lipH > 0) {
    const lipJscad = buildInnerLipJscad(n * ms, lipW, lipH);
    if (lipJscad) {
      jscadParts.push(lipJscad);
      matLip.color.copy(lipPreviewColor());
      const lipMesh = new THREE.Mesh(toBufferGeometry(lipJscad), matLip);
      lipMesh.castShadow = lipMesh.receiveShadow = true;
      modelGroup.add(lipMesh);
    }
  }

  // ── QR modules ────────────────────────────────────────────────────────────
  const modGeoms = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cellRaised = invert ? !qrMatrix[row][col] : qrMatrix[row][col];
      if (!cellRaised) continue;
      const cx = col * ms + ms / 2 - offset;
      const cy = row * ms + ms / 2 - offset;
      modGeoms.push(buildModuleJscad(cx, cy, ms, h, taper));
    }
  }
  if (modGeoms.length > 0) {
    jscadParts.push(...modGeoms);
    const modMesh = new THREE.Mesh(toBufferGeometry(modGeoms), mat);
    modMesh.castShadow = modMesh.receiveShadow = true;
    modelGroup.add(modMesh);
  }

  // ── Label text (raised on top face of base plate, in the border area) ────
  if (labelText && lh > 0) {
    try {
      const labelCenterY = -(n / 2 + bw + lh / 2);
      const textJscad = buildLabelTextJscad(labelText, textSizeMm, labelRaiseMm, labelCenterY);
      if (textJscad) {
        jscadParts.push(textJscad);
        const textMesh = new THREE.Mesh(toBufferGeometry(textJscad), mat);
        textMesh.castShadow = textMesh.receiveShadow = true;
        modelGroup.add(textMesh);
      }
    } catch (e) {
      console.warn("Label text geometry failed:", e);
    }
  }

  scene.add(modelGroup);

  // ── Camera — only reframe when the QR version (matrix size) changes ──────
  // Preserves orbit state between parameter tweaks.
  if (n !== lastMatrixN) {
    lastMatrixN = n;
    const span = Math.max(plateWX, plateWY, h + baseThickness);
    camera.position.set(span * 0.7, span * 0.65, span * 1.1);
    orbitControls.target.set(0, (h - baseThickness) / 2, 0);
    orbitControls.update();
  }
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 60);
}

// ── Renderer sizing ───────────────────────────────────────────────────────────
let lastW = 0, lastH = 0;

function resizeRenderer() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ensureComposer(w, h);
}

// ── Render loop ───────────────────────────────────────────────────────────────

function is3dVisible() {
  const panel = document.getElementById("threed");
  return panel && panel.style.display !== "none" && !document.hidden;
}

function animate() {
  requestAnimationFrame(animate);
  if (!is3dVisible()) return;
  orbitControls.update();
  if (composer) {
    try {
      composer.render();
    } catch (err) {
      console.warn("Post-processing disabled:", err?.message ?? err);
      composer.dispose?.();
      composer = null;
      ssaoPass = null;
      renderer.render(scene, camera);
    }
  } else {
    renderer.render(scene, camera);
  }
}
animate();

// ── STL export ────────────────────────────────────────────────────────────────

function exportSTL() {
  if (!jscadParts.length) {
    showNotice("No 3D model yet — generate a QR code first.", "info");
    return;
  }
  try {
    const rawData = serialize({ binary: true }, ...jscadParts);
    const blob    = new Blob(rawData, { type: "model/stl" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = "qr-code.stl";
    a.click();
    URL.revokeObjectURL(url);
    showNotice("STL exported.", "success");
  } catch (e) {
    showNotice("Export failed: " + e.message, "error");
    console.error("STL export error:", e);
  }
}

// ── Notice helper ─────────────────────────────────────────────────────────────

const NOTICE_ICONS = { info: "i", warning: "!", error: "✕", success: "✓" };

function showNotice(msg, type = "info") {
  notice.style.display   = "";
  noticeIcon.textContent = NOTICE_ICONS[type] ?? "i";
  noticeMsg.textContent  = msg;
  notice.className       = `atomos-notice atomos-notice--${type} td-notice`;
}

// ── Slider sync helper ────────────────────────────────────────────────────────

function wire(input, display, decimals, onChange) {
  const sync = () => { display.textContent = parseFloat(input.value).toFixed(decimals); };
  input.addEventListener("input", () => { sync(); onChange(); });
  sync();
}

// ── Event wiring ──────────────────────────────────────────────────────────────

wire(heightInput,    heightVal,    1, scheduleRebuild);
wire(draftInput,     draftVal,     1, scheduleRebuild);
wire(baseInput,      baseVal,      1, scheduleRebuild);
wire(textSizeInput,  textSizeVal,  1, scheduleRebuild);
wire(textRaiseInput, textRaiseVal, 1, scheduleRebuild);
if (lipWidthInput && lipWidthVal) wire(lipWidthInput, lipWidthVal, 2, scheduleRebuild);
lipEnableCb?.addEventListener("change", rebuild);

invertCb.addEventListener("change", rebuild);
exportBtn.addEventListener("click", exportSTL);

// Label text + border dimensions arrive from app.js via qr-updated
document.addEventListener("qr-updated", (e) => {
  if (!e.detail) {
    qrMatrix = null; labelText = ""; borderCells = 4;
    rebuild();
    return;
  }
  const dimensionsChanged = !qrMatrix || qrMatrix.length !== e.detail.matrix.length;
  qrMatrix    = e.detail.matrix;
  labelText   = e.detail.labelText   ?? "";
  borderCells = e.detail.borderCells ?? 4;
  // Reset camera sentinel if the QR grid size changed so the new build reframes
  if (dimensionsChanged) lastMatrixN = -1;
  rebuild();
});

document.addEventListener("tab-changed", (e) => {
  if (e.detail !== "3d") return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    lastW = 0; lastH = 0;
    syncRendererBackground();
    resizeRenderer();
    rebuild();
  }));
});

const ro = new ResizeObserver(() => requestAnimationFrame(resizeRenderer));
ro.observe(canvas);

syncRendererBackground();
