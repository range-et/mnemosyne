import qrcode from "qrcode-generator";

const MAX_BYTES_BY_ECC = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273
};

// Byte-mode capacity per QR version (v1–v40) for each ECC level.
// Tick marks on the capacity bar are drawn at each version boundary.
const VERSION_CAPS = {
  L: [25,47,77,114,154,195,224,279,335,395,468,535,619,667,758,854,938,1046,1153,1249,1352,1460,1588,1704,1853,1990,2132,2223,2369,2520,2677,2840,3009,3183,3351,3537,3729,3927,4087,4296],
  M: [16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669,714,782,860,914,1000,1062,1128,1193,1267,1373,1455,1541,1631,1725,1812,1914,1992,2102,2216,2331],
  Q: [11,20,32,48,65,82,95,118,141,167,198,226,262,282,320,361,397,442,488,528,572,618,672,721,784,842,902,940,1002,1066,1132,1201,1273,1367,1373,1455,1541,1631,1663,1663],
  H: [7,14,24,34,46,60,68,84,101,119,137,155,177,194,220,250,280,310,338,382,403,439,461,511,535,593,625,658,698,742,790,842,898,958,983,1051,1093,1139,1219,1273],
};

// ── DOM refs — QR settings ────────────────────────────────────────────────────
const textInput       = document.querySelector("#text-input");
const eccLevelInput   = document.querySelector("#ecc-level");
const moduleSizeInput = document.querySelector("#module-size");
const qrRoot          = document.querySelector("#qr-root");
const bytesUsed       = document.querySelector("#bytes-used");
const qrVersion       = document.querySelector("#qr-version");
const moduleCount     = document.querySelector("#module-count");
const printSize       = document.querySelector("#print-size");
const statusLine      = document.querySelector("#status-line");
const statusMessage   = statusLine.querySelector(".atomos-notice__msg");

// ── DOM refs — Label & border ─────────────────────────────────────────────────
const labelTextInput   = document.querySelector("#label-text");

const encoder = new TextEncoder();

// Shared QR matrix — dispatched to threed.js via "qr-updated" event
let currentMatrix = null;

// Byte capacity meter — injected right after the textarea in init
const payloadMeter = document.createElement("div");
payloadMeter.className = "payload-meter";
textInput.parentNode.insertBefore(payloadMeter, textInput.nextSibling);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusLine.className = "status-line atomos-notice";
  const tone =
    type === "error"   ? "atomos-notice--error"   :
    type === "warning" ? "atomos-notice--warning"  :
                         "atomos-notice--info";
  statusLine.classList.add(tone);
  if (type) statusLine.classList.add(type);
}

function getByteCount(value) {
  return encoder.encode(value).length;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearQrMeta() {
  qrRoot.innerHTML = "";
  qrVersion.textContent   = "-";
  moduleCount.textContent = "-";
  printSize.textContent   = "-";
  currentMatrix = null;
  document.dispatchEvent(new CustomEvent("qr-updated", { detail: null }));
}

function formatPrintSize(modules, moduleMm, borderCells) {
  const totalModules = modules + 2 * borderCells;
  const totalMm      = totalModules * moduleMm;
  return `${totalMm.toFixed(1)} mm (${totalModules} modules incl. border)`;
}

/**
 * Build a custom SVG for the QR code so we control the quiet-zone border width
 * and can embed a label text in the bottom border area.
 *
 * All geometry is expressed in a per-cell unit (cell = 6 CSS px when rendered
 * at natural size). The SVG has no explicit width/height so it scales to fit
 * its container via CSS (max-width: 100%; height: auto).
 */
function buildQrSvg(qr, n, borderCells, labelText, textSizeMm, moduleMm, lipEnabled, lipWMm) {
  const cell    = 6;                          // viewBox units per module cell
  const bw      = borderCells * cell;         // border width in vb units
  const fontSizeVb = moduleMm > 0 ? (textSizeMm / moduleMm) * cell : textSizeMm * 4;
  const fontSize = fontSizeVb;
  const lh      = labelText ? Math.round(fontSize * 2.0) : 0;  // label row height

  const totalW  = n * cell + 2 * bw;
  const totalH  = n * cell + 2 * bw + lh;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" class="qr-svg">`,
    `<rect width="${totalW}" height="${totalH}" fill="white"/>`,
  ];

  // QR modules
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) {
        const x = bw + col * cell;
        const y = bw + row * cell;
        parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="black"/>`);
      }
    }
  }

  // Label text centred in the bottom border area
  if (labelText && lh > 0) {
    const tx = totalW / 2;
    const ty = n * cell + 2 * bw + lh / 2;
    parts.push(
      `<text x="${tx}" y="${ty}" dominant-baseline="middle" text-anchor="middle"` +
      ` font-family="monospace" font-size="${fontSize}" fill="black">${escapeXml(labelText)}</text>`,
    );
  }

  // Paint lip — drawn inside the quiet zone, matching 3D geometry placement
  if (lipEnabled && lipWMm > 0 && moduleMm > 0 && borderCells >= 2) {
    const GAP1 = parseFloat(document.getElementById("td-gap1")?.value || 1);
    const lipVb = Math.max(cell * 0.15, lipWMm / moduleMm * cell);
    // Lip inner edge sits GAP1 cells outside the QR module boundary (inside quiet zone).
    // Stroke is centered on the rect edge so offset by half the stroke width.
    const rx = bw - GAP1 * cell - lipVb / 2;
    const ry = bw - GAP1 * cell - lipVb / 2;
    const rw = n * cell + 2 * (GAP1 * cell + lipVb / 2);
    const rh = n * cell + 2 * (GAP1 * cell + lipVb / 2);
    if (rx > 0) {
      parts.push(
        `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" ` +
        `fill="none" stroke="black" stroke-width="${lipVb.toFixed(2)}" opacity="0.35"/>`,
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

function renderQr(payload, ecc, moduleMm) {
  const qr = qrcode(0, ecc);
  qr.addData(payload, "Byte");
  qr.make();

  const n           = qr.getModuleCount();
  const borderCells = 4;
  const labelText   = labelTextInput.value.trim();
  const textSizeMm  = parseFloat(document.getElementById("td-text-size")?.value || 2.5);
  const lipEnabled  = document.getElementById("td-lip-enable")?.checked ?? false;
  const lipWMm      = parseFloat(document.getElementById("td-lip-width")?.value ?? 0.35);

  // Boolean matrix shared with 3D tab
  currentMatrix = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, col) => qr.isDark(row, col))
  );

  qrRoot.innerHTML = buildQrSvg(qr, n, borderCells, labelText, textSizeMm, moduleMm, lipEnabled, lipWMm);

  const version = Math.round((n - 17) / 4);
  qrVersion.textContent   = String(version);
  moduleCount.textContent = `${n} × ${n}`;
  printSize.textContent   = formatPrintSize(n, moduleMm, borderCells);

  saveToHistory(payload);

  // Pass matrix + label info so threed.js can rebuild the 3D model
  document.dispatchEvent(new CustomEvent("qr-updated", {
    detail: { matrix: currentMatrix, labelText, borderCells },
  }));
}

function update() {
  const payload   = textInput.value;
  const ecc       = eccLevelInput.value;
  const moduleMm  = Number(moduleSizeInput.value || 0);
  const byteCount = getByteCount(payload);
  const maxBytes  = MAX_BYTES_BY_ECC[ecc];
  const usage     = maxBytes > 0 ? (byteCount / maxBytes) * 100 : 0;

  bytesUsed.textContent = `${byteCount} / ${maxBytes}`;

  // Byte meter fill bar — fills 0→100% within the current QR version bracket
  const bracketUsage = getBracketUsage(byteCount, ecc);
  payloadMeter.style.setProperty("--usage", `${bracketUsage.toFixed(1)}%`);
  payloadMeter.className = "payload-meter" + (usage >= 90 ? " payload-meter--error" : usage >= 75 ? " payload-meter--warn" : "");

  if (!payload.trim()) {
    clearQrMeta();
    setStatus("Enter text to generate a code.");
    return;
  }

  if (byteCount > maxBytes) {
    clearQrMeta();
    setStatus(
      `Too large for ECC ${ecc}. Reduce by ${byteCount - maxBytes} bytes or lower ECC.`,
      "error",
    );
    return;
  }

  if (!Number.isFinite(moduleMm) || moduleMm <= 0) {
    clearQrMeta();
    setStatus("Module size must be a positive number in millimeters.", "error");
    return;
  }

  try {
    renderQr(payload, ecc, moduleMm);
  } catch {
    clearQrMeta();
    setStatus("Payload cannot fit in QR Version 40. Shorten the text.", "error");
    return;
  }

  if (usage >= 90) {
    setStatus(`Near capacity (${usage.toFixed(1)}%). Consider shorter text for scan reliability.`, "warning");
  } else if (usage >= 75) {
    setStatus(`High payload usage (${usage.toFixed(1)}%). Test scanning on print samples.`, "warning");
  } else {
    const urlPayload = payload.trimStart().match(/^https?:\/\//i);
    if (urlPayload) {
      setStatus(`QR generated with ECC ${ecc}. If this URL might change, use a redirect you control — a broken URL makes the tag permanently useless.`);
    } else {
      setStatus(`QR generated with ECC ${ecc}.`);
    }
  }
}

// ── localStorage persistence ──────────────────────────────────────────────────

function saveSettings() {
  localStorage.setItem("mn_payload",     textInput.value);
  localStorage.setItem("mn_ecc",         eccLevelInput.value);
  localStorage.setItem("mn_module_size", moduleSizeInput.value);
  localStorage.setItem("mn_label_text",  labelTextInput.value);
}

function loadSettings() {
  const get = (key) => localStorage.getItem(key);
  if (get("mn_payload")     !== null) textInput.value       = get("mn_payload");
  if (get("mn_ecc")         !== null) eccLevelInput.value   = get("mn_ecc");
  if (get("mn_module_size") !== null) moduleSizeInput.value = get("mn_module_size");
  if (get("mn_label_text")  !== null) labelTextInput.value  = get("mn_label_text");
}

// ── Version bracket fill helper ───────────────────────────────────────────────

function getBracketUsage(byteCount, ecc) {
  const caps = VERSION_CAPS[ecc] || VERSION_CAPS.M;
  let prev = 0;
  for (const cap of caps) {
    if (byteCount <= cap) {
      const range = cap - prev;
      return range > 0 ? Math.min(100, ((byteCount - prev) / range) * 100) : 100;
    }
    prev = cap;
  }
  return 100;
}

// ── Payload history ───────────────────────────────────────────────────────────

const HISTORY_KEY = "mn_payload_history";
const HISTORY_MAX = 10;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveToHistory(payload) {
  if (!payload || payload.length < 4) return;
  let hist = loadHistory();
  // Deduplicate: remove existing entry with same payload
  hist = hist.filter(item => item.payload !== payload);
  // Prepend new entry
  hist.unshift({ payload, ts: Date.now() });
  // Keep only HISTORY_MAX entries
  hist = hist.slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("payload-history");
  if (!container) return;
  const hist = loadHistory();
  if (!hist.length) {
    container.innerHTML = "";
    return;
  }
  const truncate = (s, n) => s.length > n ? s.slice(0, n) + "…" : s;
  container.innerHTML = `
    <div class="hist-header">
      <span class="hist-title">Recent</span>
      <button class="hist-clear" id="hist-clear-btn">Clear</button>
    </div>
    <div class="hist-list">
      ${hist.map((item, i) =>
        `<button class="hist-item" data-index="${i}" title="${item.payload.replace(/"/g,'&quot;')}">${truncate(item.payload, 48)}</button>`
      ).join("")}
    </div>
  `;
  document.getElementById("hist-clear-btn")?.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });
  container.querySelectorAll(".hist-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = loadHistory()[parseInt(btn.dataset.index)];
      if (item) {
        textInput.value = item.payload;
        updateAndSave();
        textInput.focus();
      }
    });
  });
}

// Inject history styles once
const histStyle = document.createElement("style");
histStyle.textContent = `
  #payload-history { margin-top: var(--space-1); }
  .hist-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 2px 0 4px;
    font-size: var(--type-xs, 0.7rem);
    text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--strata-text-secondary);
  }
  .hist-clear {
    background: none; border: none; cursor: pointer;
    font-size: var(--type-xs, 0.7rem);
    color: var(--strata-text-secondary);
    padding: 0;
  }
  .hist-clear:hover { color: var(--strata-text-primary); }
  .hist-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 7.5rem;
    overflow-y: auto;
    padding-right: 1px;
  }
  .hist-item {
    display: block; width: 100%; text-align: left;
    background: none; border: none; cursor: pointer;
    font-size: var(--type-xs, 0.72rem);
    padding: 3px var(--space-1);
    color: var(--strata-text-secondary);
    transition: color 120ms var(--ease-out-expo, ease), border-color 120ms var(--ease-out-expo, ease), background-color 120ms var(--ease-out-expo, ease);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    border-left: 2px solid var(--strata-border);
  }
  .hist-item:hover {
    color: var(--strata-text-primary);
    border-left-color: var(--strata-interactive);
    background: var(--strata-surface-hover, var(--strata-surface));
  }
`;
document.head.appendChild(histStyle);

// ── Download helpers ──────────────────────────────────────────────────────────

function deriveFilename(ext) {
  const label = labelTextInput.value.trim();
  if (label) {
    const slug = label
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);
    return `mnemosyne-${slug}.${ext}`;
  }
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `mnemosyne-${ymd}.${ext}`;
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadSVG() {
  const svg = qrRoot.querySelector("svg");
  if (!svg) return;
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  triggerDownload(url, deriveFilename("svg"));
  URL.revokeObjectURL(url);
}

function downloadPNG() {
  const svg = qrRoot.querySelector("svg");
  if (!svg) return;
  const svgString  = svg.outerHTML;
  const dataUrl    = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  const img        = new Image();
  img.onload = () => {
    const scale  = 4;
    const canvas = document.createElement("canvas");
    canvas.width  = img.naturalWidth  * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const label = labelTextInput.value.trim();
      let filename;
      if (label) {
        const slug = label
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 30);
        filename = `mnemosyne-${slug}-4x.png`;
      } else {
        const now = new Date();
        const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        filename = `mnemosyne-${ymd}-4x.png`;
      }
      triggerDownload(url, filename);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.src = dataUrl;
}

// ── Slider display sync ───────────────────────────────────────────────────────

function wireDisplay(input, display, decimals) {
  const sync = () => { display.textContent = parseFloat(input.value).toFixed(decimals); };
  input.addEventListener("input", () => { sync(); updateAndSave(); });
  sync();
}

// ── Init ──────────────────────────────────────────────────────────────────────

function updateAndSave() {
  update();
  saveSettings();
}

let payloadTimer = null;
textInput.addEventListener("input", () => {
  clearTimeout(payloadTimer);
  payloadTimer = setTimeout(updateAndSave, 180);
});
eccLevelInput.addEventListener("change", updateAndSave);
moduleSizeInput.addEventListener("input", updateAndSave);
labelTextInput.addEventListener("input", updateAndSave);

document.getElementById("btn-svg-download")?.addEventListener("click", downloadSVG);
document.getElementById("btn-png-download")?.addEventListener("click", downloadPNG);

// Re-render 2D preview when 3D lip/text settings change (shared with 2D SVG)
document.getElementById("td-lip-enable")?.addEventListener("change", update);
document.getElementById("td-lip-width")?.addEventListener("input",  update);
document.getElementById("td-text-size")?.addEventListener("input",  update);

loadSettings();
renderHistory();
setTimeout(update, 0);
