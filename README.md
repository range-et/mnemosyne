---
tags: [project, mnemosyne, readme]
---

# Offline Text QR Workshop

**[Try it live](https://range-et.github.io/mnemosyne/)**

Minimal website (native HTML/CSS/JS) that turns text into scannable QR codes for fabrication workflows.

## What this app does

- Accepts text input and generates a QR code live.
- Lets you choose ECC level (`L`, `M`, `Q`, `H`).
- Shows payload usage in bytes.
- Reports QR version, module grid, and estimated print size in millimeters.
- Works fully offline after install/build.

## Why text-only for v1

This version does not store PDFs or images directly. QR capacity is limited, so large documents do not fit reliably in a single code.

Maximum byte capacity by ECC level (byte mode, QR Version 40):

- `L`: 2953 bytes
- `M`: 2331 bytes
- `Q`: 1663 bytes
- `H`: 1273 bytes

## Quick start

```bash
npm install
npm run dev
```

Build production assets:

```bash
npm run build
npm run preview
```

## Fabrication notes

- Print size formula used in app:
  - `total_size_mm = (module_count + 8) * module_size_mm`
  - (`+8` is quiet zone: 4 modules each side)
- For common FDM workflows, start around `0.8-1.2mm` per module.
- At high payload usage, always scan-test a printed sample.

## Design system alignment

The UI follows Monad-style class naming and token-driven styling conventions from [monad_system](https://github.com/range-et/monad_system).
If your project already ships `monad.css`, you can replace or reduce `styles.css` overrides and map components to your existing tokens.


---

*Related: [NorthStar](NorthStar.md)*
