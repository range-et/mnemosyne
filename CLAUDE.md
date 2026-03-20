# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server (HMR)
npm run build      # production build
npm run preview    # serve the production build locally
```

No test suite exists yet.

## Architecture

Mnemosyne is a single-page offline QR-to-STL tool. There is no backend — everything runs in the browser. The entry point is `index.html`, which loads three ES modules:

- **`vendor/monad_system/build/monad.js`** — design system JS (theme toggle, nav)
- **`app.js`** — 2D QR tab: payload input, SVG/PNG generation, localStorage persistence, payload history
- **`threed.js`** — 3D tab: Three.js scene, JSCAD CSG geometry, STL export

The two modules are decoupled and communicate only via `CustomEvent` on `document`:

- `qr-updated` — fired by `app.js` whenever the QR matrix changes; `threed.js` listens and rebuilds the 3D model. `detail` is `{ matrix, labelText, borderCells }` or `null` to clear.
- `tab-changed` — fired by `app.js` on tab switch; `threed.js` uses this to resize the renderer and trigger a rebuild when the 3D pane becomes visible.

### 3D pipeline

`threed.js` uses two coordinate systems that must be kept in sync:

- **JSCAD** uses Z-up. All geometry is built in JSCAD space.
- **Three.js** uses Y-up. Conversion happens in `collectPositions()`: `(x, y, z)_jscad → (x, z, −y)_three`.

The geometry pipeline: QR matrix → `buildModuleJscad()` (tapered frustum per dark cell) → `toBufferGeometry()` → Three.js mesh. The base plate, optional outer lip, and label text are built separately as JSCAD solids and kept in `jscadParts[]` (used for STL export via `@jscad/stl-serializer`).

Post-processing uses Three.js `EffectComposer` with SSAO. It falls back gracefully to a plain `renderer.render()` if the composer throws.

### Styling

`styles.css` is layered on top of `vendor/monad_system/build/monad.css`. Style rules must use `--strata-*` CSS tokens from the Monad system. Hard-coded hex values are forbidden except for `#fff` on the QR scanner surface. No `border-radius` on `atomos-*` components, no `box-shadow`, no gradients.

### localStorage keys

All settings are persisted on every `input`/`change` event:

- `mn_*` — 2D settings (payload, ecc, module size, label text/border/size)
- `mn_3d_*` — 3D settings (invert, height, draft, base, text size/raise, lip, attachment)
- `mn_payload_history` — JSON array of last 10 payloads

## Project tracking

Three docs govern ongoing work:

- **`NorthStar.md`** — vision and "why". Only the user updates this. Never modify it.
- **`FEATURES.md`** — full feature roadmap. Claude marks items done when shipped and adds new items as they're identified.
- **`Issues.md`** — active bug/issue tracker. Both the user and Claude add to it. When an issue is resolved, remove it from `Issues.md` and record it as completed in `FEATURES.md`.

## Key dependencies

| Package | Role |
|---|---|
| `qrcode-generator` | QR matrix generation (byte mode) |
| `three` | 3D rendering and post-processing |
| `@jscad/modeling` | CSG geometry (base plate, modules, holes, lip, text) |
| `@jscad/stl-serializer` | Binary STL export |
| `vite` | Build tool / dev server |
