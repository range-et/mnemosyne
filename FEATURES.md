# Mnemosyne — Feature Roadmap

Synthesized from Frontend Developer, Senior Developer, and UX Researcher analysis of the codebase and NorthStar vision. Features are grouped by priority tier, with UX rationale where it shapes the decision.

---

## The Core User Problem (UX framing)

Two distinct user types emerge from research that the current UI doesn't distinguish between:

- **The linker** — pastes a URL pointing to a manual/video. Comfortable with indirection. Needs guidance on URL longevity.
- **The embedder** — types or pastes the actual instructions. Doesn't understand capacity limits until they hit them. Needs byte-meter feedback.

Both ultimately want a **physical artifact that outlasts the original booklet** and scans reliably after years of use, painting, and handling. The current tool generates the geometry but doesn't guide users through the full workflow (print orientation, two-color setup, scan verification).

---

## Completed

### Sprint 1 — Core foundations
- ✅ **P0.1 localStorage persistence** — All 14 controls saved on every `input` event, restored on load. 2D settings under `mn_*`, 3D settings under `mn_3d_*`.
- ✅ **P0.2 Meaningful export filenames** — STL, SVG, and PNG derive names from label text → timestamp (e.g. `mnemosyne-washing-machine.stl`).
- ✅ **P0.3 Keyring hole / Attachment mode** — None / Key ring / Mounting holes select with configurable radius. Smart `safeHoleR()` validates against quiet-zone width, clamps, and warns when hole/lip proximity is tight.
- ✅ **P0.4 Two-color workflow inline guide** — Collapsible "How to print this tag" section with single-extruder paint-fill and two-color/AMS instructions.
- ✅ **P1.1 SVG download** — "SVG" button in 2D preview header; derives filename from label/date.
- ✅ **P1.2 PNG download** — "PNG" button renders SVG to canvas at 4× scale and triggers download.
- ✅ **P1.5 Printability warnings** — Inline warnings for sub-nozzle lip width (<0.4 mm), negative draft undercut (<−3°), and excessive draft (>10°).
- ✅ **P1.6 Physical dimensions readout** — Live `W × H × D mm` line below the 3D canvas, computed from JSCAD geometry parameters.
- ✅ **P2.5 URL longevity hint** — When payload starts with `http(s)://`, status line warns about link-rot risk.
- ✅ **P2.7 Textarea debounce** — 180 ms debounce on payload textarea; sliders/number inputs remain immediate.

### Sprint 2 — UX polish
- ✅ **Single-page no-scroll layout** — Viewport locked (`overflow:hidden`), `#workbench`/`#threed` as full-height flex rows. Settings pane is the only scrollable region.
- ✅ **Compact number inputs** — All sliders replaced with `<input type="number">` in `.param-row` table layout with label + value + unit. More precise, more compact.
- ✅ **Payload capacity bar with version ticks** — Capacity fill bar with `VERSION_CAPS` tick marks at every QR version boundary (40 per ECC level) so users see when trimming characters will drop to a smaller version.
- ✅ **Payload history ring buffer** — Last 10 payloads stored in `mn_payload_history`. Renders as a collapsible list below the textarea; click any entry to restore it; Clear button.
- ✅ **3D camera Fit button** — "Fit" button in the 3D card header resets `lastMatrixN` sentinel and forces a camera reframe to fit the current model.
- ✅ **3D camera auto-reframe** — Camera reframes automatically when QR version changes or plate span changes by >8 mm; preserves orbit state for minor tweaks.

### Sprint 6 — Engineering drawing layout + 3D label fix
- ✅ **Engineering drawing layout** — Replaced vertical settings pane with a fixed 200px horizontal spec strip at the bottom (7 named columns: Payload, QR Code, Tag, 3D, Attachment, Export, History). Views row restructured to 38% plan view / 62% isometric view, always filling available height. Card headers replaced with absolute `drawing-view__label` overlays. Layout feels like a CAD drawing sheet with title block.
- ✅ **3D label text positioning fix** — `collectPositions` was reading `geom.polygons` directly, ignoring JSCAD's pending transform matrix. Switched to `geometries.geom3.toPolygons(geom)` so the final `translate()` in `buildLabelTextJscad` is applied correctly. Label text now renders in the border strip below the QR grid as intended.

### Sprint 5 — Auto quiet zone
- ✅ **Auto-calculated quiet zone** — Removed manual "Quiet zone" control. `threed.js` now derives border width from `max(4, GAP1 + lipW + GAP2 + 2·holeR + 0.5)`, so the plate always fits all component parts without any user-visible cells setting. `safeHoleR()` simplified to a physical minimum clamp (no DOM auto-bump needed). `app.js` hardcodes `borderCells=4` for the 2D SVG preview (standard minimum for scan reliability).

### Sprint 4 — Dual-view layout, unified text sizing, gap controls, camera fix
- ✅ **Dual-view layout** — Replaced single tab-switching preview with always-visible 2D (left) and 3D (right) side-by-side in a top section (~2/3 height), with a scrollable settings panel below (~1/3 height). Tab links and hamburger toggle removed. No tab switching needed.
- ✅ **Unified label text size** — 2D SVG label text now uses the same `#td-text-size` mm value as 3D. Removed the separate "2D text size" multiplier control. Font size in SVG is computed as `(textSizeMm / moduleMm) * cell` to match physical dimensions. Label row height factor updated to `2.0` to match 3D.
- ✅ **GAP1 / GAP2 user controls** — Inner gap (QR→lip) and outer gap (lip→hole) are now editable inputs in the Tag section. Both saved/restored via localStorage. Changing either re-renders 2D SVG and rebuilds 3D model. `buildQrSvg` reads `#td-gap1` directly for lip placement.
- ✅ **Fixed floating Export STL button** — Removed `position: sticky; bottom: 0; z-index: 1` from `.td-actions--spaced`. The button now sits inline in the document flow.
- ✅ **Camera angle for readable label text** — Camera repositioned to `(span*0.1, span*1.6, span*0.9)` with target `(0, h/2, 0)`, giving a top-down bird's-eye view where label text is readable left-to-right rather than appearing as flat lines.
- ✅ **Removed tab-changed listener in threed.js** — `is3dVisible()` now uses `canvas.offsetWidth > 0` instead of checking `display:none`, since both panes are always visible.

### Sprint 3 — Geometry correctness & UX consolidation
- ✅ **History → 3D sync on page load** — Changed final `update()` call in `app.js` to `setTimeout(update, 0)` so `threed.js` has time to register its `qr-updated` listener before the initial QR fires.
- ✅ **Payload meter bracket fill** — Meter now fills 0→100% within the current QR version's byte range using `getBracketUsage()`. Version tick marks removed (meaningless in bracket mode). Overall `usage` still drives warning/error class logic.
- ✅ **Visual hierarchy improvements** — `.param-section` headers now use `--strata-text-primary` color, `border-bottom`, `padding-bottom: 4px`, and increased top margin (`--space-3`).
- ✅ **Unified settings panel** — Replaced two separate `settings-2d` / `settings-3d` cards with a single `settings-main` card. `switchTab()` now only toggles preview panes; `settingsPanes` object removed from `app.js`. All settings in one scrollable panel in logical order: Payload, QR, Tag (shared 2D+3D), 3D, Attachment, history, Export.
- ✅ **History placement** — `#payload-history` div moved to after all settings sections (before the export footer), eliminating disruption to the parameter flow.
- ✅ **Lip inside quiet zone (3D geometry)** — Replaced `buildOuterLipJscad` with `buildInnerLipJscad`. Lip now sits at `(n*ms)/2 + GAP1` from center (1 mm inner clearance from QR modules), staying inside the quiet zone rather than outside the plate.
- ✅ **Holes outside lip (correct QR → gap1 → lip → gap2 → hole structure)** — `safeHoleR()` now validates against `GAP1 + lipW + GAP2 + 2*r + BUFFER`. Hole centers placed at `(n*ms)/2 + GAP1 + lipW + GAP2 + holeR`, ensuring holes are always outside the lip ring.
- ✅ **2D SVG lip positioned inside quiet zone** — `buildQrSvg` lip rect now drawn with inner edge at `GAP1` cells outside the QR module boundary (matching 3D geometry), rather than at the outer plate edge.
- ✅ **Parametric conflict validation** — `rebuild()` now warns when the quiet zone is too narrow for the inner gap plus the specified lip width, prompting the user to increase quiet zone or reduce lip width.
- ✅ **Mobile layout fixes** — Rewrote `@media (max-width: 860px)` block: `html/body` unlock to `height: auto; overflow-y: auto`, layout stacks to single column, preview pane has bounded height (`70vw`, max `60vh`), settings pane scrolls naturally without a fixed max-height cap.

---

## P1 — High Value / Near-Term

### P1.3 — Named Presets
A preset is a JSON snapshot of all 14 settings (not payload) stored under a user-chosen name in localStorage. UI: small dropdown + "Save preset" + "Delete" buttons. Lets a maker save one profile per printer/filament combo (e.g. "Ender3 0.4mm", "Bambu fine detail"). Schema: `mnemosyne_presets → { name: { settings } }`.

### P1.4 — Payload Templates
A small dropdown of common payload formats: **Plain URL / WiFi (`WIFI:T:WPA;S:;P:;;`) / vCard / Plain text**. Selecting a template inserts a format string with placeholders. WiFi is a primary use case (router labels) — a first-class shortcut for it is warranted.

### P1.7 — Scan Test Affordance
A "Test scan" button in the 2D preview that either:
- Prompts the user with an overlay: "Point your phone camera at the code preview on screen" (zero-code, addresses the anxiety directly), or
- Uses `BarcodeDetector` / `getUserMedia` to scan from the device camera and show a green/red result (more complete)

The first option has near-zero implementation cost and closes the core "will it scan?" anxiety loop for most users.

---

## P2 — Medium Value / Next Sprint

### P2.1 — URL Hash / Shareable Links
Encode all settings + payload into the URL hash so a link reconstructs the exact QR. Format: `#v=1&p=<b64url>&e=M&ms=0.8&...`. Version-prefix for future migration. Warn when the hash exceeds ~2000 characters (large embedded text). On load: parse hash before `update()`, populate controls, then call `update()`.

### P2.2 — Rounded Plate Corners + Base Shape
Replace base plate `cuboid` with a rounded rectangle (JSCAD `roundedRectangle` + `extrudeLinear`). Corner radius slider: 0–5mm. Default 0 (no change from current). Optionally add a Pill shape for key-ring tags. Visually softens the tag for consumer products.

### P2.3 — Module Size Auto-Suggestion
Invert the current calculation: let users specify a **target tag width in mm** and compute the required module size. Display as a "Target size" input that back-calculates `module-size` and `quiet zone` automatically. This is a direct inversion of `formatPrintSize()` and eliminates the mental arithmetic that blocks new users.

### P2.4 — Plain-Language ECC Guidance
Replace the dropdown option text or add a tooltip:
- L: max data, least resilient. Best for clean digital-only use.
- M: balanced. Good for most printed tags.
- Q: recommended for painted/filled tags.
- H: up to 30% damage tolerance. Best for heavily-handled tags.

A `<details>` popover next to the ECC label would not clutter the interface.

### P2.6 — Print-Ready PDF Export
Use `window.print()` with a `@media print` stylesheet that hides all controls and sizes the SVG to its computed physical dimensions (mm values already in `printSize`). Zero dependencies, works in every browser, produces a correctly-scaled PDF for print shops.

### P2.8 — Label Position Toggle (Below / Above)
Label text is hardcoded below the QR grid. A Below/Above radio pair in the 2D settings dispatched through `qr-updated` would cover vertical label strips and appliances where bottom placement is obstructed. Small change to `buildQrSvg()` and `rebuild()`.

---

## P3 — Polish & Power Features

### P3.1 — Numeric Inputs Alongside Sliders
*(Already addressed — all sliders replaced with number inputs.)*

### P3.2 — Preset Dropdown for Common Use Cases
Named presets for first-time users: "Key-ring fob", "Appliance label", "Tool rack tag", "Wall plate". Each pre-fills a curated combination of settings. Implemented as static JSON constants, no backend needed.

### P3.3 — Draft Angle Zero Marker
Add a tick mark or center notch at 0° on the draft angle input. Zero is the most common choice for non-mold FDM prints.

### P3.4 — Dark Mode / Theme Sync for 3D View
The theme toggle does not fire an event that `threed.js` listens to — the 3D model stays at the old theme color until the next rebuild. Wire a `MutationObserver` on `document.documentElement`'s class list to call `syncRendererBackground()` and update `mat.color` in real time.

### P3.5 — Payload Templates
*(See P1.4 above — moved up in priority.)*

### P3.6 — Physical Scale Grid in 3D View
A `Three.GridHelper` plane under the model showing 10mm gridlines. Toggled with a small checkbox in the 3D settings. Gives immediate physical intuition — makers can see whether a 2mm base plate looks proportionally right. One-liner in Three.js.

### P3.7 — Export Readiness State
The "Export STL" button is visually enabled even with no model. Disable it (and add a `title` tooltip: "Generate a QR code in the 2D tab first") whenever `jscadParts` is empty. The current post-click error is the wrong time to surface this.

### P3.8 — Web Worker for JSCAD Geometry
Move the full JSCAD pipeline into a `Worker`. At QR Version 10+ (57×57 grid, ~1,600+ dark modules), each `hull()` call in the main thread produces visible jank. The worker receives the matrix and settings via `postMessage`, runs geometry, returns triangle positions for Three.js and the serialized STL buffer for export. **Required prerequisite for any batch STL feature.**

---

## P4 — Future / Larger Scope

### P4.1 — CSV Batch Import
Accept a CSV upload (`payload, label_text` columns). For each row, generate a QR using current settings and produce either: a gallery of SVG previews, or a ZIP download of one SVG per row. Client-side with `FileReader` + `JSZip`. Highest-leverage feature for the 50-item household labeling scenario.

### P4.2 — Two-Part STL Export (Color Separation)
Export two separate STL files: base + raised modules (color 1), and a thin inlay fitting the recessed spaces (color 2). Completes the original NorthStar vision by making nail polish unnecessary for users with multi-material printers. The second body is the logical inverse of the first within the bounding volume.

### P4.3 — PWA / Offline Support
`manifest.json` + service worker pre-caching the app shell (HTML, CSS, JS, vendor bundles, font). Makers in workshops may have spotty connectivity. Self-host Instrument Sans as WOFF2 to eliminate the Google Fonts cross-origin cache complication.

### P4.4 — Tag Library / Project File
A persistent library of all tags ever created (payload + settings + export date), stored in localStorage or IndexedDB. Browse, re-export, or update any entry. Addresses the "manage 30 household appliance tags" scenario fully. Longer-term: JSON export/import of the library for backup.

---

## Accessibility Debt (Address Incrementally)

- Tab panels lack `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` — screen readers cannot navigate the structure correctly
- `#qr-root` injects raw SVG into an `aria-live` region — a separate visually-hidden announcement div should describe the outcome in plain language
- Slider `aria-valuetext` should include units ("3.0 millimetres", "2.0 degrees")
- Error messages in `#status-line` are not linked to the textarea via `aria-describedby`
- Custom focus styles should use `--strata-interactive` token instead of browser default blue halo
- `@media (pointer: coarse)` — enlarge input hit targets to ≥28px for touch

---

## Quick Reference: Effort vs. Impact

| Feature | Effort | Impact | Status |
|---|---|---|---|
| P0.1 localStorage persistence | Low | Critical | ✅ Done |
| P0.2 Meaningful filenames | Trivial | High | ✅ Done |
| P0.3 Keyring hole geometry | Low–Medium | High | ✅ Done |
| P0.4 Two-color print guide | Trivial (copy) | High | ✅ Done |
| P1.1 SVG download | Trivial | High | ✅ Done |
| P1.2 PNG download | Low | High | ✅ Done |
| P1.5 Printability warnings | Trivial | High | ✅ Done |
| P1.6 Physical dimensions in 3D | Trivial | High | ✅ Done |
| P2.5 URL longevity hint | Low | High | ✅ Done |
| P2.7 Textarea debounce | Low | Medium | ✅ Done |
| Single-page no-scroll layout | Low | Critical | ✅ Done |
| Compact number inputs | Low | High | ✅ Done |
| Capacity bar version ticks | Low | High | ✅ Done |
| Payload history ring buffer | Low | High | ✅ Done |
| 3D camera Fit + auto-reframe | Low | High | ✅ Done |
| 3D settings persistence | Low | High | ✅ Done |
| History → 3D sync on page load | Trivial | High | ✅ Done |
| Payload meter bracket fill | Low | Medium | ✅ Done |
| Visual hierarchy improvements | Trivial | Medium | ✅ Done |
| Unified settings panel | Low | High | ✅ Done |
| History placement | Trivial | Medium | ✅ Done |
| Lip inside quiet zone (3D) | Medium | High | ✅ Done |
| Holes outside lip (correct structure) | Medium | High | ✅ Done |
| 2D SVG lip inside quiet zone | Low | Medium | ✅ Done |
| Parametric conflict validation | Low | High | ✅ Done |
| Mobile layout fixes | Low | High | ✅ Done |
| Dual-view layout (2D+3D always visible) | Low | High | ✅ Done |
| Unified label text size (2D = 3D) | Low | High | ✅ Done |
| GAP1/GAP2 user controls | Low | Medium | ✅ Done |
| Fixed floating Export STL button | Trivial | Medium | ✅ Done |
| Camera angle for readable label text | Trivial | Medium | ✅ Done |
| Auto quiet zone from component parts | Low | High | ✅ Done |
| Engineering drawing layout | Low | High | ✅ Done |
| 3D label text positioning fix | Low | High | ✅ Done |
| P1.3 Named presets | Low–Medium | High | — |
| P1.4 Payload templates (WiFi etc.) | Medium | Medium | — |
| P1.7 Scan test affordance | Low | High | — |
| P2.1 URL hash shareable links | Medium | High | — |
| P2.2 Rounded corners + shape | Medium | Medium | — |
| P2.3 Target size auto-suggestion | Medium | Medium | — |
| P2.4 Plain-language ECC guidance | Low | Medium | — |
| P2.6 Print PDF via window.print() | Low | Medium | — |
| P2.8 Label position toggle | Low | Medium | — |
| P3.4 Dark mode theme sync (3D) | Low | Low | — |
| P3.6 Scale grid in 3D view | Trivial | Low | — |
| P3.7 Export readiness state | Trivial | Medium | — |
| P3.8 Web Worker for JSCAD | High | High (prerequisite for batch) | — |
| P4.1 CSV batch import | Medium | High | — |
| P4.2 Two-part STL export | Medium | High | — |
| P4.3 PWA / offline | Medium | Medium | — |
| P4.4 Tag library | High | High | — |
