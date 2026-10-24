const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
  const svgPath = path.resolve(__dirname, '../frontend/public/icon.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');
  await page.setContent(`<div style="display:flex;align-items:center;justify-content:center;width:512px;height:512px;">${svg}</div>`);
  const outPath = path.resolve(__dirname, '../docs/audiohub-logo.png');
  await page.screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  console.log('Saved logo to', outPath);
})();
