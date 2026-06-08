import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');

/**
 * One cohesive end-to-end check of the Mnemosyne single-page layout.
 *
 * Verifies the three things asked for, all in a single (non-fragmented) test:
 *   1. The app is ONE page with no scrolling (viewport-locked).
 *   2. Core functionality works (QR generation, 3D render, STL/SVG/PNG export).
 *   3. Nothing in the layout is fragmented (no clipped labels, no hidden
 *      content scrolling inside the spec-strip columns).
 *
 * It also renders dark + light screenshots as artifacts under tests/screenshots/.
 */
test('Mnemosyne is a single non-scrolling page with working, unfragmented UI', async ({ page }) => {
  await mkdir(SHOT_DIR, { recursive: true });

  await page.goto('./');
  await page.waitForLoadState('networkidle');

  // ── 1. Functionality: typing a payload generates a QR code ────────────────
  await page.fill('#text-input', 'Hello Mnemosyne');

  const qrSvg = page.locator('#qr-root svg');
  await expect(qrSvg).toBeVisible();

  // Stats are populated from the generated matrix (not the "—" placeholder).
  await expect(page.locator('#bytes-used')).not.toHaveText('—');
  await expect(page.locator('#qr-version')).not.toHaveText('—');
  await expect(page.locator('#module-count')).not.toHaveText('—');

  // ── 1b. Functionality: the 3D model builds and sizes the canvas ───────────
  const canvas = page.locator('#qr3d-canvas');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox.width).toBeGreaterThan(100);
  expect(canvasBox.height).toBeGreaterThan(100);
  // The dimensions readout is populated + revealed only after JSCAD geometry
  // is successfully built, so it is a reliable signal the 3D pipeline ran.
  const dims = page.locator('#td-dims');
  await expect(dims).toBeVisible();
  await expect(dims).toContainText(/W .* H .* D .* mm/);

  // ── 2. Single page, no scrolling ──────────────────────────────────────────
  const scroll = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollHeight,
    docClient: document.documentElement.clientHeight,
    bodyScroll: document.body.scrollHeight,
    winH: window.innerHeight,
  }));
  expect(scroll.docScroll, 'document must not scroll vertically')
    .toBeLessThanOrEqual(scroll.docClient + 1);
  expect(scroll.bodyScroll, 'body must fit within the viewport height')
    .toBeLessThanOrEqual(scroll.winH + 1);

  // ── 3. Nothing is fragmented (clipped or hidden) ──────────────────────────
  // 3a. No spec-strip column hides content behind an internal scrollbar
  //     (history is intentionally allowed to scroll, so it is excluded).
  const overflowing = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.spec-col:not(.spec-col--history) .spec-col__body').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 1) {
        bad.push(el.closest('.spec-col')?.className || 'unknown');
      }
    });
    return bad;
  });
  expect(overflowing, 'no spec column should clip content with an internal scroll').toEqual([]);

  // 3b. No parameter label is horizontally clipped (the original bug:
  //     "ER CO", "MODU SIZE", "MC None" …).
  const clippedLabels = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.spec-strip .param-label, .spec-col__header').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1) bad.push(el.textContent.trim());
    });
    return bad;
  });
  expect(clippedLabels, 'parameter labels must not be horizontally clipped').toEqual([]);

  // ── 2b. Functionality: exports trigger downloads ──────────────────────────
  const stl = await Promise.all([
    page.waitForEvent('download'),
    page.click('#td-export'),
  ]);
  expect(stl[0].suggestedFilename()).toMatch(/\.stl$/i);

  const svg = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-svg-download'),
  ]);
  expect(svg[0].suggestedFilename()).toMatch(/\.svg$/i);

  const png = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-png-download'),
  ]);
  expect(png[0].suggestedFilename()).toMatch(/\.png$/i);

  // ── Render artifacts: dark + light full-page screenshots ──────────────────
  await page.evaluate(() => {
    document.documentElement.dataset.strata = 'dark';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOT_DIR, 'page-dark.png') });

  await page.click('[data-mn-theme-toggle]'); // → light
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOT_DIR, 'page-light.png') });
});
