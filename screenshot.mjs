#!/usr/bin/env node
// Quick screenshot utility — takes a screenshot of the running dev server
// Usage: node screenshot.mjs [dark|light|both|toggle] [output-prefix]
import puppeteer from 'puppeteer';

const mode = process.argv[2] || 'both';
const prefix = process.argv[3] || '/tmp/mnemosyne';
const URL = process.env.URL || 'http://localhost:5175';

async function shot(page, label, path) {
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path, fullPage: false });
  console.log(`  [${label}] saved: ${path}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 10000 });

  // Type something so we get a QR code
  await page.type('#text-input', 'Hello Mnemosyne');
  await new Promise(r => setTimeout(r, 1200));

  if (mode === 'toggle') {
    // Test the actual toggle button — start dark, screenshot, click toggle, screenshot
    await page.evaluate(() => {
      document.documentElement.dataset.strata = 'dark';
      localStorage.setItem('mn-strata', 'dark');
    });
    await shot(page, 'dark-before-toggle', `${prefix}_dark.png`);

    // Click the actual theme toggle button
    await page.click('[data-mn-theme-toggle]');
    await shot(page, 'light-after-toggle', `${prefix}_light.png`);

    // Toggle back
    await page.click('[data-mn-theme-toggle]');
    await shot(page, 'dark-after-toggle-back', `${prefix}_dark_back.png`);
  } else {
    if (mode === 'dark' || mode === 'both') {
      await page.evaluate(() => document.documentElement.setAttribute('data-strata', 'dark'));
      await shot(page, 'dark', `${prefix}_dark.png`);
    }
    if (mode === 'light' || mode === 'both') {
      await page.evaluate(() => document.documentElement.setAttribute('data-strata', 'light'));
      await shot(page, 'light', `${prefix}_light.png`);
    }
  }

  await browser.close();
  console.log('done');
})();
