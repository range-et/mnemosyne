import qrcode from "qrcode-generator";

const MAX_BYTES_BY_ECC = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273
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
const labelTextInput     = document.querySelector("#label-text");
const labelBorderInput   = document.querySelector("#label-border");
const labelBorderVal     = document.querySelector("#label-border-val");
const labelTextSizeInput = document.querySelector("#label-text-size");
const labelTextSizeVal   = document.querySelector("#label-text-size-val");

const encoder = new TextEncoder();

// Shared QR matrix — dispatched to threed.js via "qr-updated" event
let currentMatrix = null;

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
function buildQrSvg(qr, n, borderCells, labelText, labelSizeMult) {
  const cell    = 6;                          // viewBox units per module cell
  const bw      = borderCells * cell;         // border width in vb units
  const fontSize = labelSizeMult * cell;
  const lh      = labelText ? Math.ceil(fontSize * 2.2) : 0;  // label row height

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

  parts.push("</svg>");
  return parts.join("");
}

function renderQr(payload, ecc, moduleMm) {
  const qr = qrcode(0, ecc);
  qr.addData(payload, "Byte");
  qr.make();

  const n           = qr.getModuleCount();
  const borderCells = Number(labelBorderInput.value   || 4);
  const labelText   = labelTextInput.value.trim();
  const labelSizeMult = Number(labelTextSizeInput.value || 1.5);

  // Boolean matrix shared with 3D tab
  currentMatrix = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, col) => qr.isDark(row, col))
  );

  qrRoot.innerHTML = buildQrSvg(qr, n, borderCells, labelText, labelSizeMult);

  const version = Math.round((n - 17) / 4);
  qrVersion.textContent   = String(version);
  moduleCount.textContent = `${n} × ${n}`;
  printSize.textContent   = formatPrintSize(n, moduleMm, borderCells);

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
    setStatus(`QR generated with ECC ${ecc}.`);
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────────

const tabPanels = {
  workbench: document.getElementById("workbench"),
  "3d":      document.getElementById("threed"),
};

const tabLinks = {
  workbench: document.getElementById("tab-workbench"),
  "3d":      document.getElementById("tab-3d"),
};

function switchTab(tabId) {
  for (const [id, panel] of Object.entries(tabPanels)) {
    const active = id === tabId;
    panel.style.display = active ? "" : "none";
    tabLinks[id].classList.toggle("active", active);
    if (active) {
      // Restart the entrance animation (remove → force reflow → re-add)
      panel.classList.remove("tab-entering");
      void panel.offsetHeight;
      panel.classList.add("tab-entering");
    }
  }
  document.dispatchEvent(new CustomEvent("tab-changed", { detail: tabId }));
}

tabLinks.workbench.addEventListener("click", (e) => { e.preventDefault(); switchTab("workbench"); });
tabLinks["3d"].addEventListener("click",      (e) => { e.preventDefault(); switchTab("3d"); });

// ── Slider display sync ───────────────────────────────────────────────────────

function wireDisplay(input, display, decimals) {
  const sync = () => { display.textContent = parseFloat(input.value).toFixed(decimals); };
  input.addEventListener("input", () => { sync(); update(); });
  sync();
}

// ── Init ──────────────────────────────────────────────────────────────────────

textInput.addEventListener("input",  update);
eccLevelInput.addEventListener("change", update);
moduleSizeInput.addEventListener("input", update);
labelTextInput.addEventListener("input", update);

wireDisplay(labelBorderInput,   labelBorderVal,   0);
wireDisplay(labelTextSizeInput, labelTextSizeVal, 2);

switchTab("workbench");
update();
