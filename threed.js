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

const { cuboid, cylinder }   = primitives;
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
const draftInput     = document.getElementById("td-draft");
const baseInput      = document.getElementById("td-base");
const textSizeInput  = document.getElementById("td-text-size");
const textRaiseInput = document.getElementById("td-text-raise");
const lipEnableCb    = document.getElementById("td-lip-enable");
const lipWidthInput  = document.getElementById("td-lip-width");
const gap1Input      = document.getElementById("td-gap1");
const gap2Input      = document.getElementById("td-gap2");
const exportBtn        = document.getElementById("td-export");
const notice           = document.getElementById("td-notice");
const noticeIcon       = document.getElementById("td-notice-icon");
const noticeMsg        = document.getElementById("td-notice-msg");
const attachmentSelect = document.getElementById("td-attachment");
const keyringOpts      = document.getElementById("td-keyring-opts");
const keyringRInput    = document.getElementById("td-keyring-r");
const mountOpts        = document.getElementById("td-mount-opts");
const mountRInput      = document.getElementById("td-mount-r");

// ── 3D settings persistence ───────────────────────────────────────────────────
function save3DSettings() {
  const s = localStorage;
  s.setItem("mn_3d_invert",    invertCb.checked     ? "1" : "0");
  s.setItem("mn_3d_height",    heightInput.value);
  s.setItem("mn_3d_draft",     draftInput.value);
  s.setItem("mn_3d_base",      baseInput.value);
  s.setItem("mn_3d_text_size", textSizeInput.value);
  s.setItem("mn_3d_text_raise",textRaiseInput.value);
  s.setItem("mn_3d_lip_enable",lipEnableCb?.checked  ? "1" : "0");
  s.setItem("mn_3d_lip_width", lipWidthInput?.value ?? "0.35");
  if (attachmentSelect) s.setItem("mn_3d_attach",   attachmentSelect.value);
  if (keyringRInput)    s.setItem("mn_3d_keyring_r", keyringRInput.value);
  if (mountRInput)      s.setItem("mn_3d_mount_r",   mountRInput.value);
  s.setItem("mn_3d_gap1", gap1Input?.value ?? "1");
  s.setItem("mn_3d_gap2", gap2Input?.value ?? "0.5");
}

function load3DSettings() {
  const g = (k) => localStorage.getItem(k);
  if (g("mn_3d_invert")    !== null) invertCb.checked       = g("mn_3d_invert")    === "1";
  if (g("mn_3d_height")    !== null) heightInput.value      = g("mn_3d_height");
  if (g("mn_3d_draft")     !== null) draftInput.value       = g("mn_3d_draft");
  if (g("mn_3d_base")      !== null) baseInput.value        = g("mn_3d_base");
  if (g("mn_3d_text_size") !== null) textSizeInput.value    = g("mn_3d_text_size");
  if (g("mn_3d_text_raise")!== null) textRaiseInput.value   = g("mn_3d_text_raise");
  if (lipEnableCb && g("mn_3d_lip_enable") !== null)
    lipEnableCb.checked = g("mn_3d_lip_enable") === "1";
  if (lipWidthInput && g("mn_3d_lip_width") !== null)
    lipWidthInput.value = g("mn_3d_lip_width");
  if (attachmentSelect && g("mn_3d_attach") !== null) {
    attachmentSelect.value = g("mn_3d_attach");
    // Show/hide attachment option panels
    const v = attachmentSelect.value;
    if (keyringOpts) keyringOpts.style.display = v === "keyring" ? "" : "none";
    if (mountOpts)   mountOpts.style.display   = v === "mount"   ? "" : "none";
  }
  if (keyringRInput && g("mn_3d_keyring_r") !== null) keyringRInput.value = g("mn_3d_keyring_r");
  if (mountRInput   && g("mn_3d_mount_r")   !== null) mountRInput.value   = g("mn_3d_mount_r");
  if (gap1Input && g("mn_3d_gap1") !== null) gap1Input.value = g("mn_3d_gap1");
  if (gap2Input && g("mn_3d_gap2") !== null) gap2Input.value = g("mn_3d_gap2");
}

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

// Cartesian gizmo overlay (bottom-left): world X/Y/Z orientation while orbiting.
const axesScene = new THREE.Scene();
const axesCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 10);
const axesHelper = new THREE.AxesHelper(1.1);
axesScene.add(axesHelper);

function makeAxisLabelSprite(text, color) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = "700 42px Instrument Sans, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeText(text, c.width / 2, c.height / 2 + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, c.height / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.34, 0.34, 0.34);
  return sprite;
}

const xLabel = makeAxisLabelSprite("X", "#ef4444");
const yLabel = makeAxisLabelSprite("Y", "#22c55e");
const zLabel = makeAxisLabelSprite("Z", "#3b82f6");
xLabel.position.set(1.28, 0, 0);
yLabel.position.set(0, 1.28, 0);
zLabel.position.set(0, 0, 1.28);
axesScene.add(xLabel, yLabel, zLabel);

const axesDir = new THREE.Vector3();

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
let lastSpan = -1;

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
 * Rectangular lip ring sitting INSIDE the quiet zone.
 * Structure: QR code → GAP1 → lip inner edge → lip → lip outer edge → GAP2 → hole.
 * innerHalf = half-width of the inner opening (lip inner edge).
 * lipW      = wall thickness of the lip ring in mm.
 * lipH      = height of the lip ring in mm.
 */
function buildInnerLipJscad(innerHalf, lipW, lipH) {
  if (lipW <= 0.05 || lipH <= 0.05) return null;
  const outerHalf = innerHalf + lipW;
  const outer = translate([0, 0, lipH / 2], cuboid({ size: [outerHalf * 2, outerHalf * 2, lipH] }));
  const inner = translate([0, 0, lipH / 2], cuboid({ size: [Math.max(innerHalf * 2 - 0.02, 0.5), Math.max(innerHalf * 2 - 0.02, 0.5), lipH + 1] }));
  try { return subtract(outer, inner); } catch { return null; }
}

// ── JSCAD → Three.js BufferGeometry ──────────────────────────────────────────

function collectPositions(geom, out) {
  for (const poly of geometries.geom3.toPolygons(geom)) {
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

  // Hide dims and stale notices before early-out or new checks
  const dimsEl = document.getElementById("td-dims");
  if (dimsEl) dimsEl.style.display = "none";
  notice.style.display = "none";

  if (!qrMatrix) return;

  mat.color.set(readCSSVar("--strata-text-primary", "#e0e0e0"));
  syncRendererBackground();

  const invert        = invertCb.checked;
  const h             = parseFloat(heightInput.value);
  const draftDeg      = parseFloat(draftInput.value);
  const baseThickness = parseFloat(baseInput.value);
  const textSizeMm    = parseFloat(textSizeInput.value);
  const labelRaiseMm  = Math.min(parseFloat(textRaiseInput.value), h);
  const lipW          = lipEnableCb?.checked ? parseFloat(lipWidthInput?.value ?? 0.35) : 0;
  const lipH          = h; // lip is always as tall as the module extrusions

  // ── P1.5 Printability warnings ────────────────────────────────────────────
  if (lipW > 0 && lipW < 0.4) {
    showNotice("Lip width below 0.4 mm may not print on a 0.4 mm nozzle. Try 0.4 mm or wider, or disable the lip.", "warning");
  } else if (draftDeg < -3) {
    showNotice("Negative draft creates an undercut that may not print on FDM without supports.", "warning");
  } else if (draftDeg > 10) {
    showNotice("Draft over 10° may cause adjacent module bases to merge, reducing scan contrast.", "warning");
  }

  const n      = qrMatrix.length;
  const ms     = 1;
  const offset = (n * ms) / 2;
  const lh     = labelText ? textSizeMm * 2.0 : 0;         // label area height (mm)
  const taper  = h * Math.tan((draftDeg * Math.PI) / 180); // can be negative

  const GAP1 = parseFloat(gap1Input?.value ?? 1.0); // mm inner clearance between QR modules and lip inner edge
  const GAP2 = parseFloat(gap2Input?.value ?? 0.5); // mm clearance between lip outer edge and hole edge

  // Auto-calculate quiet zone border from component parts.
  // Minimum 4 cells for QR scan reliability; expands to fit lip + gaps + hole.
  const attachMode = attachmentSelect ? attachmentSelect.value : "none";
  const rawHoleR = attachMode === "keyring" ? parseFloat(keyringRInput?.value ?? 2.0)
                 : attachMode === "mount"   ? parseFloat(mountRInput?.value   ?? 1.5)
                 : 0;
  const requiredBorderMm = Math.max(4, GAP1 + lipW + GAP2 + 2 * rawHoleR + 0.5);
  const bw = Math.ceil(requiredBorderMm);  // ms=1, so cells == mm

  modelGroup = new THREE.Group();

  // ── Base plate ───────────────────────────────────────────────────────────
  // Extends bw on all sides; label area adds lh on the Y− side (Three.js Z+)
  const plateWX  = n * ms + 2 * bw;
  const plateWY  = n * ms + 2 * bw + lh;
  const plateCY  = -lh / 2;  // shift centre toward label side

  let baseJscad = translate(
    [0, plateCY, -baseThickness / 2],
    cuboid({ size: [plateWX, plateWY, baseThickness] }),
  );

  // ── P0.3 Attachment holes ─────────────────────────────────────────────────
  // Border (bw) is auto-sized to always fit the requested hole radius, so
  // safeHoleR just returns the requested value clamped to a physical minimum.
  function safeHoleR(requested) {
    return Math.max(0.5, requested);
  }

  if (attachMode === "keyring") {
    const holeR   = safeHoleR(keyringRInput ? parseFloat(keyringRInput.value) : 2.0);
    const holeDist = (n * ms) / 2 + GAP1 + lipW + GAP2 + holeR;
    const holeCyl = translate(
      [0, holeDist, -baseThickness / 2],
      cylinder({ radius: holeR, height: baseThickness + 1, segments: 32 }),
    );
    try { baseJscad = subtract(baseJscad, holeCyl); } catch (e) {
      console.warn("Keyring hole subtraction failed:", e);
    }
  } else if (attachMode === "mount") {
    const holeR   = safeHoleR(mountRInput ? parseFloat(mountRInput.value) : 1.5);
    const holeDist = (n * ms) / 2 + GAP1 + lipW + GAP2 + holeR;
    const holeCyl1 = translate(
      [0, +holeDist, -baseThickness / 2],
      cylinder({ radius: holeR, height: baseThickness + 1, segments: 32 }),
    );
    const holeCyl2 = translate(
      [0, -holeDist, -baseThickness / 2],
      cylinder({ radius: holeR, height: baseThickness + 1, segments: 32 }),
    );
    try { baseJscad = subtract(baseJscad, holeCyl1, holeCyl2); } catch (e) {
      console.warn("Mounting holes subtraction failed:", e);
    }
  }

  jscadParts.push(baseJscad);
  const baseMesh = new THREE.Mesh(toBufferGeometry(baseJscad), mat);
  baseMesh.castShadow = baseMesh.receiveShadow = true;
  modelGroup.add(baseMesh);

  // ── Inner lip (paint dam inside quiet zone: QR → GAP1 → lip) ────────────
  if (lipW > 0 && lipH > 0) {
    const lipHalfInner = (n * ms) / 2 + GAP1;
    const lipJscad = buildInnerLipJscad(lipHalfInner, lipW, lipH);
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

  // ── P1.6 Physical dimensions readout ─────────────────────────────────────
  if (dimsEl) {
    const W = (plateWX).toFixed(1);
    const H = (plateWY).toFixed(1);
    const D = (h + baseThickness).toFixed(1);
    dimsEl.textContent = `W ${W} × H ${H} × D ${D} mm`;
    dimsEl.style.display = "";
  }

  // ── Camera — reframe when QR version changes or plate size changes significantly ──
  // Preserves orbit state between minor parameter tweaks.
  const currentSpan = Math.max(plateWX, plateWY, h + baseThickness);
  if (n !== lastMatrixN || Math.abs(currentSpan - lastSpan) > 8) {
    lastMatrixN = n;
    lastSpan = currentSpan;
    const span = currentSpan;
    // Position camera slightly in front and moderately above so the label
    // strip (near / positive-Z side) reads clearly at the visual bottom rather
    // than appearing centrally in a steep top-down view.
    camera.position.set(span * 0.1, span * 1.6, span * 0.9);
    orbitControls.target.set(0, h / 2, 0);
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

function renderAxesOverlay() {
  const fullW = canvas.clientWidth;
  const fullH = canvas.clientHeight;
  if (fullW <= 0 || fullH <= 0) return;

  const size = Math.max(80, Math.round(Math.min(fullW, fullH) * 0.16));
  const margin = 12;
  const x = margin;
  const y = margin;

  axesDir.copy(camera.position).sub(orbitControls.target);
  if (axesDir.lengthSq() < 1e-6) axesDir.set(1, 1, 1);

  axesCamera.position.copy(axesDir).setLength(2.9);
  axesCamera.lookAt(0, 0, 0);
  axesCamera.aspect = 1;
  axesCamera.updateProjectionMatrix();

  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(x, y, size, size);
  renderer.setViewport(x, y, size, size);
  renderer.render(axesScene, axesCamera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, fullW, fullH);
}

// ── Render loop ───────────────────────────────────────────────────────────────

function is3dVisible() {
  return !document.hidden && canvas.offsetWidth > 0;
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
  renderAxesOverlay();
}
animate();

// ── STL export ────────────────────────────────────────────────────────────────

function stlFilename() {
  if (labelText) {
    const slug = labelText
      .toLowerCase()
      .replace(/[\s\W]+/g, "-")   // spaces and non-alphanumeric → hyphen
      .replace(/[^a-z0-9-]/g, "") // strip anything left that isn't alphanumeric or hyphen
      .replace(/^-+|-+$/g, "")    // trim leading/trailing hyphens
      .slice(0, 30);
    if (slug) return `mnemosyne-${slug}.stl`;
  }
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  return `mnemosyne-${y}${m}${d}.stl`;
}

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
    a.download    = stlFilename();
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

// ── Input sync helper ─────────────────────────────────────────────────────────

function wire(input, onChange) {
  input.addEventListener("input", onChange);
}

// ── Save+rebuild wrappers ─────────────────────────────────────────────────────

function scheduleRebuildAndSave() {
  save3DSettings();
  scheduleRebuild();
}
function rebuildAndSave() {
  save3DSettings();
  rebuild();
}

// ── Event wiring ──────────────────────────────────────────────────────────────

wire(heightInput,    scheduleRebuildAndSave);
wire(draftInput,     scheduleRebuildAndSave);
wire(baseInput,      scheduleRebuildAndSave);
wire(textSizeInput,  scheduleRebuildAndSave);
wire(textRaiseInput, scheduleRebuildAndSave);
if (lipWidthInput) wire(lipWidthInput, scheduleRebuildAndSave);
lipEnableCb?.addEventListener("change", rebuildAndSave);
if (gap1Input) wire(gap1Input, scheduleRebuildAndSave);
if (gap2Input) wire(gap2Input, scheduleRebuildAndSave);

// Changing gap1 or gap2 also affects the 2D SVG lip position — trigger app.js update
gap1Input?.addEventListener("input", () => {
  document.getElementById("td-lip-width")?.dispatchEvent(new Event("input"));
});
gap2Input?.addEventListener("input", () => {
  document.getElementById("td-lip-width")?.dispatchEvent(new Event("input"));
});

// P0.3 — attachment mode
if (attachmentSelect) {
  attachmentSelect.addEventListener("change", () => {
    const v = attachmentSelect.value;
    if (keyringOpts) keyringOpts.style.display = v === "keyring" ? "" : "none";
    if (mountOpts)   mountOpts.style.display   = v === "mount"   ? "" : "none";
    rebuildAndSave();
  });
}
if (keyringRInput) wire(keyringRInput, scheduleRebuildAndSave);
if (mountRInput)   wire(mountRInput, scheduleRebuildAndSave);

invertCb.addEventListener("change", rebuildAndSave);
exportBtn.addEventListener("click", exportSTL);

// ── Fit camera button (Change 6) ──────────────────────────────────────────────
document.getElementById("td-fit-camera")?.addEventListener("click", () => {
  lastMatrixN = -1; // force camera reframe on next rebuild
  scheduleRebuild();
});

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

const ro = new ResizeObserver(() => requestAnimationFrame(resizeRenderer));
ro.observe(canvas);

load3DSettings();
syncRendererBackground();
