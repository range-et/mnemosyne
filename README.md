---
tags: [project, mnemosyne, readme]
---

# Mnemosyne — Offline QR-to-STL Workshop

**[Try it live](https://range-et.github.io/mnemosyne/)**

Products come with instructions, and those booklets get lost. Mnemosyne turns text (or a link
to a manual/video) into a scannable QR code and a ready-to-print 3D tag you can attach to the
object itself — as a label, key-ring fob, or mounting plate.

Everything runs in the browser. No backend, no upload, fully offline after build.

## What this app does

### 2D QR
- Accepts text or a URL and generates a QR code live.
- ECC level select (`L`, `M`, `Q`, `H`).
- Payload capacity bar that fills within the current QR version's byte range.
- Reports byte usage, QR version, module grid, and estimated print size in millimetres.
- Optional label text rendered below the QR grid.
- Download as **SVG** or **PNG** (4× scale), with filenames derived from the label/date.
- URL link-rot warning when the payload is an `http(s)://` link.
- Payload history (last 10 payloads) you can click to restore.

### 3D tag
- Builds a printable 3D model from the QR matrix in real time (tapered modules on a base plate).
- Tweakable geometry: module height, draft angle, base thickness, invert, label text size/raise.
- Optional **lip** (border ridge) sized to sit inside the quiet zone — ideal for nail-polish /
  paint-fill so the code reads with consistent contrast and survives handling.
- **Attachment modes**: none, key-ring hole, or mounting holes, with configurable radius and
  smart validation against the quiet-zone width.
- Auto-calculated quiet zone so the plate always fits the lip, gaps, and holes.
- Live `W × H × D mm` dimension readout and printability warnings (thin lip, bad draft).
- Export a binary **STL** for slicing.
- Two-color print guide (single-extruder paint-fill and two-color / AMS workflows).

### Layout
The interface is an engineering-drawing sheet: plan (2D) and isometric (3D) views always
visible on top, with a horizontal spec strip of parameters along the bottom. The 3D view syncs
its theme/background with the Monad design-system light/dark toggle.

All settings persist to `localStorage` and restore on reload.

## QR capacity (byte mode, Version 40)

QR capacity is limited, so large documents won't fit in a single code — link to them instead.

| ECC | Max bytes |
|-----|-----------|
| `L` | 2953 |
| `M` | 2331 |
| `Q` | 1663 |
| `H` | 1273 |

## Quick start

```bash
npm install
npm run dev        # Vite dev server with HMR
```

Build and preview production assets:

```bash
npm run build
npm run preview
```

Run the end-to-end tests:

```bash
npm test           # Playwright (layout + functionality, dark & light)
```

## Fabrication notes

- Print size formula used in app:
  - `total_size_mm = (module_count + 8) * module_size_mm`
  - (`+8` is the quiet zone: 4 modules each side)
- For common FDM workflows, start around `0.8–1.2 mm` per module.
- Use the lip + paint-fill workflow for durable, high-contrast tags.
- At high payload usage, always scan-test a printed sample.

## Architecture

Single-page app, no backend. `index.html` loads three ES modules:

- `vendor/monad_system/build/monad.js` — design-system JS (theme toggle, nav)
- `app.js` — 2D QR tab: payload input, SVG/PNG generation, persistence, history
- `threed.js` — 3D tab: Three.js scene, JSCAD CSG geometry, STL export

The two modules are decoupled and communicate only via `CustomEvent` on `document`
(`qr-updated`, `tab-changed`). See [AGENT.md](AGENT.md) for the full coordinate-system and
geometry-pipeline details.

## Key dependencies

| Package | Role |
|---|---|
| `qrcode-generator` | QR matrix generation (byte mode) |
| `three` | 3D rendering and post-processing |
| `@jscad/modeling` | CSG geometry (base plate, modules, holes, lip, text) |
| `@jscad/stl-serializer` | Binary STL export |
| `vite` | Build tool / dev server |
| `@playwright/test` | End-to-end tests |

## Design system alignment

The UI follows Monad-style class naming and token-driven styling from
[monad_system](https://github.com/range-et/monad_system). All styles use `--strata-*` tokens;
hard-coded colors are avoided.

---

*Related: [NorthStar](NorthStar.md) · [FEATURES](FEATURES.md) · [Issues](Issues.md)*
